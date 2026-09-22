const requiredForSearch = [
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPO",
  "SERPAPI_API_KEY",
];

const missing = requiredForSearch.filter((key) => !process.env[key]);

const result = {
  status: missing.length ? "degraded" : "ok",
  service: "buywindow",
  version: "0.3.0",
  searchReady: missing.length === 0,
  missing,
};

console.log(JSON.stringify(result));

process.exit(missing.length ? 1 : 0);
