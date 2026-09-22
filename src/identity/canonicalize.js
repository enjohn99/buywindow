import { randomUUID } from "node:crypto";
import { chooseBestMatch, matchListing } from "./matcher.js";

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value = "") {
  return new Set(normalize(value).split(/\s+/).filter((x) => x.length > 1));
}

function jaccard(a = "", b = "") {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  const intersection = [...aa].filter((x) => bb.has(x)).length;
  const union = new Set([...aa, ...bb]).size;
  return union ? intersection / union : 0;
}

function modelFamily(value = "") {
  const compact = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = compact.match(/^([A-Z]+\d{2,})/);
  return m?.[1];
}

function likelyVariant(product, listing, match) {
  const pModel = product.identifiers?.manufacturerModel;
  const lModel = listing.identifiers?.manufacturerModel;
  if (!pModel || !lModel) return false;
  const pFamily = modelFamily(pModel);
  const lFamily = modelFamily(lModel);
  if (!pFamily || !lFamily || pFamily !== lFamily) return false;
  if (normalize(pModel) === normalize(lModel)) return false;
  return match.hardConflict === true;
}

function likelyAlternative(product, listing, match) {
  if (match.confidence >= 0.7) return false;
  const sameBrand = product.brand && listing.brand && normalize(product.brand) === normalize(listing.brand);
  const titleScore = jaccard(product.name, listing.title);
  return Boolean(sameBrand && titleScore >= 0.35);
}

export function classifyAgainstCatalog(products, listing) {
  if (!products?.length) {
    return {
      classification: "new_product",
      confidence: 0,
      listing,
      rationale: ["No existing canonical products are available for comparison."],
    };
  }

  const ranked = products
    .map((product) => ({ product, match: matchListing(product, listing) }))
    .sort((a, b) => b.match.confidence - a.match.confidence);

  const best = ranked[0];

  if (best.match.decision === "auto_match") {
    return {
      classification: "same_product",
      confidence: best.match.confidence,
      productId: best.product.productId,
      match: best.match,
    };
  }

  if (likelyVariant(best.product, listing, best.match)) {
    return {
      classification: "variant",
      confidence: Math.max(0.75, best.match.confidence),
      relatedProductId: best.product.productId,
      match: best.match,
      rationale: ["Manufacturer model belongs to the same model family but conflicts with the canonical model."],
    };
  }

  if (best.match.decision === "human_review") {
    return {
      classification: "needs_human_review",
      confidence: best.match.confidence,
      proposedProductId: best.product.productId,
      match: best.match,
    };
  }

  if (likelyAlternative(best.product, listing, best.match)) {
    return {
      classification: "alternative",
      confidence: Number(Math.max(best.match.confidence, 0.55).toFixed(4)),
      relatedProductId: best.product.productId,
      match: best.match,
      rationale: ["Brand and title overlap suggest a related alternative, but identity evidence is insufficient for a canonical match."],
    };
  }

  return {
    classification: "new_product",
    confidence: best.match.confidence,
    listing,
    closestProductId: best.product.productId,
    match: best.match,
  };
}

export function makeReviewRecord(classification, listing) {
  return {
    reviewId: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    type: "product_identity",
    classification,
    candidateListing: listing,
  };
}
