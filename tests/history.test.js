import test from "node:test";
import assert from "node:assert/strict";
import { summarizeHistory } from "../src/history/summarize.js";

test("summarizes observed price history without forecasting", () => {
  const history = [
    { observedAt: "2026-01-01T00:00:00Z", price: 100, currency: "USD" },
    { observedAt: "2026-02-01T00:00:00Z", price: 80, currency: "USD" },
    { observedAt: "2026-03-01T00:00:00Z", price: 90, currency: "USD" },
  ];
  const summary = summarizeHistory(history);
  assert.equal(summary.minPrice, 80);
  assert.equal(summary.maxPrice, 100);
  assert.equal(summary.medianPrice, 90);
  assert.equal(summary.latestPrice, 90);
  assert.equal(summary.sufficientForTrend, false);
});
