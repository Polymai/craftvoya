import { CATEGORIES, categoryByKey, formatMoney } from "../config.js";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

function avatarMarkup(initials, avatarUrl = "", sizeClass = "avatar") {
  const image = String(avatarUrl || "").trim();
  return `
    <div class="${escapeHtml(sizeClass)}${image ? " has-image" : ""}">
      ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" data-avatar-image>` : ""}
      <span>${escapeHtml(initials)}</span>
    </div>
  `;
}

function expertCard(expert) {
  const category = categoryByKey(expert.category);
  const initials = expert.data.initials || expert.title.slice(0, 2).toUpperCase();
  const routeId = expert.route_id || expert.data?.routeId || expert.slug || expert.id || expert.expert_user_id;
  return `
    <article class="card action-card expert-card" data-expert="${escapeHtml(routeId)}">
      ${avatarMarkup(initials, expert.data.avatarUrl, "avatar")}
      <div class="tight-stack">
        <div class="button-row">
          <span class="status-pill online">Online</span>
          ${expert.data.demo ? '<span class="chip">Preview</span>' : ""}
        </div>
        <h3>${escapeHtml(expert.title)}</h3>
        <p class="meta">${escapeHtml(expert.data.headline || category.label)}</p>
        <p>${escapeHtml(expert.data.bio || "")}</p>
        <div class="button-row">
          <span class="price">${formatMoney(expert.amount_cents, expert.currency)} incl. VAT</span>
          <span class="meta">${expert.data.rating || 5} rating</span>
          <span class="meta">${expert.data.years || 1} years</span>
        </div>
      </div>
      <div class="button-row">
        <button class="button primary" data-route="/expert/${encodeURIComponent(routeId)}">View expert</button>
      </div>
    </article>
  `;
}

export function renderMarketplace(state) {
  const selected = state.data.selectedCategory || state.route.query.category || CATEGORIES[0].key;
  const experts = state.data.experts || [];
  return `
    <section class="route-view section stack">
      <div class="section-head">
        <div>
          <p class="eyebrow">Trade marketplace</p>
          <h2>Choose who checks your next step.</h2>
        </div>
      </div>
      <div class="category-strip" aria-label="Expert categories">
        ${CATEGORIES.map(
          (category) => `
            <button class="chip${category.key === selected ? " active" : ""}" data-category="${category.key}">
              ${escapeHtml(category.label)}
            </button>
          `,
        ).join("")}
      </div>
      ${state.ui.routeLoading ? '<div class="empty-state">Loading trade expert availability...</div>' : ""}
      ${state.data.expertsDemo ? '<div class="notice">Sample trade experts are visible until Craftvoya has live records.</div>' : ""}
      ${
        experts.length
          ? `<div class="grid two">${experts.map(expertCard).join("")}</div>`
          : '<div class="empty-state"><h3>No experts online in this category.</h3><p>Try another lane or return after more experts publish availability.</p></div>'
      }
    </section>
  `;
}

export function bindMarketplace(root, actions) {
  root.querySelectorAll("[data-avatar-image]").forEach((image) => {
    image.addEventListener("error", () => {
      image.remove();
      image.parentElement?.classList.remove("has-image");
    });
  });
  root.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => actions.navigate(`/marketplace?category=${button.dataset.category}`));
  });
  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.navigate(button.dataset.route);
    });
  });
  root.querySelectorAll("[data-expert]").forEach((card) => {
    card.addEventListener("click", () => actions.navigate(`/expert/${encodeURIComponent(card.dataset.expert)}`));
  });
}
