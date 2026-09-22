import test from "node:test";
import assert from "node:assert/strict";
import { resolveReview } from "../src/engine/review-resolver.js";

function makeCatalog(review, products = []) {
  const calls = [];
  return {
    calls,
    async getReview() { return review; },
    async getProductById(id) { return products.find((p) => p.productId === id); },
    async saveProduct(product) { calls.push(["saveProduct", product]); },
    async saveListing(product, listing) { calls.push(["saveListing", product, listing]); },
    async appendObservation(product, observation) { calls.push(["appendObservation", product, observation]); },
    async resolveReview(id, resolved) { calls.push(["resolveReview", id, resolved]); },
  };
}

const listing = {
  listingId: "l1",
  retailer: "Store",
  source: "test",
  sourceProductId: "123",
  url: "https://example.com/123",
  title: "DEWALT DCD996B Hammer Drill",
  brand: "DEWALT",
  identifiers: { manufacturerModel: "DCD996B" },
  specifications: { voltage: "20V" },
  packageContents: ["hammer drill"],
  imageEvidence: [],
  observedAt: "2026-09-22T18:00:00.000Z",
  offer: { price: 149.99, currency: "USD" },
};

test("same_product writes listing and observation then resolves review", async () => {
  const review = {
    reviewId: "r1",
    status: "pending",
    candidateListing: listing,
    classification: { proposedProductId: "dewalt-dcd996b" },
  };
  const product = {
    productId: "dewalt-dcd996b",
    brand: "DEWALT",
    name: "DCD996B",
    identifiers: { manufacturerModel: "DCD996B" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    schemaVersion: 1,
  };
  const catalog = makeCatalog(review, [product]);
  const resolved = await resolveReview({ catalog, reviewId: "r1", action: "same_product" });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolution.productId, "dewalt-dcd996b");
  assert.ok(catalog.calls.some(([name]) => name === "saveListing"));
  assert.ok(catalog.calls.some(([name]) => name === "appendObservation"));
});

test("new_product creates canonical product from listing", async () => {
  const review = { reviewId: "r2", status: "pending", candidateListing: listing, classification: { classification: "new_product" } };
  const catalog = makeCatalog(review);
  const resolved = await resolveReview({ catalog, reviewId: "r2", action: "new_product" });
  assert.equal(resolved.resolution.action, "new_product");
  assert.ok(catalog.calls.some(([name]) => name === "saveProduct"));
});

test("reject only resolves the review", async () => {
  const review = { reviewId: "r3", status: "pending", candidateListing: listing, classification: {} };
  const catalog = makeCatalog(review);
  const resolved = await resolveReview({ catalog, reviewId: "r3", action: "reject" });
  assert.equal(resolved.resolution.action, "reject");
  assert.equal(catalog.calls.filter(([name]) => name === "resolveReview").length, 1);
  assert.equal(catalog.calls.some(([name]) => name === "saveProduct"), false);
});
