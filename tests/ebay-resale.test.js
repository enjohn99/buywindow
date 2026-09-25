import test from "node:test";
import assert from "node:assert/strict";
import { EbayBrowseMarketProvider } from "../src/resale/ebay-browse.js";
import { collectResaleMarketEvidence } from "../src/resale/evidence.js";

test("mints application token and summarizes active eBay asking market", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/identity/v1/oauth2/token")) {
      return new Response(JSON.stringify({
        access_token: "token-1",
        expires_in: 7200,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({
      total: 120,
      itemSummaries: [
        { itemId: "1", title: "DEWALT DCD996B", price: { value: "180", currency: "USD" }, shippingOptions: [{ shippingCost: { value: "0" } }] },
        { itemId: "2", title: "DEWALT DCD996B", price: { value: "200", currency: "USD" }, shippingOptions: [{ shippingCost: { value: "10" } }] },
        { itemId: "3", title: "DEWALT DCD996B", price: { value: "190", currency: "USD" }, shippingOptions: [{ shippingCost: { value: "5" } }] },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const provider = new EbayBrowseMarketProvider({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
  });

  const result = await provider.searchProduct({
    brand: "DEWALT",
    name: "20V Hammer Drill",
    identifiers: { manufacturerModel: "DCD996B" },
  });

  assert.equal(result.status, "available");
  assert.equal(result.evidenceType, "active_asking_market");
  assert.equal(result.validatedSoldPrice, false);
  assert.equal(result.medianAskingTotal, 195);
  assert.equal(result.totalMatchingEntries, 120);
  assert.equal(calls.length, 2);
});

test("unconfigured resale provider returns explicit unavailable evidence", async () => {
  const provider = new EbayBrowseMarketProvider();
  const result = await collectResaleMarketEvidence({ name: "Pool" }, provider);
  assert.equal(result.status, "unavailable");
  assert.equal(result.validatedSoldPrice, false);
});
