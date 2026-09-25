import { classifyAgainstCatalog, makeReviewRecord } from "../identity/canonicalize.js";
import { enrichListing } from "../enrichment/listing-enricher.js";

export async function canonicalizeDiscovery({ snapshot, catalog, reviewQueue, enrichment = {} }) {
  const products = await catalog.listCanonicalProducts();
  const results = [];

  for (const rawListing of snapshot.results) {
    const listing = await enrichListing(rawListing, enrichment);
    const classification = classifyAgainstCatalog(products, listing);
    const record = { listing, ...classification };

    if (classification.classification === "same_product") {
      const product = products.find((p) => p.productId === classification.productId);
      if (product) {
        await catalog.saveListing(product, listing);
        if (listing.offer?.price != null) {
          await catalog.appendObservation(product, {
            observationId: `${snapshot.searchId}-${listing.listingId}`,
            productId: product.productId,
            listingId: listing.listingId,
            retailer: listing.retailer,
            observedAt: listing.observedAt,
            price: listing.offer.price,
            currency: listing.offer.currency ?? "USD",
            promotion: listing.offer.promotion,
            sourceUrl: listing.url,
          });
        }
      }
    } else if (["needs_human_review", "variant", "new_product"].includes(classification.classification)) {
      const review = makeReviewRecord(classification, listing);
      if (reviewQueue) {
        try {
          review.issueNumber = await reviewQueue.create(review);
        } catch (error) {
          review.issueError = String(error);
        }
      }
      await catalog.queueReview(review);
      record.reviewId = review.reviewId;
      record.issueNumber = review.issueNumber;
    }

    results.push(record);
  }

  const summary = results.reduce((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    schemaVersion: 1,
    searchId: snapshot.searchId,
    query: snapshot.query,
    canonicalizedAt: new Date().toISOString(),
    summary,
    results,
  };

  await catalog.saveCanonicalizationReport(report);
  return report;
}
