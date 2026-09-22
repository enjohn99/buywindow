import { randomUUID } from "node:crypto";
import { chooseBestMatch } from "../identity/matcher.js";

export async function ingestListing(catalog, products, listing, observation) {
  const best = chooseBestMatch(products, listing);
  if (!best || best.decision === "reject") return { status: "unmatched", confidence: best?.confidence };

  const product = products.find((p) => p.productId === best.productId);
  if (best.decision === "human_review") {
    const review = {
      reviewId: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "pending",
      candidateListing: listing,
      proposedProductId: product.productId,
      matchDecision: best,
      notes: [],
    };
    await catalog.queueReview(review);
    return { status: "review", review };
  }

  await catalog.saveListing(product, listing);
  if (observation) {
    await catalog.appendObservation(product, {
      ...observation,
      productId: product.productId,
      listingId: listing.listingId,
      retailer: listing.retailer,
      sourceUrl: listing.url,
    });
  }
  return { status: "matched", product, confidence: best.confidence };
}
