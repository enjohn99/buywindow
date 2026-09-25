import test from "node:test";
import assert from "node:assert/strict";
import { enrichListing, listingEnrichmentInternals } from "../src/enrichment/listing-enricher.js";

test("infers brand and manufacturer model from listing title", async () => {
  const listing = {
    listingId: "1",
    retailer: "Demo",
    source: "demo",
    url: "https://example.com",
    title: "DEWALT DCD996B 20V MAX XR Hammer Drill",
    identifiers: {},
    imageEvidence: [],
    observedAt: new Date().toISOString(),
  };
  const enriched = await enrichListing(listing, { hashImages: false });
  assert.equal(enriched.brand, "Dewalt");
  assert.equal(enriched.identifiers.manufacturerModel, "DCD996B");
  assert.equal(enriched.enrichment.modelInferred, true);
});

test("extracts explicitly labeled UPC", () => {
  assert.deepEqual(
    listingEnrichmentInternals.detectBarcode("Widget UPC 012345678905"),
    { upc: "012345678905", gtin: "012345678905" }
  );
});

test("hashes image bytes without blocking on provider-specific metadata", async () => {
  const fetchImpl = async () => new Response(Buffer.from("same-image"), { status: 200 });
  const enriched = await enrichListing({
    title: "Demo",
    identifiers: {},
    imageEvidence: [{ sourceUrl: "https://example.com/image.jpg" }],
  }, { fetchImpl });
  assert.equal(enriched.imageEvidence[0].sha256.length, 64);
  assert.equal(enriched.imageEvidence[0].byteLength, 10);
});

test("image hash failures are recorded and non-fatal", async () => {
  const fetchImpl = async () => new Response("no", { status: 503 });
  const enriched = await enrichListing({
    title: "Demo",
    identifiers: {},
    imageEvidence: [{ sourceUrl: "https://example.com/image.jpg" }],
  }, { fetchImpl });
  assert.match(enriched.imageEvidence[0].enrichmentError, /503/);
});
