import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBuyWait } from "../src/intelligence/buy-wait.js";

function history(prices, start = "2026-01-01T00:00:00Z", spacingDays = 5) {
  const base = new Date(start);
  return prices.map((price, index) => ({
    observedAt: new Date(base.getTime() + index * spacingDays * 86_400_000).toISOString(),
    price,
    currency: "USD",
    retailer: "Demo",
  }));
}

test("returns insufficient_data for sparse history", () => {
  const result = evaluateBuyWait(history([100, 95, 90]), {
    now: "2026-01-20T00:00:00Z",
  });
  assert.equal(result.decision, "insufficient_data");
  assert.match(result.reasons.join(" "), /12 trusted priced observations/);
});

test("returns buy when current price is materially low versus history", () => {
  const prices = [120,118,121,119,117,122,120,116,119,118,117,89];
  const result = evaluateBuyWait(history(prices), {
    now: "2026-02-26T00:00:00Z",
  });
  assert.equal(result.decision, "buy");
  assert.ok(result.metrics.discountToMedian >= 0.08);
});

test("returns wait when current price is materially high versus history", () => {
  const prices = [90,92,91,89,93,90,91,92,94,98,105,120];
  const result = evaluateBuyWait(history(prices), {
    now: "2026-02-26T00:00:00Z",
  });
  assert.equal(result.decision, "wait");
  assert.ok(result.metrics.percentile >= 0.75);
});

test("returns fair when current price is near historical middle", () => {
  const prices = [100,102,98,101,99,100,103,97,101,99,102,100];
  const result = evaluateBuyWait(history(prices), {
    now: "2026-02-26T00:00:00Z",
  });
  assert.equal(result.decision, "fair");
});
