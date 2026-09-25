import { SerpApiGoogleShoppingAdapter } from "../adapters/serpapi-google-shopping.js";
import { GitHubCatalogStore } from "../storage/github.js";
import { GitHubIssueReviewQueue } from "../review/github-issues.js";
import { collectWatchlist } from "../watchlist/service.js";
import { getReadiness } from "../config/readiness.js";

const readiness = getReadiness(process.env);
if (!readiness.features.search.ready) {
  console.error(JSON.stringify({
    status: "skipped",
    reason: "watchlist collection requires search readiness",
    missing: readiness.features.search.missing,
  }, null, 2));
  process.exit(process.env.BUYWINDOW_COLLECTOR_ALLOW_SKIP === "true" ? 0 : 1);
}

const catalog = new GitHubCatalogStore({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH ?? "main",
});

const adapter = new SerpApiGoogleShoppingAdapter({
  apiKey: process.env.SERPAPI_API_KEY,
});

const reviewQueue = process.env.BUYWINDOW_REVIEW_ISSUES === "true"
  ? new GitHubIssueReviewQueue({
      token: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
    })
  : undefined;

const result = await collectWatchlist({
  catalog,
  adapter,
  reviewQueue,
  defaultLocation: process.env.BUYWINDOW_LOCATION,
  enrichment: {
    hashImages: process.env.BUYWINDOW_IMAGE_HASHING === "true",
  },
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.errorCount ? 1 : 0);
