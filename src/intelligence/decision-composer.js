import { evaluateBuyWait } from "./buy-wait.js";
import { evaluateSeasonalityPrior } from "./seasonality-priors.js";

export function composePurchaseDecision({ product, observations = [], now } = {}) {
  const history = evaluateBuyWait(observations, { now });
  const seasonality = evaluateSeasonalityPrior(product, { now });

  if (history.decision !== "insufficient_data") {
    return {
      ...history,
      evidence: {
        productHistory: history,
        seasonality,
      },
      advisory: seasonality.status === "available"
        ? `Seasonality signal is ${seasonality.signal}, but trusted product history controls this decision.`
        : undefined,
      model: {
        ...history.model,
        composer: "product-history-first-v1",
      },
    };
  }

  if (seasonality.status !== "available" || seasonality.signal === "neutral") {
    return {
      ...history,
      evidence: {
        productHistory: history,
        seasonality,
      },
      model: {
        ...history.model,
        composer: "product-history-first-v1",
      },
    };
  }

  const decision = seasonality.signal === "favorable" ? "consider_buying" : "consider_waiting";
  return {
    decision,
    confidence: Math.min(0.45, seasonality.confidence),
    reasons: [
      ...history.reasons,
      seasonality.rationale,
      "This advisory is based on a category seasonality seed prior because product-specific history is insufficient.",
    ],
    metrics: history.metrics,
    evidence: {
      productHistory: history,
      seasonality,
    },
    model: {
      name: "seasonality-assisted-v1",
      composer: "product-history-first-v1",
      predictsFuturePrice: false,
      categoryPriorOnly: true,
    },
  };
}
