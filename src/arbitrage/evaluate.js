function median(values) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function priced(observations = []) {
  return observations
    .filter((o) => Number.isFinite(Number(o.price)) && o.observedAt)
    .map((o) => ({ ...o, price: Number(o.price), at: new Date(o.observedAt) }))
    .filter((o) => !Number.isNaN(o.at.getTime()))
    .sort((a, b) => a.at - b.at);
}

export function evaluateArbitrageCandidate(product, observations = [], options = {}) {
  const rows = priced(observations);
  const minimumObservations = options.minimumObservations ?? 12;
  const minimumSpanDays = options.minimumSpanDays ?? 45;
  const minimumNetRoi = options.minimumNetRoi ?? 0.25;
  const feeRate = options.feeRate ?? 0.15;
  const fixedCosts = options.fixedCosts ?? 0;
  const latest = rows.at(-1);
  const first = rows[0];

  if (!latest) {
    return {
      status: "insufficient_data",
      reasons: ["no trusted priced observations"],
      productId: product?.productId,
    };
  }

  const spanDays = first ? (latest.at - first.at) / 86_400_000 : 0;
  const reasons = [];
  if (rows.length < minimumObservations) {
    reasons.push(`need at least ${minimumObservations} trusted priced observations; have ${rows.length}`);
  }
  if (spanDays < minimumSpanDays) {
    reasons.push(`need at least ${minimumSpanDays} days of history; have ${Math.floor(spanDays)}`);
  }

  if (reasons.length) {
    return {
      status: "insufficient_data",
      reasons,
      productId: product?.productId,
      acquisitionPrice: latest.price,
      currency: latest.currency ?? "USD",
      metrics: {
        observationCount: rows.length,
        spanDays: Number(spanDays.toFixed(1)),
      },
    };
  }

  const historicalMedian = median(rows.map((o) => o.price));
  const grossSpread = historicalMedian - latest.price;
  const grossRoi = latest.price > 0 ? grossSpread / latest.price : 0;
  const estimatedFees = historicalMedian * feeRate + fixedCosts;
  const netSpreadBenchmark = historicalMedian - estimatedFees - latest.price;
  const netRoiBenchmark = latest.price > 0 ? netSpreadBenchmark / latest.price : 0;

  const qualifies = grossSpread > 0 && netRoiBenchmark >= minimumNetRoi;

  return {
    status: qualifies ? "candidate" : "not_candidate",
    productId: product?.productId,
    brand: product?.brand,
    name: product?.name,
    acquisitionPrice: latest.price,
    acquisitionObservedAt: latest.observedAt,
    acquisitionRetailer: latest.retailer,
    currency: latest.currency ?? "USD",
    benchmark: {
      type: "trusted_historical_retail_median",
      value: Number(historicalMedian.toFixed(2)),
      validatedResaleMarket: false,
    },
    economics: {
      grossSpread: Number(grossSpread.toFixed(2)),
      grossRoi: Number(grossRoi.toFixed(3)),
      assumedFeeRate: feeRate,
      fixedCosts,
      estimatedFees: Number(estimatedFees.toFixed(2)),
      netSpreadBenchmark: Number(netSpreadBenchmark.toFixed(2)),
      netRoiBenchmark: Number(netRoiBenchmark.toFixed(3)),
    },
    thresholds: {
      minimumObservations,
      minimumSpanDays,
      minimumNetRoi,
    },
    evidence: {
      observationCount: rows.length,
      spanDays: Number(spanDays.toFixed(1)),
      firstObservedAt: first?.observedAt,
      latestObservedAt: latest.observedAt,
    },
    caveats: [
      "Historical retail median is a benchmark, not a guaranteed resale price.",
      "Resale demand, marketplace liquidity, taxes, shipping, storage, returns, and condition are not yet validated.",
    ],
  };
}

export async function scanArbitrageOpportunities(catalog, options = {}) {
  const products = await catalog.listCanonicalProducts();
  const opportunities = [];

  for (const product of products) {
    const observations = await catalog.getProductHistory(product.productId, {
      limit: options.historyLimit ?? 2000,
    });
    const result = evaluateArbitrageCandidate(product, observations ?? [], options);
    if (result.status === "candidate") {
      if (options.resaleProvider && opportunities.length < (options.marketEvidenceLimit ?? 10)) {
        try {
          result.resaleMarket = await options.resaleProvider.searchProduct(product, {
            limit: options.marketListingLimit ?? 50,
          });
        } catch (error) {
          result.resaleMarket = {
            status: "error",
            provider: "ebay_browse",
            reason: String(error),
            evidenceType: "active_asking_market",
            validatedSoldPrice: false,
          };
        }
      }
      opportunities.push(result);
    }
  }

  opportunities.sort((a, b) => b.economics.netRoiBenchmark - a.economics.netRoiBenchmark);
  return opportunities;
}
