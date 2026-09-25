import test from "node:test";
import assert from "node:assert/strict";
import { evaluateArbitrageCandidate, scanArbitrageOpportunities } from "../src/arbitrage/evaluate.js";

function history(prices, start = "2026-01-01T00:00:00Z", spacingDays = 5) {
  const base = new Date(start);
  return prices.map((price, index) => ({
    observedAt: new Date(base.getTime() + index * spacingDays * 86_400_000).toISOString(),
    price,
    currency: "USD",
    retailer: "Demo Store",
  }));
}

test("flags a candidate when latest acquisition price has conservative benchmark ROI", () => {
  const product = { productId: "pool-1", brand: "Intex", name: "Above Ground Pool" };
  const rows = history([300,305,295,310,290,300,305,295,300,290,295,150]);
  const result = evaluateArbitrageCandidate(product, rows, {
    feeRate: 0.15,
    minimumNetRoi: 0.25,
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.benchmark.validatedResaleMarket, false);
  assert.ok(result.economics.netRoiBenchmark >= 0.25);
});

test("does not flag normal pricing as arbitrage", () => {
  const product = { productId: "tool-1", brand: "Demo", name: "Tool" };
  const rows = history([100,102,99,101,98,100,103,100,99,101,100,98]);
  const result = evaluateArbitrageCandidate(product, rows);
  assert.equal(result.status, "not_candidate");
});

test("requires sufficient history", () => {
  const product = { productId: "short-1", brand: "Demo", name: "Short" };
  const result = evaluateArbitrageCandidate(product, history([200,100]));
  assert.equal(result.status, "insufficient_data");
});

test("scanner ranks qualifying candidates by benchmark net ROI", async () => {
  const products = [
    { productId: "a", brand: "A", name: "A" },
    { productId: "b", brand: "B", name: "B" },
  ];
  const histories = {
    a: history([300,300,300,300,300,300,300,300,300,300,300,150]),
    b: history([300,300,300,300,300,300,300,300,300,300,300,120]),
  };
  const catalog = {
    async listCanonicalProducts() { return products; },
    async getProductHistory(id) { return histories[id]; },
  };
  const results = await scanArbitrageOpportunities(catalog);
  assert.equal(results.length, 2);
  assert.equal(results[0].productId, "b");
});
