import { matchListing } from "../identity/matcher.js";

const now = new Date().toISOString();
const product = {
  productId: "dewalt-dcd996b",
  brand: "DEWALT",
  name: "20V MAX XR Brushless Hammer Drill - Bare Tool",
  categoryPath: ["Tools", "Power Tools", "Drills"],
  identifiers: { manufacturerModel: "DCD996B", upc: "885911486922" },
  specifications: { voltage: "20V", brushless: true, type: "hammer drill" },
  packageContents: ["hammer drill", "belt hook", "side handle"],
  imageEvidence: [{ perceptualHash: "demo-phash-001" }],
  createdAt: now,
  updatedAt: now,
  schemaVersion: 1,
};

const listing = {
  listingId: "example-123",
  retailer: "Example Retailer",
  url: "https://example.com/products/dcd996b",
  title: "DEWALT 20V MAX XR Brushless 3-Speed Hammer Drill (Tool Only)",
  brand: "DEWALT",
  identifiers: { manufacturerModel: "DCD996B", upc: "885911486922" },
  specifications: { voltage: "20V", brushless: true, type: "hammer drill" },
  packageContents: ["hammer drill", "belt hook", "side handle"],
  imageEvidence: [{ perceptualHash: "demo-phash-001" }],
  observedAt: now,
};

console.log(JSON.stringify(matchListing(product, listing), null, 2));
