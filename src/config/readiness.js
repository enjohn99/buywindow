export const BUYWINDOW_VERSION = "0.12.1";

export const ENVIRONMENT_VARIABLES = [
  {
    name: "GITHUB_TOKEN",
    required: true,
    feature: "Git-backed catalog",
    purpose: "Read and write canonical products, observations, reviews, and reports in GitHub.",
    defaultValue: undefined,
  },
  {
    name: "GITHUB_OWNER",
    required: true,
    feature: "Git-backed catalog",
    purpose: "GitHub owner or organization containing the canonical BuyWindow repository.",
    defaultValue: undefined,
  },
  {
    name: "GITHUB_REPO",
    required: true,
    feature: "Git-backed catalog",
    purpose: "GitHub repository used as the canonical BuyWindow database.",
    defaultValue: "buywindow",
  },
  {
    name: "SERPAPI_API_KEY",
    required: true,
    feature: "Live shopping search",
    purpose: "Cross-retailer Google Shopping discovery through SerpApi.",
    defaultValue: undefined,
  },
  {
    name: "GITHUB_BRANCH",
    required: false,
    feature: "Git-backed catalog",
    purpose: "Branch containing canonical BuyWindow data.",
    defaultValue: "main",
  },
  {
    name: "BUYWINDOW_REVIEW_ISSUES",
    required: false,
    feature: "Human review",
    purpose: "Create human-facing GitHub issues for ambiguous product identity reviews.",
    defaultValue: "true",
  },
  {
    name: "BUYWINDOW_LOCATION",
    required: false,
    feature: "Live shopping search",
    purpose: "Default shopping-search location.",
    defaultValue: undefined,
  },
  {
    name: "BUYWINDOW_GL",
    required: false,
    feature: "Live shopping search",
    purpose: "Default Google country code for shopping search.",
    defaultValue: "us",
  },
  {
    name: "BUYWINDOW_HL",
    required: false,
    feature: "Live shopping search",
    purpose: "Default Google language code for shopping search.",
    defaultValue: "en",
  },
  {
    name: "BUYWINDOW_API_KEY",
    required: false,
    feature: "HTTP API",
    purpose: "Bearer token protecting /v1/* endpoints. Recommended for hosted deployments.",
    defaultValue: undefined,
  },
  {
    name: "PORT",
    required: false,
    feature: "HTTP API",
    purpose: "HTTP server port.",
    defaultValue: "8080",
  },
  {
    name: "BUYWINDOW_TAX_MAX_RESULTS",
    required: false,
    feature: "Landed cost",
    purpose: "Maximum tax calculations attempted per search.",
    defaultValue: "10",
  },
  {
    name: "EBAY_CLIENT_ID",
    required: false,
    feature: "eBay market evidence",
    purpose: "eBay application client ID for active resale-market evidence.",
    defaultValue: undefined,
  },
  {
    name: "EBAY_CLIENT_SECRET",
    required: false,
    feature: "eBay market evidence",
    purpose: "eBay application client secret. Keep server-side only.",
    defaultValue: undefined,
  },
  {
    name: "EBAY_MARKETPLACE_ID",
    required: false,
    feature: "eBay market evidence",
    purpose: "eBay marketplace used for Browse API searches.",
    defaultValue: "EBAY_US",
  },
];

export function getReadiness(env = process.env) {
  const required = ENVIRONMENT_VARIABLES.filter((entry) => entry.required);
  const missingRequired = required
    .filter((entry) => !env[entry.name] && entry.defaultValue === undefined)
    .map((entry) => entry.name);

  const githubReady = Boolean(env.GITHUB_TOKEN && env.GITHUB_OWNER && (env.GITHUB_REPO || "buywindow"));
  const searchReady = githubReady && Boolean(env.SERPAPI_API_KEY);
  const ebayCredentials = [Boolean(env.EBAY_CLIENT_ID), Boolean(env.EBAY_CLIENT_SECRET)];
  const ebayPartiallyConfigured = ebayCredentials.some(Boolean) && !ebayCredentials.every(Boolean);
  const ebayMarketReady = ebayCredentials.every(Boolean);

  return {
    status: missingRequired.length ? "degraded" : "ok",
    service: "buywindow",
    version: BUYWINDOW_VERSION,
    missingRequired,
    features: {
      github: {
        ready: githubReady,
        required: true,
        missing: ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"].filter(
          (name) => !env[name] && !(name === "GITHUB_REPO")
        ),
      },
      search: {
        ready: searchReady,
        required: true,
        missing: [
          ...["GITHUB_TOKEN", "GITHUB_OWNER"].filter((name) => !env[name]),
          ...(!env.SERPAPI_API_KEY ? ["SERPAPI_API_KEY"] : []),
        ],
      },
      humanReviewIssues: {
        enabled: env.BUYWINDOW_REVIEW_ISSUES === "true",
        ready: githubReady,
      },
      apiAuth: {
        enabled: Boolean(env.BUYWINDOW_API_KEY),
        recommendedForHostedDeployments: true,
      },
      landedCost: {
        ready: true,
        taxCalculationLimit: Number(env.BUYWINDOW_TAX_MAX_RESULTS ?? 10),
      },
      ebayMarketEvidence: {
        enabled: ebayCredentials.some(Boolean),
        ready: ebayMarketReady,
        partiallyConfigured: ebayPartiallyConfigured,
        missing: ebayMarketReady
          ? []
          : ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"].filter((name) => !env[name]),
        marketplaceId: env.EBAY_MARKETPLACE_ID ?? "EBAY_US",
      },
    },
  };
}
