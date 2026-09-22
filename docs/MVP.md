# MVP roadmap

## v0.1 — identity + history foundation

- canonical product schema
- retailer listing schema
- offer observation schema
- deterministic identity matcher
- GitHub-backed catalog writer
- pending human-review records
- GitHub Issue escalation
- retailer adapter contract

## v0.2 — live cross-retailer discovery

- Google Shopping discovery provider via SerpApi
- location-aware search context
- normalized retailer/source, price, product ID, image, delivery, and promotion fields
- raw discovery snapshots committed into GitHub before canonicalization
- adapter unit tests
- explicit provider boundary so retailer-specific APIs can be added only when their terms permit BuyWindow's comparison use case

Discovery snapshots are deliberately separate from trusted canonical history. A search result is evidence, not automatically a canonical product match.

## v0.3 — canonicalization + search experience

- infer brand/model/UPC/GTIN where available
- image hashing and multimodal evidence
- candidate generation against the existing catalog
- consumer search UI/API
- exact-match vs variant vs alternative labeling
- location-aware landed cost
- product history visualization

## v0.4 — decision intelligence

Only after enough observations exist:

- price percentile
- seasonal patterns
- Buy / Wait recommendation
- confidence and rationale
- alerting

## v0.5 — reseller mode

- unusually-low-price scanner
- estimated resale channels
- fees and holding costs
- expected gross profit / ROI
- seasonality-adjusted opportunity score
