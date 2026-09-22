import test from "node:test";
import assert from "node:assert/strict";
import { matchListing } from "../src/identity/matcher.js";

const now = new Date().toISOString();
const product = {
  productId: "dewalt-dcd996b",
  brand: "DEWALT",
  name: "20V MAX XR Brushless Hammer Drill Bare Tool",
  categoryPath: ["Tools", "Drills"],
  identifiers: { manufacturerModel: "DCD996B", upc: "885911486922" },
  specifications: { voltage: "20V", brushless: true },
  packageContents: ["hammer drill", "side handle", "belt hook"],
  imageEvidence: [{ perceptualHash: "same-image" }],
  createdAt: now,
  updatedAt: now,
  schemaVersion: 1,
};

function listing(overrides = {}) {
  return {
    listingId: "l1",
    retailer: "retailer",
    url: "https://example.com/l1",
    title: "DEWALT 20V MAX XR Brushless Hammer Drill Tool Only",
    brand: "DEWALT",
    identifiers: { manufacturerModel: "DCD996B", upc: "885911486922" },
    specifications: { voltage: "20V", brushless: true },
    packageContents: ["hammer drill", "side handle", "belt hook"],
    imageEvidence: [{ perceptualHash: "same-image" }],
    observedAt: now,
    ...overrides,
  };
}

test("auto-matches exact model + UPC", () => {
  const result = matchListing(product, listing());
  assert.equal(result.decision, "auto_match");
  assert.ok(result.confidence >= 0.99);
});

test("rejects conflicting manufacturer models so bundles/variants do not merge", () => {
  const result = matchListing(product, listing({ identifiers: { manufacturerModel: "DCD996P2", upc: "885911486922" } }));
  assert.equal(result.decision, "reject");
  assert.equal(result.hardConflict, true);
});

test("rejects conflicting UPCs", () => {
  const result = matchListing(product, listing({ identifiers: { manufacturerModel: "DCD996B", upc: "000000000000" } }));
  assert.equal(result.decision, "reject");
  assert.equal(result.hardConflict, true);
});

test("uses image/spec/title evidence when hard identifiers are absent", () => {
  const result = matchListing(product, listing({ identifiers: {}, imageEvidence: [{ perceptualHash: "same-image" }] }));
  assert.ok(["auto_match", "human_review"].includes(result.decision));
  assert.ok(result.confidence >= 0.7);
});
