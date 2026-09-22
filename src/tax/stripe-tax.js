function cents(amount) {
  return Math.round(Number(amount) * 100);
}

function dollars(amount) {
  return Number((Number(amount) / 100).toFixed(2));
}

function appendAddress(params, prefix, address = {}) {
  const mappings = {
    line1: "line1",
    line2: "line2",
    city: "city",
    state: "state",
    postalCode: "postal_code",
    country: "country",
  };
  for (const [key, apiKey] of Object.entries(mappings)) {
    if (address[key]) params.set(`${prefix}[${apiKey}]`, address[key]);
  }
}

export class StripeTaxProvider {
  constructor({ secretKey, fetchImpl = globalThis.fetch, apiBase = "https://api.stripe.com" } = {}) {
    if (!secretKey) throw new Error("Stripe secret key is required");
    if (!fetchImpl) throw new Error("fetch implementation is required");
    this.secretKey = secretKey;
    this.fetchImpl = fetchImpl;
    this.apiBase = apiBase;
    this.name = "stripe-tax";
  }

  canCalculate({ destination }) {
    if (!destination?.country) return false;
    if (destination.country.toUpperCase() === "US" && !destination.postalCode) return false;
    return true;
  }

  async calculate({
    amount,
    currency = "USD",
    destination,
    shippingAmount = 0,
    taxCode = "txcd_99999999",
    reference = "buywindow-offer",
    fulfillment = "shipping",
  }) {
    if (!this.canCalculate({ destination })) {
      return {
        status: "unavailable",
        provider: this.name,
        reason: "destination is incomplete for tax calculation",
      };
    }

    const params = new URLSearchParams();
    params.set("currency", currency.toLowerCase());
    appendAddress(params, "customer_details[address]", {
      ...destination,
      country: destination.country.toUpperCase(),
    });
    params.set(
      "customer_details[address_source]",
      fulfillment === "shipping" ? "shipping" : "billing"
    );
    params.set("line_items[0][amount]", String(cents(amount)));
    params.set("line_items[0][tax_code]", taxCode);
    params.set("line_items[0][reference]", reference);
    params.set("line_items[0][tax_behavior]", "exclusive");
    if (Number(shippingAmount) > 0) {
      params.set("shipping_cost[amount]", String(cents(shippingAmount)));
      params.set("shipping_cost[tax_behavior]", "exclusive");
    }

    const response = await this.fetchImpl(`${this.apiBase}/v1/tax/calculations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        provider: this.name,
        reason: `Stripe Tax failed (${response.status}): ${await response.text()}`,
      };
    }

    const body = await response.json();
    return {
      status: "estimated",
      provider: this.name,
      taxAmount: dollars(body.tax_amount_exclusive ?? 0),
      amountTotal: dollars(body.amount_total),
      calculationId: body.id,
      currency: String(body.currency || currency).toUpperCase(),
      taxCode,
      source: "tax-engine",
      confidence: "high",
    };
  }
}
