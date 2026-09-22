import { SerpApiGoogleShoppingAdapter } from "../adapters/serpapi-google-shopping.js";
import { runDiscovery } from "../engine/discovery.js";
import { canonicalizeDiscovery } from "../engine/canonicalize-discovery.js";
import { GitHubCatalogStore } from "../storage/github.js";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error('Usage: npm run search -- "product query"');
  process.exit(1);
}

const required = ["SERPAPI_API_KEY", "GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`${key} is required`);
    process.exit(1);
  }
}

const adapter = new SerpApiGoogleShoppingAdapter({
  apiKey: process.env.SERPAPI_API_KEY,
});

const catalog = new GitHubCatalogStore({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH ?? "main",
});

const snapshot = await runDiscovery({
  adapter,
  query,
  context: {
    location: process.env.BUYWINDOW_LOCATION || undefined,
    gl: process.env.BUYWINDOW_GL || "us",
    hl: process.env.BUYWINDOW_HL || "en",
  },
  catalog,
});

const canonicalization = await canonicalizeDiscovery({ snapshot, catalog });

console.log(JSON.stringify({
  search: {
    searchId: snapshot.searchId,
    query: snapshot.query,
    resultCount: snapshot.resultCount,
  },
  canonicalization: {
    summary: canonicalization.summary,
    canonicalizedAt: canonicalization.canonicalizedAt,
  },
}, null, 2));
