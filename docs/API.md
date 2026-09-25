# BuyWindow HTTP API

Default local base URL:

```
http://localhost:8080
```

If `BUYWINDOW_API_KEY` is configured, all `/v1/*` routes require:

```
Authorization: Bearer <key>
```

`GET /health` remains public for container/orchestrator health checks and reports per-feature readiness. See `docs/ENVIRONMENT.md` for the environment variable matrix.

## Search

```http
POST /v1/search
Content-Type: application/json
Authorization: Bearer <key>

{
  "query": "DEWALT DCD996B",
  "location": "Portland, Oregon",
  "destination": {
    "city": "Portland",
    "state": "OR",
    "postalCode": "97205",
    "country": "US"
  },
  "fulfillment": "shipping"
}
```

The endpoint runs live discovery, persists the raw discovery snapshot, canonicalizes results, writes high-confidence matches to trusted history, and queues uncertain/new/variant cases for human review.

## Product

```http
GET /v1/products/{productId}
Authorization: Bearer <key>
```

## Review

```http
GET /v1/reviews/{reviewId}
Authorization: Bearer <key>
```

Resolve:

```http
POST /v1/reviews/{reviewId}/resolve
Content-Type: application/json
Authorization: Bearer <key>

{
  "action": "same_product",
  "productId": "dewalt-dcd996b",
  "reviewer": "eon",
  "note": "Model and bundle match verified."
}
```

Supported actions:

- `same_product`
- `variant`
- `new_product`
- `alternative`
- `reject`


## Landed cost and sales tax

When a structured `destination` is supplied, each search result includes a `cost` object. BuyWindow ranks complete results by:

```
listed price + known shipping + tax = landed cost
```

Tax provenance is explicit:

1. `retailer-observed` — preferred when the source exposes the actual checkout tax.
2. `official-jurisdiction-rule` — maintained rules backed by an official tax authority.
3. `unavailable` — BuyWindow does not guess.

The first maintained jurisdiction rule covers ordinary general tangible goods delivered in Oregon, where the Oregon Department of Revenue states there is no general sales or use/transaction tax. Special categories are not assumed to be zero-tax.

For shipping, `destination` should be the delivery address. For pickup, it should be the pickup/store jurisdiction once that address is known.

If shipping or tax is unknown, `landedCost` is intentionally omitted and the result is marked `partial`. This prevents a cheap-looking incomplete offer from outranking a known out-the-door total.
