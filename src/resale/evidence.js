export async function collectResaleMarketEvidence(product, provider, options = {}) {
  if (!provider?.configured?.()) {
    return {
      status: "unavailable",
      provider: "ebay_browse",
      reason: "provider not configured",
      evidenceType: "active_asking_market",
      validatedSoldPrice: false,
    };
  }

  try {
    return await provider.searchProduct(product, options);
  } catch (error) {
    return {
      status: "error",
      provider: "ebay_browse",
      reason: String(error),
      evidenceType: "active_asking_market",
      validatedSoldPrice: false,
    };
  }
}
