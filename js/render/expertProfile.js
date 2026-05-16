import { categoryByKey, formatMoney } from "../config.js";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

function ratingMarkup(value) {
  const rating = Math.max(1, Math.min(5, Math.round(Number(value || 5) || 5)));
  const stars = Array.from({ length: 5 }, (_, index) => `<span class="${index < rating ? "filled" : "empty"}" aria-hidden="true">&#9733;</span>`).join("");
  return `<span class="star-rating" aria-label="${rating} out of 5 stars">${stars}</span>`;
}

function portfolioImagesMarkup(images = []) {
  const visibleImages = (Array.isArray(images) ? images : []).filter(Boolean).slice(0, 6);
  if (!visibleImages.length) {
    return "";
  }
  return `
    <article class="card profile-media-card">
      <p class="eyebrow">Portfolio</p>
      <div class="portfolio-grid">
        ${visibleImages.map((url) => `<img src="${escapeHtml(url)}" alt="Portfolio work sample" loading="lazy">`).join("")}
      </div>
    </article>
  `;
}

function socialLinksMarkup(links = {}) {
  const items = [
    ["LinkedIn", links.linkedin],
    ["Instagram", links.instagram],
    ["Website", links.website],
  ].filter((item) => item[1]);
  if (!items.length) {
    return "";
  }
  return `
    <div class="social-link-row">
      ${items.map(([label, url]) => `<a class="chip" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`).join("")}
    </div>
  `;
}

function avatarMarkup(initials, avatarUrl = "", sizeClass = "avatar") {
  const image = String(avatarUrl || "").trim();
  return `
    <div class="${escapeHtml(sizeClass)}${image ? " has-image" : ""}">
      ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" data-avatar-image>` : ""}
      <span>${escapeHtml(initials)}</span>
    </div>
  `;
}

function reviewList(reviews) {
  if (!reviews.length) {
    return '<div class="empty-state"><h3>No reviews yet.</h3><p>Published session reviews will appear here.</p></div>';
  }
  return reviews
    .map(
      (review) => `
        <article class="card">
          <div class="button-row">
            <span class="chip rating-chip">${ratingMarkup(review.data?.rating || review.rating || 5)}</span>
            <span class="meta">${new Date(review.created_at || Date.now()).toLocaleDateString()}</span>
          </div>
          <h3>${escapeHtml(review.title || "Craftvoya review")}</h3>
          <p>${escapeHtml(review.data.body || "")}</p>
        </article>
      `,
    )
    .join("");
}

function checkoutCard(expert, signedIn, isOnline, canCheckout) {
  return `
    <aside class="card sticky-panel checkout-panel">
      <p class="eyebrow">Checkout</p>
      <h3>${formatMoney(expert.amount_cents, expert.currency)} incl. VAT consultation</h3>
      <p class="meta">Customers pay the displayed price. Stripe confirms the included VAT on the invoice, and the call opens inside Craftvoya when the expert joins.</p>
      <button class="button primary" data-action="checkout" data-expert-id="${escapeHtml(expert.id)}"${canCheckout ? "" : " disabled"}>
        ${!signedIn ? "Sign in to book" : isOnline && expert.data.meetReady ? "Start checkout" : "Expert is offline"}
      </button>
      ${signedIn && (!isOnline || !expert.data.meetReady) ? '<p class="meta">This expert must be taking calls before checkout opens.</p>' : ""}
      <button class="button ghost" data-route="/marketplace?category=${encodeURIComponent(expert.category)}">Back to experts</button>
    </aside>
  `;
}

export function renderExpertProfile(state) {
  const expert = state.data.selectedExpert;
  if (state.ui.routeLoading && !expert) {
    return '<section class="route-view section"><div class="empty-state">Loading expert profile...</div></section>';
  }
  if (!expert) {
    return '<section class="route-view section"><div class="empty-state"><h2>Expert not found.</h2><p>This profile is unavailable or no longer published.</p></div></section>';
  }
  const category = categoryByKey(expert.category);
  const initials = expert.data.initials || expert.title.slice(0, 2).toUpperCase();
  const signedIn = Boolean(state.auth.user);
  const isOnline = expert.data.availability === "online";
  const canCheckout = signedIn && isOnline && expert.data.meetReady;
  return `
    <section class="route-view split expert-profile-layout">
      <div class="stack">
        <article class="card expert-summary-card">
          <div class="profile-hero">
            ${avatarMarkup(initials, expert.data.avatarUrl, "avatar-lg")}
            <div>
              <p class="eyebrow">${escapeHtml(category.label)}</p>
              <h2>${escapeHtml(expert.title)}</h2>
              <p class="lede">${escapeHtml(expert.data.headline || "Craftvoya trade expert")}</p>
            </div>
          </div>
          <div class="stat-grid profile-stats public-stats">
            <div class="stat"><strong>${expert.data.rating || 5}</strong><span>Average rating</span></div>
            <div class="stat"><strong>${expert.data.years || 1}</strong><span>Years experience</span></div>
          </div>
          <p class="expert-bio">${escapeHtml(expert.data.bio || "")}</p>
          ${socialLinksMarkup(expert.data.socialLinks || {})}
          <div class="button-row">
            <span class="status-pill ${isOnline ? "online" : "pending"}">${escapeHtml(expert.data.availability || "offline")}</span>
            <span class="status-pill ${expert.data.meetReady ? "paid" : "pending"}">In-app video ready</span>
            ${expert.data.demo ? '<span class="chip">Preview profile</span>' : ""}
          </div>
        </article>
        ${portfolioImagesMarkup(expert.data.portfolioImages || [])}
      </div>
      ${checkoutCard(expert, signedIn, isOnline, canCheckout)}
      <section class="stack expert-reviews-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">Reviews</p>
            <h2>Recent calls</h2>
          </div>
        </div>
        <div class="grid two">
          ${reviewList(state.data.selectedReviews || [])}
        </div>
      </section>
    </section>
  `;
}

export function bindExpertProfile(root, actions, state) {
  root.querySelectorAll("[data-avatar-image]").forEach((image) => {
    image.addEventListener("error", () => {
      image.remove();
      image.parentElement?.classList.remove("has-image");
    });
  });
  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => actions.navigate(button.dataset.route));
  });
  const checkout = root.querySelector('[data-action="checkout"]');
  if (!checkout) {
    return;
  }
  checkout.addEventListener("click", async () => {
    if (!state.auth.user) {
      actions.navigate("/auth?mode=login&role=customer");
      return;
    }
    const expert = state.data.selectedExpert;
    if (expert?.data?.demo) {
      actions.showError("Preview experts cannot start real Checkout until live expert records are provisioned.");
      return;
    }
    if (expert?.data?.availability !== "online" || !expert?.data?.meetReady) {
      actions.showError("This expert is not taking calls right now.");
      return;
    }
    checkout.disabled = true;
    checkout.textContent = "Opening checkout...";
    actions.showSiteLoader("Opening Stripe Checkout...");
    try {
      const result = await actions.createCheckoutForExpert(checkout.dataset.expertId);
      if (!result?.url) {
        throw new Error("Stripe did not return a checkout link.");
      }
      window.location.assign(result.url);
    } catch (error) {
      actions.hideSiteLoader?.();
      actions.showError(error.message);
      checkout.disabled = false;
      checkout.textContent = "Start checkout";
    }
  });
}
