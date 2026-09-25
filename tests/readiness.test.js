import test from "node:test";
import assert from "node:assert/strict";
import { getReadiness } from "../src/config/readiness.js";

test("core readiness requires GitHub and SerpApi", () => {
  const result = getReadiness({});
  assert.equal(result.status, "degraded");
  assert.equal(result.features.search.ready, false);
  assert.ok(result.missingRequired.includes("GITHUB_TOKEN"));
  assert.ok(result.missingRequired.includes("SERPAPI_API_KEY"));
});

test("core app can be ready while eBay enrichment remains optional", () => {
  const result = getReadiness({
    GITHUB_TOKEN: "x",
    GITHUB_OWNER: "owner",
    GITHUB_REPO: "repo",
    SERPAPI_API_KEY: "serp",
  });
  assert.equal(result.status, "ok");
  assert.equal(result.features.search.ready, true);
  assert.equal(result.features.ebayMarketEvidence.ready, false);
});

test("partial eBay configuration is reported explicitly", () => {
  const result = getReadiness({
    GITHUB_TOKEN: "x",
    GITHUB_OWNER: "owner",
    GITHUB_REPO: "repo",
    SERPAPI_API_KEY: "serp",
    EBAY_CLIENT_ID: "id",
  });
  assert.equal(result.status, "ok");
  assert.equal(result.features.ebayMarketEvidence.partiallyConfigured, true);
  assert.deepEqual(result.features.ebayMarketEvidence.missing, ["EBAY_CLIENT_SECRET"]);
});
