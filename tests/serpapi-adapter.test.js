import test from "node:test";
import assert from "node:assert/strict";
import { SerpApiGoogleShoppingAdapter } from "../src/adapters/serpapi-google-shopping.js";

test("normalizes Google Shopping results", async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          shopping_results: [
            {
              position: 1,
              title: "Example Drill",
              product_id: "123",
              product_link: "https://example.com/product/123",
              source: "Example Store",
              extracted_price: 99.99,
              extracted_old_price: 129.99,
              delivery: "Free delivery",
              thumbnail: "https://example.com/image.jpg",
              rating: 4.7,
              reviews: 42
            }
          ]
        };
      }
    };
  };

  const adapter = new SerpApiGoogleShoppingAdapter({ apiKey: "test-key", fetchImpl });
  const [listing] = await adapter.search("example drill", { location: "Austin, Texas" });

  assert.match(requestedUrl, /engine=google_shopping/);
  assert.match(requestedUrl, /Austin/);
  assert.equal(listing.retailer, "Example Store");
  assert.equal(listing.offer.price, 99.99);
  assert.equal(listing.sourceProductId, "123");
  assert.equal(listing.imageEvidence.length, 1);
});
