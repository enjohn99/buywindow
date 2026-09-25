const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export const SEASONALITY_PRIORS = [
  {
    id: "above-ground-pools-v1",
    category: "above_ground_pools",
    sourceType: "seed",
    confidence: 0.45,
    match: ["above ground pool", "above-ground pool", "intex pool", "bestway pool"],
    favorableBuyMonths: [8, 9, 10, 11, 12, 1, 2],
    unfavorableBuyMonths: [5, 6, 7],
    rationale: "Seed prior: seasonal pool inventory often faces stronger clearance pressure after peak summer demand.",
  },
  {
    id: "patio-furniture-v1",
    category: "patio_furniture",
    sourceType: "seed",
    confidence: 0.4,
    match: ["patio furniture", "outdoor furniture", "patio set", "outdoor dining set"],
    favorableBuyMonths: [8, 9, 10, 11],
    unfavorableBuyMonths: [4, 5, 6],
    rationale: "Seed prior: outdoor furniture commonly transitions toward clearance after the main warm-weather selling season.",
  },
  {
    id: "portable-air-conditioners-v1",
    category: "portable_air_conditioners",
    sourceType: "seed",
    confidence: 0.4,
    match: ["portable air conditioner", "portable ac", "window air conditioner", "window ac"],
    favorableBuyMonths: [9, 10, 11, 12, 1, 2],
    unfavorableBuyMonths: [5, 6, 7, 8],
    rationale: "Seed prior: cooling equipment demand is typically strongest during hot-weather months and softer off-season.",
  },
  {
    id: "space-heaters-v1",
    category: "space_heaters",
    sourceType: "seed",
    confidence: 0.4,
    match: ["space heater", "electric heater", "portable heater"],
    favorableBuyMonths: [3, 4, 5, 6, 7, 8],
    unfavorableBuyMonths: [11, 12, 1, 2],
    rationale: "Seed prior: portable heating demand is typically strongest during colder months and softer after winter.",
  },
  {
    id: "lawn-mowers-v1",
    category: "lawn_mowers",
    sourceType: "seed",
    confidence: 0.4,
    match: ["lawn mower", "push mower", "riding mower", "zero turn mower"],
    favorableBuyMonths: [8, 9, 10, 11, 12, 1],
    unfavorableBuyMonths: [3, 4, 5, 6],
    rationale: "Seed prior: lawn equipment often has stronger demand during spring and early summer than late-season/off-season periods.",
  },
  {
    id: "generators-v1",
    category: "generators",
    sourceType: "seed",
    confidence: 0.3,
    match: ["generator", "portable generator", "inverter generator"],
    favorableBuyMonths: [],
    unfavorableBuyMonths: [],
    rationale: "Seed prior intentionally neutral: generator demand can be event-driven by storms and outages, so calendar-only seasonality is unreliable.",
  },
];

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function productText(product = {}) {
  return normalize([
    product.brand,
    product.name,
    ...(product.categoryPath ?? []),
    product.identifiers?.manufacturerModel,
  ].filter(Boolean).join(" "));
}

export function findSeasonalityPrior(product = {}) {
  const text = productText(product);
  let best;
  let bestLength = 0;

  for (const prior of SEASONALITY_PRIORS) {
    for (const phrase of prior.match) {
      const normalized = normalize(phrase);
      if (text.includes(normalized) && normalized.length > bestLength) {
        best = prior;
        bestLength = normalized.length;
      }
    }
  }

  return best;
}

export function evaluateSeasonalityPrior(product, options = {}) {
  const prior = findSeasonalityPrior(product);
  if (!prior) {
    return {
      status: "unavailable",
      sourceType: "seed",
      reason: "no matching seasonality prior",
    };
  }

  const now = options.now ? new Date(options.now) : new Date();
  const month = now.getUTCMonth() + 1;

  let signal = "neutral";
  if (prior.favorableBuyMonths.includes(month)) signal = "favorable";
  if (prior.unfavorableBuyMonths.includes(month)) signal = "unfavorable";

  return {
    status: "available",
    signal,
    month,
    category: prior.category,
    priorId: prior.id,
    sourceType: prior.sourceType,
    confidence: prior.confidence,
    rationale: prior.rationale,
    favorableBuyMonths: prior.favorableBuyMonths,
    unfavorableBuyMonths: prior.unfavorableBuyMonths,
    learnedFromBuyWindowData: false,
  };
}
