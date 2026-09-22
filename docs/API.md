# BuyWindow HTTP API

Default local base URL:

```
http://localhost:8080
```

If `BUYWINDOW_API_KEY` is configured, all `/v1/*` routes require:

```
Authorization: Bearer <key>
```

`GET /health` remains public for container/orchestrator health checks.

## Search

```http
POST /v1/search
Content-Type: application/json
Authorization: Bearer <key>

{
  "query": "DEWALT DCD996B",
  "location": "Austin, Texas"
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
