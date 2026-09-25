function median(values) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarizeHistory(observations = []) {
  const priced = observations
    .filter((o) => Number.isFinite(Number(o.price)))
    .map((o) => ({ ...o, price: Number(o.price) }));

  const prices = priced.map((o) => o.price);
  const latest = priced.at(-1);

  return {
    observationCount: observations.length,
    pricedObservationCount: priced.length,
    firstObservedAt: observations[0]?.observedAt,
    lastObservedAt: observations.at(-1)?.observedAt,
    latestPrice: latest?.price,
    latestCurrency: latest?.currency,
    minPrice: prices.length ? Math.min(...prices) : undefined,
    maxPrice: prices.length ? Math.max(...prices) : undefined,
    medianPrice: prices.length ? Number(median(prices).toFixed(2)) : undefined,
    sufficientForTrend: priced.length >= 8,
  };
}
