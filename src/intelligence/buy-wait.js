function median(values) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function pricedObservations(observations = []) {
  return observations
    .filter((o) => Number.isFinite(Number(o.price)) && o.observedAt)
    .map((o) => ({ ...o, price: Number(o.price), at: new Date(o.observedAt) }))
    .filter((o) => !Number.isNaN(o.at.getTime()))
    .sort((a, b) => a.at - b.at);
}

function percentileRank(values, value) {
  if (!values.length) return undefined;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return (below + equal * 0.5) / values.length;
}

export function evaluateBuyWait(observations = [], options = {}) {
  const priced = pricedObservations(observations);
  const minimumObservations = options.minimumObservations ?? 12;
  const minimumSpanDays = options.minimumSpanDays ?? 45;
  const maximumStalenessDays = options.maximumStalenessDays ?? 14;
  const now = options.now ? new Date(options.now) : new Date();

  const latest = priced.at(-1);
  const first = priced[0];

  const spanDays = latest && first
    ? (latest.at - first.at) / 86_400_000
    : 0;
  const stalenessDays = latest
    ? Math.max(0, (now - latest.at) / 86_400_000)
    : Infinity;

  const reasons = [];
  if (priced.length < minimumObservations) {
    reasons.push(`need at least ${minimumObservations} trusted priced observations; have ${priced.length}`);
  }
  if (spanDays < minimumSpanDays) {
    reasons.push(`need at least ${minimumSpanDays} days of history; have ${Math.floor(spanDays)}`);
  }
  if (stalenessDays > maximumStalenessDays) {
    reasons.push(`latest trusted price is ${Math.floor(stalenessDays)} days old`);
  }

  if (reasons.length) {
    return {
      decision: "insufficient_data",
      confidence: 0,
      reasons,
      metrics: {
        observationCount: priced.length,
        spanDays: Number(spanDays.toFixed(1)),
        stalenessDays: Number.isFinite(stalenessDays) ? Number(stalenessDays.toFixed(1)) : undefined,
        latestPrice: latest?.price,
        currency: latest?.currency,
      },
      model: {
        name: "historical-relative-value-v1",
        predictsFuturePrice: false,
        minimumObservations,
        minimumSpanDays,
        maximumStalenessDays,
      },
    };
  }

  const prices = priced.map((o) => o.price);
  const historicalMedian = median(prices);
  const percentile = percentileRank(prices, latest.price);

  const recentCount = Math.max(3, Math.min(6, Math.floor(priced.length / 3)));
  const recent = priced.slice(-recentCount).map((o) => o.price);
  const prior = priced.slice(0, -recentCount).map((o) => o.price);
  const recentMedian = median(recent);
  const priorMedian = median(prior.length ? prior : prices);

  const discountToMedian = historicalMedian
    ? (historicalMedian - latest.price) / historicalMedian
    : 0;
  const recentDirection = priorMedian
    ? (recentMedian - priorMedian) / priorMedian
    : 0;

  let decision = "fair";
  const rationale = [];

  if (percentile <= 0.25 && discountToMedian >= 0.08) {
    decision = "buy";
    rationale.push(
      `current price is in roughly the lowest ${Math.max(1, Math.round(percentile * 100))}% of trusted observations`
    );
    rationale.push(
      `current price is ${Math.round(discountToMedian * 100)}% below the historical median`
    );
  } else if (
    percentile >= 0.75 &&
    (discountToMedian <= -0.08 || recentDirection >= 0.05)
  ) {
    decision = "wait";
    rationale.push(
      `current price is in roughly the highest ${Math.round(percentile * 100)}% of trusted observations`
    );
    if (discountToMedian <= -0.08) {
      rationale.push(
        `current price is ${Math.round(Math.abs(discountToMedian) * 100)}% above the historical median`
      );
    }
    if (recentDirection >= 0.05) {
      rationale.push(
        `recent median pricing is ${Math.round(recentDirection * 100)}% above earlier observations`
      );
    }
  } else {
    rationale.push("current price is not unusually low or unusually high versus trusted history");
  }

  const sampleScore = clamp((priced.length - minimumObservations + 1) / 24);
  const spanScore = clamp((spanDays - minimumSpanDays + 1) / 180);
  const priceSignal = clamp(Math.abs(0.5 - percentile) * 2);
  const freshnessScore = clamp(1 - stalenessDays / maximumStalenessDays);
  const confidence = Number(
    clamp(0.35 + sampleScore * 0.2 + spanScore * 0.2 + priceSignal * 0.15 + freshnessScore * 0.1).toFixed(2)
  );

  return {
    decision,
    confidence,
    reasons: rationale,
    metrics: {
      observationCount: priced.length,
      spanDays: Number(spanDays.toFixed(1)),
      stalenessDays: Number(stalenessDays.toFixed(1)),
      latestPrice: latest.price,
      currency: latest.currency,
      historicalMedian: Number(historicalMedian.toFixed(2)),
      percentile: Number(percentile.toFixed(3)),
      discountToMedian: Number(discountToMedian.toFixed(3)),
      recentMedian: Number(recentMedian.toFixed(2)),
      priorMedian: Number(priorMedian.toFixed(2)),
      recentDirection: Number(recentDirection.toFixed(3)),
    },
    model: {
      name: "historical-relative-value-v1",
      predictsFuturePrice: false,
      minimumObservations,
      minimumSpanDays,
      maximumStalenessDays,
    },
  };
}
