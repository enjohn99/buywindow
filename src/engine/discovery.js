import { randomUUID } from "node:crypto";

export async function runDiscovery({ adapter, query, context = {}, catalog }) {
  const results = await adapter.search(query, context);
  const searchId = randomUUID();
  const observedAt = new Date().toISOString();

  const snapshot = {
    schemaVersion: 1,
    searchId,
    query,
    context,
    observedAt,
    source: adapter.retailer,
    resultCount: results.length,
    results,
  };

  if (catalog?.saveDiscoverySearch) {
    await catalog.saveDiscoverySearch(snapshot);
  }

  return snapshot;
}
