import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApiHandler } from "../src/api/server.js";
import { JurisdictionRulesTaxProvider } from "../src/tax/jurisdiction-rules.js";

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function dependencies() {
  return {
    catalog: {
      async saveDiscoverySearch() {},
      async listCanonicalProducts() { return []; },
      async queueReview() {},
      async saveCanonicalizationReport() {},
      async getReview(id) { return id === "known" ? { reviewId: id, status: "pending" } : undefined; },
      async getProductById(id) { return id === "p1" ? { productId: "p1", brand: "Demo", name: "Product" } : undefined; },
      async listCatalogIndex() { return [{ productId: "p1", brand: "Demo", name: "Product", identifiers: {} }]; },
      async getProductHistory(id) {
        return id === "p1"
          ? [
              { observedAt: "2026-09-01T00:00:00Z", price: 100, currency: "USD", retailer: "A" },
              { observedAt: "2026-09-02T00:00:00Z", price: 80, currency: "USD", retailer: "B" },
              { observedAt: "2026-09-03T00:00:00Z", price: 90, currency: "USD", retailer: "C" }
            ]
          : undefined;
      },
    },
    adapter: {
      retailer: "test",
      async search(query) {
        return [{
          listingId: "l1",
          retailer: "Demo Store",
          source: "test",
          url: "https://example.com/l1",
          title: query,
          identifiers: {},
          specifications: {},
          packageContents: [],
          imageEvidence: [],
          observedAt: new Date().toISOString(),
          offer: { price: 10, currency: "USD" },
        }];
      },
    },
  };
}

test("health is public", async () => {
  const handler = createApiHandler({ ...dependencies(), apiKey: "secret" });
  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
  });
});

test("protected routes require bearer token when configured", async () => {
  const handler = createApiHandler({ ...dependencies(), apiKey: "secret" });
  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/v1/products/p1`);
    assert.equal(response.status, 401);
  });
});

test("search returns canonicalization summary", async () => {
  const handler = createApiHandler({ ...dependencies(), apiKey: "secret" });
  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/v1/search`, {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ query: "demo product" }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.resultCount, 1);
    assert.equal(body.summary.new_product, 1);
  });
});

test("product endpoint returns canonical product", async () => {
  const handler = createApiHandler({ ...dependencies(), apiKey: "secret" });
  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/v1/products/p1`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).productId, "p1");
  });
});


test("search calculates zero Oregon general sales tax when destination is Portland", async () => {
  const deps = dependencies();
  deps.adapter.search = async (query) => [{
    listingId: "or-1",
    retailer: "Demo Store",
    source: "test",
    url: "https://example.com/or-1",
    title: query,
    identifiers: {},
    specifications: {},
    packageContents: [],
    imageEvidence: [],
    observedAt: new Date().toISOString(),
    offer: { price: 100, shippingAmount: 0, currency: "USD" },
  }];

  const handler = createApiHandler({
    ...deps,
    taxProviders: [new JurisdictionRulesTaxProvider()],
    apiKey: "secret",
  });

  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/v1/search`, {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "demo product",
        destination: {
          city: "Portland",
          state: "OR",
          postalCode: "97205",
          country: "US"
        }
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.results[0].cost.tax.taxAmount, 0);
    assert.equal(body.results[0].cost.landedCost, 100);
    assert.equal(body.results[0].cost.tax.jurisdiction, "Oregon");
  });
});


test("serves the BuyWindow web app", async () => {
  const handler = createApiHandler({ ...dependencies(), apiKey: "secret" });
  await withServer(handler, async (base) => {
    const root = await fetch(`${base}/`, { redirect: "manual" });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get("location"), "/app/");

    const app = await fetch(`${base}/app/`);
    assert.equal(app.status, 200);
    assert.match(app.headers.get("content-type"), /text\/html/);
    assert.match(await app.text(), /Know when, where/);
  });
});


test("catalog endpoint returns canonical product summaries", async () => {
  const handler = createApiHandler({ ...dependencies(), apiKey: "secret" });
  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/v1/products`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.products[0].productId, "p1");
  });
});

test("history endpoint returns observations and descriptive statistics", async () => {
  const handler = createApiHandler({ ...dependencies(), apiKey: "secret" });
  await withServer(handler, async (base) => {
    const response = await fetch(`${base}/v1/products/p1/history`, {
      headers: { authorization: "Bearer secret" },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.summary.minPrice, 80);
    assert.equal(body.summary.maxPrice, 100);
    assert.equal(body.summary.medianPrice, 90);
    assert.equal(body.summary.sufficientForTrend, false);
    assert.equal(body.observations.length, 3);
    assert.equal(body.decision.decision, "insufficient_data");
  });
});


test("decision endpoint returns conservative Buy/Wait analysis", async () => {
  const deps = dependencies();
  deps.catalog.getProductHistory = async () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const prices = [120,118,121,119,117,122,120,116,119,118,117,89];
    return prices.map((price, index) => ({
      observedAt: new Date(start.getTime() + index * 5 * 86400000).toISOString(),
      price,
      currency: "USD",
      retailer: "Demo"
    }));
  };

  const realNow = Date.now;
  Date.now = () => new Date("2026-02-26T00:00:00Z").getTime();
  try {
    const handler = createApiHandler({ ...deps, apiKey: "secret" });
    await withServer(handler, async (base) => {
      const response = await fetch(`${base}/v1/products/p1/decision`, {
        headers: { authorization: "Bearer secret" },
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.ok(["buy", "wait", "fair", "insufficient_data"].includes(body.decision.decision));
      assert.equal(body.decision.model.predictsFuturePrice, false);
    });
  } finally {
    Date.now = realNow;
  }
});
