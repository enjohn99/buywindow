const OREGON_POLICY = {
  state: "OR",
  country: "US",
  appliesTo: "general_tangible_goods",
  source: "Oregon Department of Revenue",
  sourceUrl: "https://www.oregon.gov/dor/programs/businesses/Pages/sales-tax.aspx",
  note: "Oregon has no general sales or use/transaction tax. Special taxes may still apply to some categories.",
};

export class JurisdictionRulesTaxProvider {
  constructor() {
    this.name = "jurisdiction-rules";
  }

  canCalculate({ destination, taxCategory = "general_tangible_goods" }) {
    return (
      destination?.country?.toUpperCase() === "US" &&
      destination?.state?.toUpperCase() === "OR" &&
      taxCategory === OREGON_POLICY.appliesTo
    );
  }

  async calculate({
    amount,
    currency = "USD",
    destination,
    shippingAmount = 0,
    taxCategory = "general_tangible_goods",
  }) {
    if (!this.canCalculate({ destination, taxCategory })) {
      return {
        status: "unavailable",
        provider: this.name,
        reason: "no maintained jurisdiction rule applies",
      };
    }

    return {
      status: "estimated",
      provider: this.name,
      taxAmount: 0,
      amountTotal: Number((Number(amount) + Number(shippingAmount || 0)).toFixed(2)),
      currency,
      source: "official-jurisdiction-rule",
      confidence: "high",
      jurisdiction: "Oregon",
      policy: OREGON_POLICY,
    };
  }
}

export { OREGON_POLICY };
