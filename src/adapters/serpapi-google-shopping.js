import { RetailerAdapter } from "./types.js";

function stableListingId(result) {
  return result.product_id || result.immersive_product_page_token || result.product_link || result.title;
}

export class SerpApiGoogleShoppingAdapter extends RetailerAdapter {
  constructor({ apiKey, fetchImpl = globalThis.fetch } = {}) {
    super("google_shopping");
    if (!apiKey) throw new Error("SERPAPI_API_KEY is required");
    if (!fetchImpl) throw new Error("fetch implementation is required");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async search(query, context = {}) {
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      api_key: this.apiKey,
      gl: context.gl ?? "us",
      hl: context.hl ?? "en",
    });
    if (context.location) params.set("location", context.location);

    const response = await this.fetchImpl(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) {
      throw new Error(`SerpApi search failed (${response.status}): ${await response.text()}`);
    }

    const body = await response.json();
    const observedAt = new Date().toISOString();

    return (body.shopping_results ?? []).map((result) => ({
      listingId: String(stableListingId(result)),
      retailer: result.source ?? "unknown",
      source: "serpapi-google-shopping",
      sourceProductId: result.product_id ? String(result.product_id) : undefined,
      url: result.product_link,
      title: result.title,
      brand: undefined,
      identifiers: {},
      specifications: {},
      packageContents: [],
      imageEvidence: result.thumbnail
        ? [{ sourceUrl: result.thumbnail, provider: "serpapi" }]
        : [],
      observedAt,
      offer: {
        price: typeof result.extracted_price === "number" ? result.extracted_price : undefined,
        oldPrice: typeof result.extracted_old_price === "number" ? result.extracted_old_price : undefined,
        currency: context.currency ?? "USD",
        delivery: result.delivery,
        shippingAmount: /free\s+(shipping|delivery)/i.test(result.delivery ?? "") ? 0 : undefined,
        condition: result.second_hand_condition,
        promotion: result.tag,
      },
      providerMetadata: {
        position: result.position,
        rating: result.rating,
        reviews: result.reviews,
        multipleSources: result.multiple_sources,
        extensions: result.extensions ?? [],
      },
    }));
  }
}
