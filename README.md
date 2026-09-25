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


## HTTP API

BuyWindow now runs as an HTTP service by default in Docker:

```bash
docker compose up --build
```

Health check:

```bash
curl http://localhost:8080/health
```

Search:

```bash
curl -X POST http://localhost:8080/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUYWINDOW_API_KEY" \
  -d '{"query":"DEWALT DCD996B","location":"Austin, Texas"}'
```

See `docs/API.md` and `openapi.yaml` for the API contract.


## Tax-aware landed cost

BuyWindow can compare the cost that matters: the amount to actually acquire the item.

```
landed cost = listed price + known shipping/freight + tax
```

Tax is never silently guessed. Retailer-observed checkout tax wins when available; otherwise BuyWindow can use maintained jurisdiction rules or future pluggable tax providers. Oregon general tangible goods are currently supported as an official-rule fallback for the state's lack of a general sales/use transaction tax. Special product categories remain unresolved unless explicit tax evidence is available.

Example request:

```bash
curl -X POST http://localhost:8080/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUYWINDOW_API_KEY" \
  -d '{
    "query":"DEWALT DCD996B",
    "destination":{"city":"Portland","state":"OR","postalCode":"97205","country":"US"},
    "fulfillment":"shipping"
  }'
```


## Web app

The same Docker container serves the BuyWindow web interface at:

```
http://localhost:8080/app/
```

Start it with:

```bash
docker compose up --build
```

The first UI supports:

- product/model search
- location and destination inputs
- ranked live retailer offers
- listed vs landed-cost display
- identity classification and confidence
- retailer links
- in-browser human review resolution
- optional session-only bearer-token entry for protected deployments

The UI intentionally uses the public HTTP API rather than importing engine internals, keeping the frontend replaceable as the product matures.


## Product history

Canonical products can now be browsed from the web app's **Catalog** button. Product detail history shows only trusted observations that have passed automatic identity matching or human review.

The history API reports descriptive statistics:

- latest observed price
- minimum observed price
- maximum observed price
- median observed price
- observation count

BuyWindow deliberately does not issue a Buy/Wait forecast from sparse data. The response exposes `sufficientForTrend` only after at least eight priced observations, and even then v0.8 treats that as readiness for future analysis rather than a recommendation.


## Buy / Wait intelligence

BuyWindow v0.9 adds a conservative historical-relative-value decision layer for canonical products.

Possible decisions:

- **BUY** — the latest trusted price is materially low versus the product's observed history.
- **WAIT** — the latest trusted price is materially high versus observed history and/or recent observations are elevated.
- **FAIR** — the current price is near the middle of trusted historical observations.
- **INSUFFICIENT DATA** — BuyWindow withholds a recommendation.

The initial model requires at least 12 trusted priced observations, at least 45 days of history, and a reasonably fresh latest observation. These defaults are intentionally conservative and are returned with the decision metadata.

Important: v0.9 does **not** predict a future price. A `WAIT` result means the current price looks expensive relative to BuyWindow's trusted history; it does not guarantee the price will fall. Future versions can add seasonality and category priors as separate, auditable signals once enough data exists.


## Seasonality priors

When product-specific price history is insufficient, BuyWindow can now surface a **low-confidence category advisory** from explicit seed priors.

Current seed categories include above-ground pools, patio furniture, portable/window air conditioners, space heaters, lawn mowers, and a deliberately neutral generator prior.

These signals are kept separate from learned product history:

- they are labeled `sourceType: seed`
- they expose `learnedFromBuyWindowData: false`
- confidence is capped at 45%
- they use softer decisions: `consider_buying` / `consider_waiting`
- once trusted product history is sufficient, product-specific history remains authoritative

These priors are bootstrap knowledge, not a substitute for BuyWindow's future empirical seasonal models.


## Arbitrage Mode

BuyWindow v0.11 can scan canonical products for potential retail-arbitrage candidates using trusted price history.

The first scanner uses:

- latest trusted acquisition price
- trusted historical retail median as a benchmark
- configurable fee reserve
- configurable fixed costs
- configurable minimum benchmark net ROI

A product is surfaced only when it has enough trusted history and clears the selected benchmark ROI threshold after reserves.

Important: the historical retail median is **not** treated as a validated resale price. The scanner returns `validatedResaleMarket: false` and explicitly excludes resale liquidity, marketplace demand, taxes, shipping, storage, returns, and condition from its current evidence model.

This makes v0.11 an opportunity filter rather than a profit guarantee. A future resale-market connector can replace or supplement the retail benchmark with actual observed resale-market evidence.
