import { catalogIndexPath, canonicalizationReportPath, discoveryPath, listingPath, observationPath, productPath, resolvedReviewPath, reviewPath, watchlistPath } from "./paths.js";
import { validateCanonicalProduct, validateObservation, validateRetailerListing } from "../domain/validate.js";

export class GitHubCatalogStore {
  constructor(options) {
    this.options = options;
    this.branch = options.branch ?? "main";
    this.apiBase = options.apiBase ?? "https://api.github.com";
  }

  headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.options.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "buywindow/0.1",
    };
  }

  endpoint(path) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return `${this.apiBase}/repos/${this.options.owner}/${this.options.repo}/contents/${encoded}`;
  }

  async readText(path) {
    const response = await fetch(`${this.endpoint(path)}?ref=${encodeURIComponent(this.branch)}`, { headers: this.headers() });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`GitHub read failed (${response.status}): ${await response.text()}`);
    const body = await response.json();
    const text = body.content ? Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf8") : "";
    return { text, sha: body.sha };
  }

  async writeText(path, text, message, expectedSha) {
    const body = { message, content: Buffer.from(text, "utf8").toString("base64"), branch: this.branch };
    if (expectedSha) body.sha = expectedSha;
    const response = await fetch(this.endpoint(path), { method: "PUT", headers: this.headers(), body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`GitHub write failed (${response.status}): ${await response.text()}`);
  }

  async upsertJson(path, value, message) {
    const current = await this.readText(path);
    await this.writeText(path, `${JSON.stringify(value, null, 2)}\n`, message, current?.sha);
  }

  async appendJsonLine(path, value, message, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
      const current = await this.readText(path);
      const next = `${current?.text ?? ""}${JSON.stringify(value)}\n`;
      try {
        await this.writeText(path, next, message, current?.sha);
        return;
      } catch (error) {
        if (attempt === retries - 1 || !String(error).includes("409")) throw error;
      }
    }
  }

  async saveProduct(product) {
    validateCanonicalProduct(product);
    const path = productPath(product.brand, product.productId);
    await this.upsertJson(path, product, `catalog: upsert ${product.productId}`);
    await this.upsertCatalogIndex({
      productId: product.productId,
      brand: product.brand,
      name: product.name,
      identifiers: product.identifiers ?? {},
      categoryPath: product.categoryPath ?? [],
      path,
      updatedAt: product.updatedAt,
    });
  }

  async upsertCatalogIndex(entry) {
    const path = catalogIndexPath();
    const current = await this.readText(path);
    const index = current?.text ? JSON.parse(current.text) : { schemaVersion: 1, products: [] };
    const next = index.products.filter((item) => item.productId !== entry.productId);
    next.push(entry);
    next.sort((a, b) => a.productId.localeCompare(b.productId));
    index.products = next;
    index.updatedAt = new Date().toISOString();
    await this.writeText(path, `${JSON.stringify(index, null, 2)}\n`, `catalog-index: upsert ${entry.productId}`, current?.sha);
  }

  async readJson(path) {
    const current = await this.readText(path);
    return current?.text ? JSON.parse(current.text) : undefined;
  }

  async listDirectory(path) {
    const response = await fetch(
      `${this.endpoint(path)}?ref=${encodeURIComponent(this.branch)}`,
      { headers: this.headers() }
    );
    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`GitHub directory read failed (${response.status}): ${await response.text()}`);
    }
    const body = await response.json();
    return Array.isArray(body) ? body : [];
  }

  async getWatchlist() {
    return (await this.readJson(watchlistPath())) ?? {
      schemaVersion: 1,
      updatedAt: undefined,
      items: [],
    };
  }

  async saveWatchlist(watchlist) {
    const value = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      items: Array.isArray(watchlist?.items) ? watchlist.items : [],
    };
    await this.upsertJson(watchlistPath(), value, "watchlist: update products");
    return value;
  }

  async listCatalogIndex() {
    const index = await this.readJson(catalogIndexPath());
    return index?.products ?? [];
  }

  async listCanonicalProducts() {
    const index = await this.readJson(catalogIndexPath());
    if (!index?.products?.length) return [];
    const products = [];
    for (const item of index.products) {
      const product = await this.readJson(item.path);
      if (product) products.push(product);
    }
    return products;
  }

  async getProductById(productId) {
    const index = await this.readJson(catalogIndexPath());
    const item = index?.products?.find((entry) => entry.productId === productId);
    if (!item) return undefined;
    return this.readJson(item.path);
  }

  async getProductHistory(productId, { limit = 500 } = {}) {
    const index = await this.readJson(catalogIndexPath());
    const item = index?.products?.find((entry) => entry.productId === productId);
    if (!item) return undefined;

    const root = item.path.replace(/\/product\.json$/, "");
    const years = (await this.listDirectory(`${root}/observations`))
      .filter((entry) => entry.type === "dir")
      .sort((a, b) => b.name.localeCompare(a.name));

    const observations = [];
    for (const year of years) {
      const files = (await this.listDirectory(year.path))
        .filter((entry) => entry.type === "file" && entry.name.endsWith(".jsonl"))
        .sort((a, b) => b.name.localeCompare(a.name));

      for (const file of files) {
        const current = await this.readText(file.path);
        if (!current?.text) continue;
        for (const line of current.text.split("\n")) {
          if (!line.trim()) continue;
          try {
            observations.push(JSON.parse(line));
          } catch {
            // Ignore a malformed historical line rather than failing the full product history.
          }
        }
        if (observations.length >= limit) break;
      }
      if (observations.length >= limit) break;
    }

    observations.sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
    return observations.slice(-limit);
  }

  async getReview(reviewId) {
    return this.readJson(reviewPath(reviewId));
  }

  async resolveReview(reviewId, resolved) {
    await this.upsertJson(resolvedReviewPath(reviewId), resolved, `review: resolve ${reviewId}`);
    const pending = await this.readText(reviewPath(reviewId));
    if (pending) {
      const url = this.endpoint(reviewPath(reviewId));
      const response = await fetch(url, {
        method: "DELETE",
        headers: this.headers(),
        body: JSON.stringify({
          message: `review: archive ${reviewId}`,
          sha: pending.sha,
          branch: this.branch,
        }),
      });
      if (!response.ok) throw new Error(`GitHub review archive failed (${response.status}): ${await response.text()}`);
    }
  }

  async saveListing(product, listing) {
    validateCanonicalProduct(product);
    validateRetailerListing(listing);
    await this.upsertJson(listingPath(product.brand, product.productId, listing.retailer, listing.listingId), listing, `listing: ${listing.retailer}/${listing.listingId} -> ${product.productId}`);
  }

  async appendObservation(product, observation) {
    validateCanonicalProduct(product);
    validateObservation(observation);
    await this.appendJsonLine(observationPath(product.brand, product.productId, observation.observedAt), observation, `observation: ${observation.retailer} ${observation.productId}`);
  }

  async queueReview(review) {
    await this.upsertJson(reviewPath(review.reviewId), review, `review: queue ${review.reviewId}`);
  }

  async saveDiscoverySearch(snapshot) {
    await this.upsertJson(
      discoveryPath(snapshot.searchId, snapshot.observedAt),
      snapshot,
      `discovery: ${snapshot.query} (${snapshot.resultCount} results)`
    );
  }

  async saveCanonicalizationReport(report) {
    await this.upsertJson(
      canonicalizationReportPath(report.searchId, report.canonicalizedAt),
      report,
      `canonicalization: ${report.query}`
    );
  }
}
