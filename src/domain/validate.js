function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
}

export function validateCanonicalProduct(product) {
  requireString(product?.productId, "productId");
  requireString(product?.brand, "brand");
  requireString(product?.name, "name");
  if (product.schemaVersion !== 1) throw new TypeError("schemaVersion must be 1");
  return product;
}

export function validateRetailerListing(listing) {
  requireString(listing?.listingId, "listingId");
  requireString(listing?.retailer, "retailer");
  requireString(listing?.url, "url");
  requireString(listing?.title, "title");
  requireString(listing?.observedAt, "observedAt");
  return listing;
}

export function validateObservation(observation) {
  requireString(observation?.observationId, "observationId");
  requireString(observation?.productId, "productId");
  requireString(observation?.listingId, "listingId");
  requireString(observation?.retailer, "retailer");
  requireString(observation?.observedAt, "observedAt");
  requireString(observation?.sourceUrl, "sourceUrl");
  if (observation.price != null && (!(typeof observation.price === "number") || observation.price < 0)) {
    throw new TypeError("price must be a non-negative number");
  }
  return observation;
}
