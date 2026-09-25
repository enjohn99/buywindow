function money(value) {
  if (value == null || Number.isNaN(Number(value))) return undefined;
  return Number(Number(value).toFixed(2));
}

export async function calculateLandedCost({
  listing,
  destination,
  fulfillment = "shipping",
  taxProviders = [],
  taxCode = "txcd_99999999",
  taxCategory = "general_tangible_goods",
}) {
  const listedPrice = money(listing.offer?.price);
  if (listedPrice == null) {
    return {
      status: "unavailable",
      reason: "listing has no numeric price",
      listingId: listing.listingId,
    };
  }

  const shippingAmount = money(listing.offer?.shippingAmount);
  const knownShipping = shippingAmount != null;
  const shipping = shippingAmount ?? 0;

  let tax;
  if (listing.offer?.taxAmount != null) {
    tax = {
      status: "observed",
      provider: "retailer",
      taxAmount: money(listing.offer.taxAmount),
      source: "retailer-observed",
      confidence: "highest",
    };
  } else {
    for (const provider of taxProviders) {
      if (provider.canCalculate && !provider.canCalculate({ destination, taxCategory, listing, fulfillment })) continue;
      const candidate = await provider.calculate({
        amount: listedPrice,
        currency: listing.offer?.currency ?? "USD",
        destination,
        shippingAmount: shipping,
        taxCode,
        taxCategory,
        reference: `${listing.retailer}:${listing.listingId}`,
        fulfillment,
      });
      if (candidate?.status !== "unavailable") {
        tax = candidate;
        break;
      }
    }
  }

  tax ??= {
    status: "unavailable",
    provider: "none",
    taxAmount: undefined,
    source: "unknown",
    confidence: "unknown",
  };

  const taxAmount = money(tax.taxAmount);
  const knownTax = taxAmount != null;
  const landedCost = knownTax && knownShipping
    ? money(listedPrice + shipping + taxAmount)
    : undefined;

  return {
    status: landedCost != null ? "complete" : "partial",
    listingId: listing.listingId,
    retailer: listing.retailer,
    listedPrice,
    shippingAmount: knownShipping ? shipping : undefined,
    tax,
    landedCost,
    currency: listing.offer?.currency ?? "USD",
    fulfillment,
    destination,
    completeness: {
      price: true,
      shipping: knownShipping,
      tax: knownTax,
    },
  };
}

export function rankByLandedCost(items) {
  return [...items].sort((a, b) => {
    const aComplete = a.landedCost != null;
    const bComplete = b.landedCost != null;
    if (aComplete !== bComplete) return aComplete ? -1 : 1;
    if (aComplete && bComplete) return a.landedCost - b.landedCost;
    return (a.listedPrice ?? Infinity) - (b.listedPrice ?? Infinity);
  });
}
