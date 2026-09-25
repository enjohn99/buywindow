# BuyWindow environment variables

BuyWindow reads configuration from environment variables. For local Docker development:

```bash
cp .env.example .env
```

Then fill in the required values below.

## Required for the core app

| Variable | Required | Feature | Purpose |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | Yes | Git-backed catalog | Reads and writes canonical products, observations, reviews, and reports in the BuyWindow GitHub repository. |
| `GITHUB_OWNER` | Yes | Git-backed catalog | GitHub username or organization that owns the canonical repository. |
| `GITHUB_REPO` | Yes | Git-backed catalog | Repository name used as BuyWindow's canonical database. The example file uses `buywindow`. |
| `SERPAPI_API_KEY` | Yes | Live shopping search | Cross-retailer Google Shopping discovery through SerpApi. |

Without all four values, live search is not considered ready.

## Optional configuration

| Variable | Default | Feature | Purpose |
| --- | --- | --- | --- |
| `GITHUB_BRANCH` | `main` | Git-backed catalog | Branch containing BuyWindow's canonical data. |
| `BUYWINDOW_REVIEW_ISSUES` | `true` in `.env.example` | Human review | When `true`, ambiguous identity cases also create GitHub issues. |
| `BUYWINDOW_LOCATION` | none | Search | Default search location, for example `Austin, Texas`. |
| `BUYWINDOW_GL` | `us` | Search | Google country code used by live shopping discovery. |
| `BUYWINDOW_HL` | `en` | Search | Google language code used by live shopping discovery. |
| `BUYWINDOW_API_KEY` | none | HTTP API | Optional bearer token protecting `/v1/*`. Recommended for hosted deployments. |
| `PORT` | `8080` | HTTP API | HTTP listen port. |
| `BUYWINDOW_TAX_MAX_RESULTS` | `10` | Landed cost | Maximum number of per-search tax calculations. |
| `BUYWINDOW_IMAGE_HASHING` | `false` | Product enrichment | When `true`, downloads listing images and stores SHA-256 evidence for exact visual identity matching. |
| `EBAY_CLIENT_ID` | none | eBay market evidence | eBay application client ID. |
| `EBAY_CLIENT_SECRET` | none | eBay market evidence | eBay application client secret. Keep server-side only. |
| `EBAY_MARKETPLACE_ID` | `EBAY_US` | eBay market evidence | eBay marketplace used for Browse API searches. |

## Check readiness

Run:

```bash
npm run health
```

or in Docker:

```bash
docker compose run --rm buywindow src/cli/health.js
```

The health output reports each feature separately. An optional feature can be disabled while the overall core app is still healthy.

Minimal `.env`:

```dotenv
GITHUB_TOKEN=...
GITHUB_OWNER=...
GITHUB_REPO=buywindow
SERPAPI_API_KEY=...
```

That is enough for the core search/catalog workflow.

See `.env.example` for every supported variable. Do not commit a real `.env` file or secrets.
