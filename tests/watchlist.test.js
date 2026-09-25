import test from "node:test";
import assert from "node:assert/strict";
import { collectWatchlist, normalizeWatchItem } from "../src/watchlist/service.js";

test("normalizes a watch item with safe defaults", () => {
  const item = normalizeWatchItem({ query: "DEWALT DCD996B" });
  assert.equal(item.query, "DEWALT DCD996B");
  assert.equal(item.enabled, true);
  assert.equal(item.gl, "us");
  assert.equal(item.hl, "en");
  assert.ok(item.watchId);
});

test("collector runs enabled watch items and isolates failures", async () => {
  const saved = [];
  const catalog = {
    async getWatchlist() {
      return {
        items: [
          { watchId: "a", query: "good query", enabled: true, gl: "us", hl: "en" },
          { watchId: "b", query: "bad query", enabled: true, gl: "us", hl: "en" },
          { watchId: "c", query: "disabled", enabled: false, gl: "us", hl: "en" },
        ],
      };
    },
    async saveDiscoverySearch(snapshot) { saved.push(snapshot.searchId); },
    async listCanonicalProducts() { return []; },
    async queueReview() {},
    async saveCanonicalizationReport() {},
  };

  const adapter = {
    retailer: "test",
    async search(query) {
      if (query === "bad query") throw new Error("provider unavailable");
      return [];
    },
  };

  const result = await collectWatchlist({ catalog, adapter });
  assert.equal(result.enabledCount, 2);
  assert.equal(result.successCount, 1);
  assert.equal(result.errorCount, 1);
  assert.equal(result.runs[0].status, "ok");
  assert.equal(result.runs[1].status, "error");
  assert.equal(saved.length, 1);
});
