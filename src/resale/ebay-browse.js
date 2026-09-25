const TOKEN_SCOPE = "https://api.ebay.com/oauth/api_scope";

function median(values) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class EbayBrowseMarketProvider {
  constructor(options = {}) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.marketplaceId = options.marketplaceId ?? "EBAY_US";
    this.apiBase = options.apiBase ?? "https://api.ebay.com";
    this.tokenBase = options.tokenBase ?? "https://api.ebay.com";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.token = undefined;
    this.tokenExpiresAt = 0;
  }

  configured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async getApplicationToken() {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 60_000) return this.token;
    if (!this.configured()) throw new Error("eBay client credentials are not configured");

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await this.fetchImpl(`${this.tokenBase}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: TOKEN_SCOPE,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`eBay OAuth failed (${response.status}): ${await response.text()}`);
    }

    const body = await response.json();
    this.token = body.access_token;
    this.tokenExpiresAt = now + Number(body.expires_in ?? 7200) * 1000;
    return this.token;
  }

  productQuery(product = {}) {
    const model = product.identifiers?.manufacturerModel || product.identifiers?.mpn;
    return [product.brand, model || product.name].filter(Boolean).join(" ").trim();
  }

  async searchProduct(product, options = {}) {
    const query = this.productQuery(product);
    if (!query) {
      return {
        source: "ebay_browse",
        status: "unavailable",
        reason: "product lacks searchable identity",
      };
    }

    const token = await this.getApplicationToken();
    const limit = Math.max(1, Math.min(200, Number(options.limit ?? 50)));
    const url = new URL(`${this.apiBase}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": this.marketplaceId,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`eBay Browse search failed (${response.status}): ${await response.text()}`);
    }

    const body = await response.json();
    const listings = (body.itemSummaries ?? []).map((item) => {
      const price = Number(item.price?.value);
      const shipping = Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0);
      return {
        source: "ebay_browse",
        itemId: item.itemId,
        title: item.title,
        condition: item.condition,
        itemWebUrl: item.itemWebUrl,
        price: Number.isFinite(price) ? price : undefined,
        shipping: Number.isFinite(shipping) ? shipping : undefined,
        askingTotal: Number.isFinite(price) ? price + (Number.isFinite(shipping) ? shipping : 0) : undefined,
        currency: item.price?.currency ?? "USD",
      };
    }).filter((item) => Number.isFinite(item.askingTotal));

    const totals = listings.map((item) => item.askingTotal);

    return {
      source: "ebay_browse",
      status: "available",
      query,
      marketplaceId: this.marketplaceId,
      listingCountReturned: listings.length,
      totalMatchingEntries: Number(body.total ?? listings.length),
      medianAskingTotal: totals.length ? Number(median(totals).toFixed(2)) : undefined,
      minAskingTotal: totals.length ? Number(Math.min(...totals).toFixed(2)) : undefined,
      maxAskingTotal: totals.length ? Number(Math.max(...totals).toFixed(2)) : undefined,
      currency: listings[0]?.currency ?? "USD",
      listings,
      evidenceType: "active_asking_market",
      validatedSoldPrice: false,
      liquidityValidated: false,
    };
  }
}
