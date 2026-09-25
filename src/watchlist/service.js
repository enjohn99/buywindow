import { randomUUID } from "node:crypto";
import { runDiscovery } from "../engine/discovery.js";
import { canonicalizeDiscovery } from "../engine/canonicalize-discovery.js";

export function normalizeWatchItem(input = {}) {
  const query = String(input.query ?? "").trim();
  if (!query) throw new TypeError("watch item query is required");

  return {
    watchId: input.watchId || randomUUID(),
    query,
    productId: input.productId || undefined,
    location: input.location || undefined,
    gl: input.gl || "us",
    hl: input.hl || "en",
    enabled: input.enabled !== false,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function collectWatchlist({
  catalog,
  adapter,
  reviewQueue,
  enrichment = {},
  defaultLocation,
} = {}) {
  const watchlist = await catalog.getWatchlist();
  const enabled = (watchlist.items ?? []).filter((item) => item.enabled !== false);
  const runs = [];

  for (const item of enabled) {
    try {
      const snapshot = await runDiscovery({
        adapter,
        query: item.query,
        context: {
          location: item.location || defaultLocation || undefined,
          gl: item.gl || "us",
          hl: item.hl || "en",
        },
        catalog,
      });

      const canonicalization = await canonicalizeDiscovery({
        snapshot,
        catalog,
        reviewQueue,
        enrichment,
      });

      runs.push({
        watchId: item.watchId,
        query: item.query,
        status: "ok",
        searchId: snapshot.searchId,
        resultCount: snapshot.resultCount,
        summary: canonicalization.summary,
      });
    } catch (error) {
      runs.push({
        watchId: item.watchId,
        query: item.query,
        status: "error",
        error: String(error),
      });
    }
  }

  return {
    collectedAt: new Date().toISOString(),
    enabledCount: enabled.length,
    successCount: runs.filter((run) => run.status === "ok").length,
    errorCount: runs.filter((run) => run.status === "error").length,
    runs,
  };
}
