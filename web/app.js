const $ = (selector) => document.querySelector(selector);

const state = {
  token: sessionStorage.getItem("buywindow_api_key") || "",
  results: [],
  activeReviewId: null,
};

function headers() {
  const value = { "content-type": "application/json" };
  if (state.token) value.authorization = `Bearer ${state.token}`;
  return value;
}

function money(value, currency = "USD") {
  if (!Number.isFinite(Number(value))) return "Price unavailable";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value));
}

function humanize(value = "") {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function setStatus(message, type = "info") {
  const panel = $("#statusPanel");
  panel.textContent = message;
  panel.classList.remove("hidden", "error");
  if (type === "error") panel.classList.add("error");
}

function clearStatus() {
  $("#statusPanel").classList.add("hidden");
}

async function checkHealth() {
  const badge = $("#healthBadge");
  try {
    const response = await fetch("/health");
    const body = await response.json();
    badge.textContent = body.status === "ok" ? "Online" : "Degraded";
    badge.classList.toggle("ok", body.status === "ok");
  } catch {
    badge.textContent = "Offline";
  }
}

function renderSummary(summary = {}) {
  const container = $("#summaryPills");
  container.innerHTML = "";
  Object.entries(summary).forEach(([name, count]) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${humanize(name)} · ${count}`;
    container.append(pill);
  });
}

function renderResults(data) {
  state.results = data.results ?? [];
  $("#resultsTitle").textContent = `Best options for “${data.query}”`;
  renderSummary(data.summary);

  const container = $("#results");
  container.innerHTML = "";
  const template = $("#resultTemplate");

  for (const item of state.results) {
    const listing = item.listing ?? {};
    const offer = listing.offer ?? {};
    const card = template.content.cloneNode(true);
    const image = card.querySelector(".thumb");

    image.src = listing.imageEvidence?.[0]?.sourceUrl || "";
    image.alt = listing.title || "Product";
    image.addEventListener("error", () => {
      image.closest(".thumb-wrap").style.display = "none";
    });

    card.querySelector(".retailer").textContent = listing.retailer || "Retailer";
    card.querySelector(".classification").textContent = humanize(item.classification || "unclassified");
    card.querySelector(".title").textContent = listing.title || "Untitled product";
    card.querySelector(".price").textContent = money(offer.price, offer.currency || "USD");
    card.querySelector(".old-price").textContent = offer.oldPrice ? money(offer.oldPrice, offer.currency || "USD") : "";

    const landed = item.cost?.landedCost;
    card.querySelector(".landed").textContent = landed != null
      ? `${money(landed, item.cost.currency || offer.currency || "USD")} landed`
      : item.cost?.reason || "";

    const meta = [
      offer.delivery,
      offer.promotion,
      listing.providerMetadata?.rating ? `★ ${listing.providerMetadata.rating}` : null,
      listing.providerMetadata?.reviews ? `${listing.providerMetadata.reviews} reviews` : null,
    ].filter(Boolean);
    card.querySelector(".meta").textContent = meta.join(" · ");

    const confidence = Number(item.confidence ?? item.match?.confidence ?? 0);
    card.querySelector(".confidence-bar span").style.width = `${Math.round(confidence * 100)}%`;
    card.querySelector(".confidence-label").textContent = confidence
      ? `${Math.round(confidence * 100)}% identity confidence`
      : "Identity confidence pending";

    const link = card.querySelector(".retailer-link");
    if (listing.url) link.href = listing.url;
    else link.classList.add("hidden");

    const history = card.querySelector(".history-button");
    const canonicalProductId = item.productId || item.proposedProductId || item.relatedProductId;
    if (canonicalProductId && item.classification === "same_product") {
      history.classList.remove("hidden");
      history.addEventListener("click", () => openHistory(canonicalProductId));
    }

    const review = card.querySelector(".review-button");
    if (item.reviewId) {
      review.classList.remove("hidden");
      review.addEventListener("click", () => openReview(item.reviewId));
    }

    container.append(card);
  }

  $("#resultsSection").classList.remove("hidden");
}

async function search(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Searching…";
  $("#resultsSection").classList.add("hidden");
  setStatus("Searching live offers and verifying product identity…");

  const query = $("#query").value.trim();
  const location = $("#location").value.trim();
  const postalCode = $("#postalCode").value.trim();
  const stateCode = $("#state").value.trim().toUpperCase();

  const payload = {
    query,
    location: location || undefined,
    fulfillment: $("#fulfillment").value,
  };

  if (postalCode || stateCode) {
    payload.destination = {
      postalCode: postalCode || undefined,
      state: stateCode || undefined,
      country: "US",
    };
  }

  try {
    const response = await fetch("/v1/search", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        $("#authDialog").showModal();
        throw new Error("This deployment requires API access. Enter the bearer token and retry.");
      }
      throw new Error(body.error || `Search failed (${response.status})`);
    }
    clearStatus();
    renderResults(body);
  } catch (error) {
    setStatus(error.message || String(error), "error");
  } finally {
    button.disabled = false;
    button.textContent = "Find best options";
  }
}

$("#searchForm").addEventListener("submit", search);
$("#authButton").addEventListener("click", () => {
  $("#apiKey").value = state.token;
  $("#authDialog").showModal();
});
$("#saveKey").addEventListener("click", () => {
  state.token = $("#apiKey").value.trim();
  if (state.token) sessionStorage.setItem("buywindow_api_key", state.token);
  else sessionStorage.removeItem("buywindow_api_key");
  $("#authDialog").close();
});
$("#clearKey").addEventListener("click", () => {
  state.token = "";
  sessionStorage.removeItem("buywindow_api_key");
  $("#apiKey").value = "";
});
checkHealth();


async function openReview(reviewId) {
  state.activeReviewId = reviewId;
  $("#reviewStatus").textContent = "Loading review…";
  $("#reviewDetails").innerHTML = "";
  $("#reviewNote").value = "";
  $("#reviewDialog").showModal();

  try {
    const response = await fetch(`/v1/reviews/${encodeURIComponent(reviewId)}`, {
      headers: headers(),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load review");

    const c = body.classification ?? {};
    const listing = body.candidateListing ?? {};
    $("#reviewDetails").innerHTML = `
      <strong>${listing.title || "Untitled listing"}</strong>
      <p>${listing.retailer || "Unknown retailer"}</p>
      <p>Suggested: ${humanize(c.classification || "unknown")} · ${Math.round(Number(c.confidence || 0) * 100)}% confidence</p>
      <p>Target: ${c.proposedProductId || c.relatedProductId || c.productId || "No canonical target yet"}</p>
    `;
    $("#reviewStatus").textContent = "";
  } catch (error) {
    $("#reviewStatus").textContent = error.message || String(error);
  }
}

async function resolveActiveReview(action) {
  if (!state.activeReviewId) return;
  const buttons = [...document.querySelectorAll("[data-review-action]")];
  buttons.forEach((button) => button.disabled = true);
  $("#reviewStatus").textContent = `Resolving as ${humanize(action)}…`;

  try {
    const response = await fetch(
      `/v1/reviews/${encodeURIComponent(state.activeReviewId)}/resolve`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          action,
          reviewer: "web-ui",
          note: $("#reviewNote").value.trim() || undefined,
        }),
      }
    );
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to resolve review");

    $("#reviewStatus").textContent = `Resolved as ${humanize(action)}.`;
    const reviewId = state.activeReviewId;
    state.results = state.results.map((item) =>
      item.reviewId === reviewId
        ? { ...item, reviewId: undefined, classification: action === "same_product" ? "same_product" : action }
        : item
    );
    setTimeout(() => $("#reviewDialog").close(), 350);
  } catch (error) {
    $("#reviewStatus").textContent = error.message || String(error);
  } finally {
    buttons.forEach((button) => button.disabled = false);
  }
}

document.querySelectorAll("[data-review-action]").forEach((button) => {
  button.addEventListener("click", () => resolveActiveReview(button.dataset.reviewAction));
});
$("#closeReview").addEventListener("click", () => $("#reviewDialog").close());


async function loadCatalog() {
  $("#catalogList").innerHTML = '<p class="muted">Loading catalog…</p>';
  $("#catalogDialog").showModal();

  try {
    const response = await fetch("/v1/products", { headers: headers() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load catalog");

    const products = body.products ?? [];
    if (!products.length) {
      $("#catalogList").innerHTML = '<p class="muted">No canonical products yet. Search and resolve new products to build the catalog.</p>';
      return;
    }

    $("#catalogList").innerHTML = "";
    for (const product of products) {
      const item = document.createElement("div");
      item.className = "catalog-item";
      const model = product.identifiers?.manufacturerModel || product.identifiers?.upc || product.productId;
      item.innerHTML = `
        <div>
          <strong>${product.brand || "Unknown brand"} · ${product.name || product.productId}</strong>
          <small>${model || ""}</small>
        </div>
        <button class="ghost small" type="button">View history</button>
      `;
      item.querySelector("button").addEventListener("click", () => openHistory(product.productId));
      $("#catalogList").append(item);
    }
  } catch (error) {
    $("#catalogList").innerHTML = `<p class="muted">${error.message || String(error)}</p>`;
  }
}

async function openHistory(productId) {
  $("#historyTitle").textContent = "Product history";
  $("#decisionPanel").className = "decision-panel hidden";
  $("#decisionPanel").innerHTML = "";
  $("#historyStats").innerHTML = "";
  $("#historyNotice").textContent = "Loading observed prices…";
  $("#historyList").innerHTML = "";
  $("#historyDialog").showModal();

  try {
    const response = await fetch(`/v1/products/${encodeURIComponent(productId)}/history`, {
      headers: headers(),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load product history");

    const product = body.product ?? {};
    const summary = body.summary ?? {};
    const decision = body.decision ?? {};
    $("#historyTitle").textContent = `${product.brand || ""} ${product.name || product.productId}`.trim();

    const panel = $("#decisionPanel");
    panel.className = `decision-panel ${decision.decision || "insufficient_data"}`;
    const label = {
      buy: "BUY",
      wait: "WAIT",
      fair: "FAIR",
      insufficient_data: "INSUFFICIENT DATA",
    }[decision.decision] || humanize(decision.decision || "insufficient_data");

    panel.innerHTML = `
      <div class="decision-head">
        <div class="decision-label">${label}</div>
        <div class="decision-confidence">${decision.confidence ? Math.round(decision.confidence * 100) + "% confidence" : "No confidence score yet"}</div>
      </div>
      <ul class="decision-reasons">
        ${(decision.reasons ?? []).map((reason) => `<li>${reason}</li>`).join("")}
      </ul>
      <div class="decision-meta">${decision.model?.predictsFuturePrice === false ? "Historical-relative-value model · does not predict future price" : ""}</div>
    `;

    const stats = [
      ["Latest", summary.latestPrice != null ? money(summary.latestPrice, summary.latestCurrency || "USD") : "—"],
      ["Median", summary.medianPrice != null ? money(summary.medianPrice, summary.latestCurrency || "USD") : "—"],
      ["Lowest", summary.minPrice != null ? money(summary.minPrice, summary.latestCurrency || "USD") : "—"],
      ["Observations", summary.pricedObservationCount ?? 0],
    ];

    $("#historyStats").innerHTML = stats
      .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`)
      .join("");

    $("#historyNotice").textContent = decision.decision === "insufficient_data"
      ? "BuyWindow is withholding a recommendation until the trusted dataset meets its minimum evidence threshold."
      : "The decision above compares the current trusted price with BuyWindow's observed history. It is not a future-price forecast.";

    const observations = body.observations ?? [];
    if (!observations.length) {
      $("#historyList").innerHTML = '<p class="muted">No trusted price observations yet.</p>';
      return;
    }

    $("#historyList").innerHTML = "";
    [...observations].reverse().forEach((observation) => {
      const row = document.createElement("div");
      row.className = "history-row";
      const when = observation.observedAt ? new Date(observation.observedAt).toLocaleString() : "Unknown time";
      row.innerHTML = `
        <div>
          <strong>${observation.retailer || "Retailer"}</strong>
          <small>${when}</small>
        </div>
        <strong>${money(observation.price, observation.currency || "USD")}</strong>
      `;
      $("#historyList").append(row);
    });
  } catch (error) {
    $("#historyNotice").textContent = error.message || String(error);
  }
}

$("#catalogButton").addEventListener("click", loadCatalog);
$("#closeCatalog").addEventListener("click", () => $("#catalogDialog").close());
$("#closeHistory").addEventListener("click", () => $("#historyDialog").close());
