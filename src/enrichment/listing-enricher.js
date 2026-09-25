import { createHash } from "node:crypto";

const KNOWN_BRANDS = [
  "dewalt","milwaukee","makita","ryobi","bosch","ridgid","intex","bestway",
  "generac","honda","craftsman","kobalt","husqvarna","toro","ego","black decker",
  "black+decker","whirlpool","ge","lg","samsung","frigidaire",
];

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
}

function compact(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function detectBrand(listing) {
  if (listing.brand) return listing.brand;
  const text = normalize(listing.title);
  const found = KNOWN_BRANDS
    .map((brand) => ({ brand, index: text.indexOf(brand) }))
    .filter((x) => x.index >= 0)
    .sort((a, b) => a.index - b.index || b.brand.length - a.brand.length)[0];
  if (!found) return undefined;
  return found.brand
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function detectModel(title = "") {
  const tokens = String(title).match(/\b[A-Z]{1,6}[- ]?\d{2,}[A-Z0-9-]*\b/gi) ?? [];
  const candidates = tokens
    .map(compact)
    .filter((value) => /[A-Z]/.test(value) && /\d/.test(value))
    .filter((value) => value.length >= 4 && value.length <= 24)
    .filter((value) => !/^\d+(V|W|AH|IN|FT|LB|MM|CM)$/.test(value));
  return candidates[0];
}

function detectBarcode(title = "") {
  const match = String(title).match(/\b(?:UPC|GTIN|EAN)[:#\s-]*([0-9]{8,14})\b/i);
  if (!match) return {};
  const value = match[1];
  if (value.length === 12) return { upc: value, gtin: value };
  return { gtin: value };
}

async function hashImageEvidence(imageEvidence = [], fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return imageEvidence;
  const enriched = [];

  for (const image of imageEvidence) {
    if (!image?.sourceUrl || image.sha256) {
      enriched.push(image);
      continue;
    }

    try {
      const response = await fetchImpl(image.sourceUrl);
      if (!response.ok) throw new Error(`image fetch failed (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      enriched.push({
        ...image,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        byteLength: bytes.length,
      });
    } catch (error) {
      enriched.push({
        ...image,
        enrichmentError: String(error),
      });
    }
  }

  return enriched;
}

export async function enrichListing(listing, options = {}) {
  const identifiers = { ...(listing.identifiers ?? {}) };
  const detectedBrand = detectBrand(listing);

  if (!identifiers.manufacturerModel) {
    const model = detectModel(listing.title);
    if (model) identifiers.manufacturerModel = model;
  }

  Object.assign(identifiers, detectBarcode(listing.title));

  const imageEvidence = options.hashImages === true
    ? await hashImageEvidence(listing.imageEvidence ?? [], options.fetchImpl)
    : (listing.imageEvidence ?? []);

  return {
    ...listing,
    brand: listing.brand || detectedBrand,
    identifiers,
    imageEvidence,
    enrichment: {
      version: 1,
      brandInferred: !listing.brand && Boolean(detectedBrand),
      modelInferred: !listing.identifiers?.manufacturerModel && Boolean(identifiers.manufacturerModel),
      barcodeInferred: Boolean(identifiers.upc || identifiers.gtin) &&
        !(listing.identifiers?.upc || listing.identifiers?.gtin),
      imageHashAttempted: options.hashImages === true && Boolean(listing.imageEvidence?.length),
    },
  };
}

export const listingEnrichmentInternals = {
  detectBrand,
  detectModel,
  detectBarcode,
};
