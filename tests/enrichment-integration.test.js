import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeDiscovery } from "../src/engine/canonicalize-discovery.js";

test("canonicalization uses inferred brand/model before matching", async () => {
  const product = {
    productId: "dewalt-dcd996b",
    brand: "DEWALT",
    name: "20V MAX XR Brushless Hammer Drill Bare Tool",
    identifiers: { manufacturerModel: "DCD996B", upc: "885911486922" },
    specifications: {},
    packageContents: [],
    imageEvidence: [],
  };

  const writes = { listings: 0, observations: 0, reviews: 0 };

  const catalog = {
    async listCanonicalProducts() { return [product]; },
    async saveListing(savedProduct, listing) {
      assert.equal(savedProduct.productId, product.productId);
      assert.equal(listing.brand, "Dewalt");
      assert.equal(listing.identifiers.manufacturerModel, "DCD996B");
      assert.equal(listing.identifiers.upc, "885911486922");
      writes.listings += 1;
    },
    async appendObservation() { writes.observations += 1; },
    async queueReview() { writes.reviews += 1; },
    async saveCanonicalizationReport() {},
  };

  const snapshot = {
    searchId: "search-1",
    query: "dewalt drill",
    observedAt: "2026-09-25T12:00:00Z",
    results: [{
      listingId: "listing-1",
      retailer: "Demo Store",
      source: "test",
      url: "https://example.com/item",
      title: "DEWALT DCD996B 20V MAX XR Hammer Drill UPC 885911486922",
      identifiers: {},
      specifications: {},
      packageContents: [],
      imageEvidence: [],
      observedAt: "2026-09-25T12:00:00Z",
      offer: { price: 149, currency: "USD" },
    }],
  };

  const report = await canonicalizeDiscovery({
    snapshot,
    catalog,
    enrichment: { hashImages: false },
  });

  assert.equal(report.results[0].classification, "same_product");
  assert.equal(report.results[0].listing.identifiers.manufacturerModel, "DCD996B");
  assert.equal(report.results[0].listing.identifiers.upc, "885911486922");
  assert.equal(writes.listings, 1);
  assert.equal(writes.observations, 1);
  assert.equal(writes.reviews, 0);
});
