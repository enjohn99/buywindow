import test from "node:test";
import assert from "node:assert/strict";
import { classifyAgainstCatalog } from "../src/identity/canonicalize.js";

const product = {
  productId: "dewalt-dcd996b",
  brand: "DEWALT",
  name: "20V MAX XR Brushless Hammer Drill Bare Tool",
  identifiers: { manufacturerModel: "DCD996B", upc: "885911486922" },
  specifications: { voltage: "20V" },
  packageContents: ["hammer drill", "side handle"],
  imageEvidence: [],
};

test("classifies exact identity as same_product", () => {
  const listing = {
    listingId: "1",
    retailer: "Store",
    title: "DEWALT DCD996B 20V MAX XR Hammer Drill",
    brand: "DEWALT",
    identifiers: { manufacturerModel: "DCD996B", upc: "885911486922" },
    specifications: { voltage: "20V" },
    packageContents: ["hammer drill", "side handle"],
    imageEvidence: [],
  };
  const result = classifyAgainstCatalog([product], listing);
  assert.equal(result.classification, "same_product");
});

test("classifies conflicting same-family model as variant", () => {
  const listing = {
    listingId: "2",
    retailer: "Store",
    title: "DEWALT DCD996P2 Hammer Drill Kit",
    brand: "DEWALT",
    identifiers: { manufacturerModel: "DCD996P2" },
    specifications: { voltage: "20V" },
    packageContents: ["hammer drill", "battery", "charger"],
    imageEvidence: [],
  };
  const result = classifyAgainstCatalog([product], listing);
  assert.equal(result.classification, "variant");
});

test("classifies weak but related brand/title as alternative", () => {
  const listing = {
    listingId: "3",
    retailer: "Store",
    title: "DEWALT 20V MAX XR Compact Hammer Drill",
    brand: "DEWALT",
    identifiers: {},
    specifications: {},
    packageContents: [],
    imageEvidence: [],
  };
  const result = classifyAgainstCatalog([product], listing);
  assert.ok(["alternative", "needs_human_review"].includes(result.classification));
});
