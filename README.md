# BuyWindow

**Know when, where, and what to buy.**

BuyWindow is a Git-backed product intelligence engine. The first version focuses on building a trustworthy, versioned catalog of physical products and retailer observations that can later power Buy/Wait recommendations, local price intelligence, and arbitrage discovery.

## Why this architecture

A retailer listing is not the same thing as a product. BuyWindow resolves listings into a canonical product identity using model numbers, UPC/GTIN, brand, descriptions, specifications, package contents, and image evidence. High-confidence matches can be accepted automatically. Ambiguous matches are escalated for human review before they can pollute trusted history.

GitHub is the canonical data store for the MVP. Product records and observations are versioned, reviewable, and auditable.

## MVP flow

```text
search / retailer adapter
        ↓
normalized retailer listing
        ↓
identity matcher
        ↓
┌─────────────────┬──────────────────┬─────────────────┐
│ auto match      │ human review     │ new / reject    │
│ confidence ≥ .92│ .70 ≤ score < .92│ score < .70     │
└─────────────────┴──────────────────┴─────────────────┘
        ↓
Git-backed catalog + append-only observations
```

## Data layout

```text
catalog/<brand>/<product-id>/product.json
catalog/<brand>/<product-id>/listings/<retailer>-<listing-id>.json
catalog/<brand>/<product-id>/observations/YYYY/MM.jsonl
reviews/pending/<review-id>.json
```

## Run locally

```bash
npm test
npm run demo
```

## Core principles

- exact identifiers beat fuzzy text matches
- conflicting hard identifiers prevent auto-merges
- bundle/variant differences are first-class, not ignored
- observations are append-only whenever practical
- uncertain identity decisions require human review
- every match stores evidence and a confidence score
- retailer adapters should prefer supported/authorized data access and respect site terms

## Licensing

The licensing strategy is intentionally not finalized in v0.1. The planned model is a community edition plus a hosted commercial service; see `docs/LICENSING.md` before public distribution.


## Docker

Build the local image:

```bash
docker compose build
```

Create your environment file:

```bash
cp .env.example .env
```

Fill in the required values in `.env`, then verify readiness:

```bash
docker compose run --rm buywindow src/cli/health.js
```

Run a live product search:

```bash
docker compose run --rm buywindow src/cli/search.js "DEWALT DCD996B"
```

The container image is intentionally stateless. Canonical product data, discovery snapshots, review records, and observations are persisted to the configured GitHub repository.


## Human review

Ambiguous matches, variants, and unresolved new products are stored under `reviews/pending/`. When `BUYWINDOW_REVIEW_ISSUES=true`, BuyWindow also creates a GitHub issue with the evidence for a human decision.

Inspect a review:

```bash
docker compose run --rm buywindow src/cli/review.js show <review-id>
```

Resolve it:

```bash
docker compose run --rm buywindow src/cli/review.js resolve <review-id> same_product <product-id>
docker compose run --rm buywindow src/cli/review.js resolve <review-id> variant
docker compose run --rm buywindow src/cli/review.js resolve <review-id> new_product
docker compose run --rm buywindow src/cli/review.js resolve <review-id> alternative <related-product-id>
docker compose run --rm buywindow src/cli/review.js resolve <review-id> reject
```

A resolved review is moved to `reviews/resolved/`. Approved same-product, variant, and new-product decisions update the canonical catalog and add the observed offer to trusted price history when a price is available.
