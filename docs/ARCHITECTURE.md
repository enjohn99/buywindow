# Architecture

## Canonical data model

BuyWindow separates **products** from **retailer listings** and **time-series observations**.

1. A canonical product represents the physical thing or exact bundle/variant.
2. A retailer listing is the retailer-specific representation of that product.
3. An observation records price, inventory, promotion, location, and timestamp.
4. A match decision records why a listing is or is not believed to represent a canonical product.

## Identity resolution

Hard identifiers (UPC, GTIN, manufacturer model, MPN) are authoritative when present. Conflicts prevent automatic merging. When hard identifiers are missing, BuyWindow can combine title similarity, descriptions, normalized specifications, package contents, image hashes, and later multimodal embeddings.

Default thresholds:

- `>= 0.92`: auto-match
- `0.70–0.9199`: human review
- `< 0.70`: do not attach automatically

Thresholds are intentionally conservative because a false merge corrupts historical pricing more severely than a delayed merge.

## Git as the database

The MVP stores canonical JSON plus append-only JSONL observations in GitHub. Writes use the GitHub Contents API with the current blob SHA for optimistic concurrency. Append conflicts retry from the newest version.

As usage grows, data can be sharded by category, geography, or time without changing the canonical file formats.

## Human review

Ambiguous matches are written under `reviews/pending/`. The hosted service can also create GitHub Issues containing the listing, proposed product, confidence, and evidence. A later review resolver will turn an approval/edit/rejection into a versioned catalog change.

## Future intelligence

The product graph and observation history are prerequisites for:

- Buy / Wait recommendations
- seasonal price models
- store-level markdown patterns
- landed-cost comparison
- substitute/value normalization
- reseller/arbitrage scoring
