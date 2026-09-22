import http from "node:http";
import { SerpApiGoogleShoppingAdapter } from "../adapters/serpapi-google-shopping.js";
import { runDiscovery } from "../engine/discovery.js";
import { canonicalizeDiscovery } from "../engine/canonicalize-discovery.js";
import { resolveReview } from "../engine/review-resolver.js";
import { GitHubIssueReviewQueue } from "../review/github-issues.js";
import { GitHubCatalogStore } from "../storage/github.js";
import { calculateLandedCost } from "../cost/landed-cost.js";
import { createTaxProviders } from "../tax/provider-chain.js";

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req, limit = 64 * 1024) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > limit) {
      const error = new Error("request body too large");
      error.statusCode = 413;
      throw error;
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function bearerAuthorized(req, apiKey) {
  if (!apiKey) return true;
  return req.headers.authorization === `Bearer ${apiKey}`;
}

export function createDependencies(env = process.env) {
  const catalog = new GitHubCatalogStore({
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH ?? "main",
  });

  const adapter = new SerpApiGoogleShoppingAdapter({
    apiKey: env.SERPAPI_API_KEY,
  });

  const reviewQueue = env.BUYWINDOW_REVIEW_ISSUES === "true"
    ? new GitHubIssueReviewQueue({
        token: env.GITHUB_TOKEN,
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
      })
    : undefined;

  const taxProviders = createTaxProviders(env);

  return { catalog, adapter, reviewQueue, taxProviders };
}

export function createApiHandler({
  catalog,
  adapter,
  reviewQueue,
  taxProviders = [],
  apiKey,
  defaultLocation,
  gl = "us",
  hl = "en",
}) {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, {
          status: "ok",
          service: "buywindow",
          version: "0.6.0",
        });
      }

      if (!bearerAuthorized(req, apiKey)) {
        return json(res, 401, { error: "unauthorized" });
      }

      if (req.method === "POST" && url.pathname === "/v1/search") {
        const body = await readJson(req);
        const query = String(body.query ?? "").trim();
        if (!query) return json(res, 400, { error: "query is required" });

        const snapshot = await runDiscovery({
          adapter,
          query,
          context: {
            location: body.location || defaultLocation || undefined,
            gl: body.gl || gl,
            hl: body.hl || hl,
          },
          catalog,
        });

        const canonicalization = await canonicalizeDiscovery({
          snapshot,
          catalog,
          reviewQueue,
        });

        const destination = body.destination;
        const fulfillment = body.fulfillment || "shipping";
        const maxTaxCalculations = Math.max(
          0,
          Number(body.maxTaxCalculations ?? process.env.BUYWINDOW_TAX_MAX_RESULTS ?? 10)
        );

        const indexed = canonicalization.results.map((result, index) => ({ result, index }));
        const priced = indexed
          .filter(({ result }) => Number.isFinite(Number(result.listing?.offer?.price)))
          .sort((a, b) => Number(a.result.listing.offer.price) - Number(b.result.listing.offer.price));

        const eligibleIndexes = new Set(
          priced.slice(0, maxTaxCalculations).map(({ index }) => index)
        );

        const enriched = await Promise.all(
          canonicalization.results.map(async (result, index) => {
            const shouldCalculate = destination && eligibleIndexes.has(index);
            if (!shouldCalculate) {
              return {
                ...result,
                cost: {
                  status: "partial",
                  listedPrice: result.listing?.offer?.price,
                  currency: result.listing?.offer?.currency ?? "USD",
                  reason: destination
                    ? "tax calculation limit reached"
                    : "destination required for landed-cost tax calculation",
                },
              };
            }

            const cost = await calculateLandedCost({
              listing: result.listing,
              destination,
              fulfillment,
              taxProviders,
              taxCode: body.taxCode || "txcd_99999999",
              taxCategory: body.taxCategory || "general_tangible_goods",
            });

            return { ...result, cost };
          })
        );

        enriched.sort((a, b) => {
          const aCost = a.cost?.landedCost;
          const bCost = b.cost?.landedCost;
          if (aCost != null && bCost != null) return aCost - bCost;
          if (aCost != null) return -1;
          if (bCost != null) return 1;
          return Number(a.listing?.offer?.price ?? Infinity) - Number(b.listing?.offer?.price ?? Infinity);
        });

        return json(res, 200, {
          searchId: snapshot.searchId,
          query,
          resultCount: snapshot.resultCount,
          summary: canonicalization.summary,
          costBasis: destination
            ? {
                destination,
                fulfillment,
                taxCode: body.taxCode || "txcd_99999999",
                taxCategory: body.taxCategory || "general_tangible_goods",
                maxTaxCalculations,
              }
            : undefined,
          results: enriched,
        });
      }

      const reviewMatch = url.pathname.match(/^\/v1\/reviews\/([^/]+)$/);
      if (reviewMatch && req.method === "GET") {
        const review = await catalog.getReview(decodeURIComponent(reviewMatch[1]));
        if (!review) return json(res, 404, { error: "review not found" });
        return json(res, 200, review);
      }

      const resolveMatch = url.pathname.match(/^\/v1\/reviews\/([^/]+)\/resolve$/);
      if (resolveMatch && req.method === "POST") {
        const body = await readJson(req);
        if (!body.action) return json(res, 400, { error: "action is required" });

        const resolved = await resolveReview({
          catalog,
          reviewId: decodeURIComponent(resolveMatch[1]),
          action: body.action,
          productId: body.productId,
          reviewer: body.reviewer || "api",
          note: body.note,
          overrides: body.overrides ?? {},
        });
        return json(res, 200, resolved);
      }

      const productMatch = url.pathname.match(/^\/v1\/products\/([^/]+)$/);
      if (productMatch && req.method === "GET") {
        const product = await catalog.getProductById(decodeURIComponent(productMatch[1]));
        if (!product) return json(res, 404, { error: "product not found" });
        return json(res, 200, product);
      }

      return json(res, 404, { error: "not found" });
    } catch (error) {
      const status = error.statusCode || 500;
      return json(res, status, {
        error: status >= 500 ? "internal server error" : error.message,
        ...(process.env.NODE_ENV !== "production" && status >= 500 ? { detail: String(error) } : {}),
      });
    }
  };
}

export function startServer({ env = process.env, dependencies } = {}) {
  const required = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "SERPAPI_API_KEY"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const deps = dependencies ?? createDependencies(env);
  const handler = createApiHandler({
    ...deps,
    apiKey: env.BUYWINDOW_API_KEY,
    defaultLocation: env.BUYWINDOW_LOCATION,
    gl: env.BUYWINDOW_GL ?? "us",
    hl: env.BUYWINDOW_HL ?? "en",
  });

  const port = Number(env.PORT || 8080);
  const host = env.HOST || "0.0.0.0";
  const server = http.createServer(handler);
  server.listen(port, host, () => {
    console.log(JSON.stringify({
      event: "server_started",
      service: "buywindow",
      host,
      port,
      authEnabled: Boolean(env.BUYWINDOW_API_KEY),
    }));
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
