const AUTO_MATCH = 0.92;
const HUMAN_REVIEW = 0.70;

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compact(value = "") {
  return normalize(value).replace(/\s+/g, "");
}

function tokenSet(value = "") {
  return new Set(normalize(value).split(/\s+/).filter((x) => x.length > 1));
}

function jaccard(a = "", b = "") {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  const intersection = [...aa].filter((x) => bb.has(x)).length;
  const union = new Set([...aa, ...bb]).size;
  return union ? intersection / union : 0;
}

function specSimilarity(a = {}, b = {}) {
  const common = Object.keys(a).filter((k) => k in b);
  if (!common.length) return 0;
  const equal = common.filter((k) => normalize(a[k]) === normalize(b[k])).length;
  return equal / common.length;
}

function packageSimilarity(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  return jaccard(a.join(" "), b.join(" "));
}

function imageSimilarity(product, listing) {
  for (const p of product.imageEvidence ?? []) {
    for (const l of listing.imageEvidence ?? []) {
      if (p.sha256 && l.sha256 && p.sha256 === l.sha256) return 1;
      if (p.perceptualHash && l.perceptualHash && p.perceptualHash === l.perceptualHash) return 0.98;
      if (p.embeddingRef && l.embeddingRef && p.embeddingRef === l.embeddingRef) return 0.98;
    }
  }
  return 0;
}

function hardIdentifierConflict(product, listing) {
  const p = product.identifiers ?? {};
  const l = listing.identifiers ?? {};
  const pairs = [
    ["UPC", p.upc, l.upc],
    ["GTIN", p.gtin, l.gtin],
    ["manufacturer model", p.manufacturerModel, l.manufacturerModel],
    ["MPN", p.mpn, l.mpn],
  ];
  for (const [label, a, b] of pairs) {
    if (a && b && compact(a) !== compact(b)) return `${label} conflicts (${a} vs ${b})`;
  }
}

export function matchListing(product, listing) {
  const conflict = hardIdentifierConflict(product, listing);
  if (conflict) {
    return {
      productId: product.productId,
      confidence: 0.05,
      decision: "reject",
      hardConflict: true,
      signals: [],
      rationale: [conflict, "Hard identifier conflicts are never auto-merged."],
    };
  }

  const p = product.identifiers ?? {};
  const l = listing.identifiers ?? {};
  const signals = [
    {
      name: "manufacturer_model",
      score: p.manufacturerModel && l.manufacturerModel ? Number(compact(p.manufacturerModel) === compact(l.manufacturerModel)) : 0,
      weight: 0.28,
      available: Boolean(p.manufacturerModel && l.manufacturerModel),
    },
    {
      name: "upc_or_gtin",
      score: (p.upc && l.upc && compact(p.upc) === compact(l.upc)) || (p.gtin && l.gtin && compact(p.gtin) === compact(l.gtin)) ? 1 : 0,
      weight: 0.25,
      available: Boolean((p.upc && l.upc) || (p.gtin && l.gtin)),
    },
    {
      name: "brand",
      score: product.brand && listing.brand ? Number(normalize(product.brand) === normalize(listing.brand)) : 0,
      weight: 0.08,
      available: Boolean(product.brand && listing.brand),
    },
    { name: "title", score: jaccard(product.name, listing.title), weight: 0.12, available: Boolean(product.name && listing.title) },
    { name: "specifications", score: specSimilarity(product.specifications, listing.specifications), weight: 0.12, available: Boolean(Object.keys(product.specifications ?? {}).length && Object.keys(listing.specifications ?? {}).length) },
    { name: "package_contents", score: packageSimilarity(product.packageContents, listing.packageContents), weight: 0.08, available: Boolean(product.packageContents?.length && listing.packageContents?.length) },
    { name: "image", score: imageSimilarity(product, listing), weight: 0.07, available: Boolean(product.imageEvidence?.length && listing.imageEvidence?.length) },
  ];

  const active = signals.filter((s) => s.available);
  const weight = active.reduce((sum, s) => sum + s.weight, 0) || 1;
  let confidence = active.reduce((sum, s) => sum + s.score * s.weight, 0) / weight;

  const exactModel = signals.find((s) => s.name === "manufacturer_model")?.score === 1;
  const exactBarcode = signals.find((s) => s.name === "upc_or_gtin")?.score === 1;
  const strongVisual = (signals.find((s) => s.name === "image")?.score ?? 0) >= 0.98;
  if (exactModel && exactBarcode) confidence = Math.max(confidence, 0.995);
  else if (exactModel && strongVisual) confidence = Math.max(confidence, 0.96);
  else if (exactModel) confidence = Math.max(confidence, 0.90);

  confidence = Math.min(1, Math.max(0, Number(confidence.toFixed(4))));
  const decision = confidence >= AUTO_MATCH ? "auto_match" : confidence >= HUMAN_REVIEW ? "human_review" : "reject";

  const rationale = active
    .filter((s) => s.score >= 0.8)
    .map((s) => `${s.name} strongly supports the match (${Math.round(s.score * 100)}%).`);
  if (decision === "human_review") rationale.push("Evidence is plausible but below the auto-merge threshold.");
  if (decision === "reject") rationale.push("Evidence is too weak to attach this listing to the canonical product automatically.");

  return { productId: product.productId, confidence, decision, hardConflict: false, signals, rationale };
}

export function chooseBestMatch(products, listing) {
  return products.map((product) => matchListing(product, listing)).sort((a, b) => b.confidence - a.confidence)[0];
}
