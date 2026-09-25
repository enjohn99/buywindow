import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSeasonalityPrior } from "../src/intelligence/seasonality-priors.js";
import { composePurchaseDecision } from "../src/intelligence/decision-composer.js";

test("pool seed prior is favorable in September", () => {
  const product = { name: "Intex Above Ground Pool", brand: "Intex", categoryPath: ["outdoor", "pools"] };
  const result = evaluateSeasonalityPrior(product, { now: "2026-09-25T00:00:00Z" });
  assert.equal(result.status, "available");
  assert.equal(result.signal, "favorable");
  assert.equal(result.learnedFromBuyWindowData, false);
});

test("seasonality can provide low-confidence advisory when product history is insufficient", () => {
  const product = { name: "Bestway Above Ground Pool", categoryPath: ["outdoor", "pools"] };
  const result = composePurchaseDecision({
    product,
    observations: [
      { observedAt: "2026-09-20T00:00:00Z", price: 200, currency: "USD" }
    ],
    now: "2026-09-25T00:00:00Z",
  });
  assert.equal(result.decision, "consider_buying");
  assert.ok(result.confidence <= 0.45);
  assert.equal(result.model.categoryPriorOnly, true);
});

test("trusted product history remains authoritative over seasonality", () => {
  const product = { name: "Portable Air Conditioner", categoryPath: ["cooling"] };
  const start = new Date("2026-04-01T00:00:00Z");
  const prices = [100,101,99,102,98,100,101,99,102,100,101,100];
  const observations = prices.map((price, index) => ({
    observedAt: new Date(start.getTime() + index * 10 * 86400000).toISOString(),
    price,
    currency: "USD",
  }));

  const result = composePurchaseDecision({
    product,
    observations,
    now: "2026-07-25T00:00:00Z",
  });
  assert.equal(result.decision, "fair");
  assert.equal(result.model.categoryPriorOnly, undefined);
  assert.equal(result.evidence.seasonality.signal, "unfavorable");
});
