import { GitHubCatalogStore } from "../storage/github.js";
import { resolveReview } from "../engine/review-resolver.js";

function usage() {
  console.log(`
Usage:
  node src/cli/review.js show <review-id>
  node src/cli/review.js resolve <review-id> <action> [product-id]

Actions:
  same_product
  variant
  new_product
  alternative
  reject

Optional environment values for new/variant products:
  BUYWINDOW_REVIEW_BRAND
  BUYWINDOW_REVIEW_NAME
`);
}

const required = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`${key} is required`);
    process.exit(1);
  }
}

const catalog = new GitHubCatalogStore({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH ?? "main",
});

const [command, reviewId, action, productId] = process.argv.slice(2);

if (!command || !reviewId) {
  usage();
  process.exit(1);
}

if (command === "show") {
  const review = await catalog.getReview(reviewId);
  if (!review) {
    console.error(`Review not found: ${reviewId}`);
    process.exit(1);
  }
  console.log(JSON.stringify(review, null, 2));
  process.exit(0);
}

if (command !== "resolve" || !action) {
  usage();
  process.exit(1);
}

const resolved = await resolveReview({
  catalog,
  reviewId,
  action,
  productId,
  reviewer: process.env.BUYWINDOW_REVIEWER || "human",
  note: process.env.BUYWINDOW_REVIEW_NOTE,
  overrides: {
    brand: process.env.BUYWINDOW_REVIEW_BRAND,
    name: process.env.BUYWINDOW_REVIEW_NAME,
  },
});

console.log(JSON.stringify(resolved, null, 2));
