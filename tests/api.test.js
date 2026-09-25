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
