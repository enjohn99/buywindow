import test from "node:test";
import assert from "node:assert/strict";
import { calculateLandedCost, rankByLandedCost } from "../src/cost/landed-cost.js";
import { JurisdictionRulesTaxProvider } from "../src/tax/jurisdiction-rules.js";

function listing(overrides = {}) {
  return {
    listingId: "l1",
    retailer: "Store",
    offer: { price: 499, currency: "USD", shippingAmount: 0 },
    ...overrides,
  };
}

test("Oregon general tangible goods get zero general sales tax fallback", async () => {
  const result = await calculateLandedCost({
    listing: listing(),
    destination: { city: "Portland", state: "OR", postalCode: "97205", country: "US" },
    taxProviders: [new JurisdictionRulesTaxProvider()],
  });
  assert.equal(result.tax.taxAmount, 0);
  assert.equal(result.landedCost, 499);
  assert.equal(result.tax.jurisdiction, "Oregon");
});

test("retailer-observed tax beats provider estimates", async () => {
  let called = false;
  const provider = {
    canCalculate() { return true; },
    async calculate() { called = true; return { status: "estimated", taxAmount: 50 }; },
  };
  const result = await calculateLandedCost({
    listing: listing({ offer: { price: 100, shippingAmount: 0, taxAmount: 8.25, currency: "USD" } }),
    destination: { state: "TX", postalCode: "78758", country: "US" },
    taxProviders: [provider],
  });
  assert.equal(result.tax.status, "observed");
  assert.equal(result.landedCost, 108.25);
  assert.equal(called, false);
});

test("partial cost is explicit when shipping is unknown", async () => {
  const result = await calculateLandedCost({
    listing: listing({ offer: { price: 100, currency: "USD" } }),
    destination: { state: "OR", postalCode: "97205", country: "US" },
    taxProviders: [new JurisdictionRulesTaxProvider()],
  });
  assert.equal(result.status, "partial");
  assert.equal(result.landedCost, undefined);
  assert.equal(result.completeness.shipping, false);
});

test("ranks complete landed costs before partial sticker prices", () => {
  const ranked = rankByLandedCost([
    { listingId: "cheap-partial", listedPrice: 80 },
    { listingId: "complete", listedPrice: 90, landedCost: 95 },
  ]);
  assert.equal(ranked[0].listingId, "complete");
});


test("Oregon fallback does not claim zero tax for special categories", async () => {
  const result = await calculateLandedCost({
    listing: listing(),
    destination: { city: "Portland", state: "OR", postalCode: "97205", country: "US" },
    taxCategory: "vehicle",
    taxProviders: [new JurisdictionRulesTaxProvider()],
  });
  assert.equal(result.tax.status, "unavailable");
  assert.equal(result.landedCost, undefined);
});
