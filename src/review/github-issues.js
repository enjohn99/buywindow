export class GitHubIssueReviewQueue {
  constructor(options) {
    this.options = options;
  }

  async create(review) {
    const apiBase = this.options.apiBase ?? "https://api.github.com";
    const url = `${apiBase}/repos/${this.options.owner}/${this.options.repo}/issues`;
    const c = review.classification ?? {};
    const d = c.match;
    const body = [
      `Review ID: \`${review.reviewId}\``,
      "",
      `Classification: **${c.classification ?? "unknown"}**`,
      `Retailer: **${review.candidateListing.retailer}**`,
      `Listing: ${review.candidateListing.url ?? "n/a"}`,
      `Title: ${review.candidateListing.title}`,
      `Proposed product: \`${c.proposedProductId ?? c.relatedProductId ?? c.productId ?? "unknown"}\``,
      `Confidence: ${Number.isFinite(c.confidence) ? `${Math.round(c.confidence * 10000) / 100}%` : "n/a"}`,
      "",
      "### Evidence",
      ...(d?.signals ?? []).map((s) => `- ${s.name}: ${Math.round(s.score * 100)}% (weight ${s.weight})`),
      "",
      "### Allowed decisions",
      "- same_product",
      "- variant",
      "- new_product",
      "- alternative",
      "- reject",
      "",
      "Resolve with the BuyWindow review CLI or future review UI. The GitHub issue is the human-facing audit surface; the canonical decision is stored in the repository.",
    ].join("\n");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.options.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "buywindow/0.4",
      },
      body: JSON.stringify({
        title: `[human-review] ${review.candidateListing.title}`,
        body,
      }),
    });
    if (!response.ok) throw new Error(`GitHub issue creation failed (${response.status}): ${await response.text()}`);
    const result = await response.json();
    return result.number;
  }
}
