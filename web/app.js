const $ = (selector) => document.querySelector(selector);

const state = {
  token: sessionStorage.getItem("buywindow_api_key") || "",
  results: [],
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

    const review = card.querySelector(".review-button");
    if (item.reviewId) {
      review.classList.remove("hidden");
      review.addEventListener("click", () => {
        navigator.clipboard?.writeText(item.reviewId);
        setStatus(`Review ID copied: ${item.reviewId}. Use the review API/CLI to resolve it.`);
      });
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
