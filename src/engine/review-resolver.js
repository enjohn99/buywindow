import { randomUUID } from "node:crypto";

function slug(value = "") {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildProductFromListing(listing, overrides = {}) {
  const now = new Date().toISOString();
  const brand = overrides.brand || listing.brand || "unknown";
  const name = overrides.name || listing.title;
  const productId = overrides.productId || [
    slug(brand),
    slug(listing.identifiers?.manufacturerModel || listing.sourceProductId || listing.title).slice(0, 80),
  ].filter(Boolean).join("-");

  return {
    productId,
    brand,
    name,
    categoryPath: overrides.categoryPath ?? [],
    identifiers: {
      ...(listing.identifiers ?? {}),
      ...(overrides.identifiers ?? {}),
    },
    specifications: {
      ...(listing.specifications ?? {}),
      ...(overrides.specifications ?? {}),
    },
    packageContents: overrides.packageContents ?? listing.packageContents ?? [],
    imageEvidence: listing.imageEvidence ?? [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

function observationFromListing(review, product, listing) {
  if (listing.offer?.price == null) return undefined;
  return {
    observationId: `review-${review.reviewId}-${listing.listingId}`,
    productId: product.productId,
    listingId: listing.listingId,
    retailer: listing.retailer,
    observedAt: listing.observedAt,
    price: listing.offer.price,
    currency: listing.offer.currency ?? "USD",
    promotion: listing.offer.promotion,
    sourceUrl: listing.url,
  };
}

export async function resolveReview({
  catalog,
  reviewId,
  action,
  productId,
  overrides = {},
  reviewer = "human",
  note,
}) {
  const review = await catalog.getReview(reviewId);
  if (!review) throw new Error(`Review not found: ${reviewId}`);
  if (review.status !== "pending") throw new Error(`Review ${reviewId} is already ${review.status}`);

  const listing = review.candidateListing;
  let product;
  let resolution;

  switch (action) {
    case "same_product": {
      const targetId = productId || review.classification?.proposedProductId || review.classification?.productId;
      if (!targetId) throw new Error("same_product requires a productId");
      product = await catalog.getProductById(targetId);
      if (!product) throw new Error(`Canonical product not found: ${targetId}`);
      await catalog.saveListing(product, listing);
      const observation = observationFromListing(review, product, listing);
      if (observation) await catalog.appendObservation(product, observation);
      resolution = { action, productId: product.productId };
      break;
    }

    case "new_product":
    case "variant": {
      product = buildProductFromListing(listing, {
        ...overrides,
        productId: productId || overrides.productId,
      });
      if (action === "variant") {
        const relatedProductId =
          review.classification?.relatedProductId ||
          review.classification?.proposedProductId ||
          overrides.relatedProductId;
        product.relationships = {
          ...(product.relationships ?? {}),
          variantOf: relatedProductId || undefined,
        };
      }
      await catalog.saveProduct(product);
      await catalog.saveListing(product, listing);
      const observation = observationFromListing(review, product, listing);
      if (observation) await catalog.appendObservation(product, observation);
      resolution = {
        action,
        productId: product.productId,
        relatedProductId: product.relationships?.variantOf,
      };
      break;
    }

    case "alternative": {
      const relatedProductId =
        productId ||
        review.classification?.relatedProductId ||
        review.classification?.proposedProductId;
      resolution = { action, relatedProductId };
      break;
    }

    case "reject":
      resolution = { action };
      break;

    default:
      throw new Error(`Unsupported review action: ${action}`);
  }

  const resolvedAt = new Date().toISOString();
  const resolved = {
    ...review,
    status: "resolved",
    resolvedAt,
    resolutionId: randomUUID(),
    resolution: {
      ...resolution,
      reviewer,
      note: note || undefined,
    },
  };

  await catalog.resolveReview(reviewId, resolved);
  return resolved;
}
