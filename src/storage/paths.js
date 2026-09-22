export function slug(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function productRoot(brand, productId) {
  return `catalog/${slug(brand)}/${slug(productId)}`;
}

export function productPath(brand, productId) {
  return `${productRoot(brand, productId)}/product.json`;
}

export function listingPath(brand, productId, retailer, listingId) {
  return `${productRoot(brand, productId)}/listings/${slug(retailer)}-${slug(listingId)}.json`;
}

export function observationPath(brand, productId, observedAt) {
  const date = new Date(observedAt);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${productRoot(brand, productId)}/observations/${year}/${month}.jsonl`;
}

export function discoveryPath(searchId, observedAt) {
  const date = new Date(observedAt);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `discovery/${year}/${month}/${day}/${slug(searchId)}.json`;
}

export function reviewPath(reviewId) {
  return `reviews/pending/${slug(reviewId)}.json`;
}
