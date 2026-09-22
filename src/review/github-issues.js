export class GitHubIssueReviewQueue {
  constructor(options) {
    this.options = options;
  }

  async create(review) {
    const apiBase = this.options.apiBase ?? "https://api.github.com";
    const url = `${apiBase}/repos/${this.options.owner}/${this.options.repo}/issues`;
    const d = review.matchDecision;
    const body = [
      `Review ID: \`${review.reviewId}\``,
      "",
      `Retailer: **${review.candidateListing.retailer}**`,
      `Listing: ${review.candidateListing.url}`,
      `Title: ${review.candidateListing.title}`,
      `Proposed product: \`${review.proposedProductId ?? "unknown"}\``,
      `Confidence: ${d ? `${Math.round(d.confidence * 10000) / 100}%` : "n/a"}`,
      "",
      "### Evidence",
      ...(d?.signals ?? []).map((s) => `- ${s.name}: ${Math.round(s.score * 100)}% (weight ${s.weight})`),
      "",
      "### Required decision",
      "Confirm whether this retailer listing belongs to the proposed canonical product, is a distinct variant/bundle, or should create a new product.",
    ].join("\n");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.options.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "buywindow/0.1",
      },
      body: JSON.stringify({ title: `[human-review] ${review.candidateListing.title}`, body }),
    });
    if (!response.ok) throw new Error(`GitHub issue creation failed (${response.status}): ${await response.text()}`);
    const result = await response.json();
    return result.number;
  }
}
