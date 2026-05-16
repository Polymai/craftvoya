import { APP_CONFIG, estimateNetOfInclusiveTax, formatMoney } from "../config.js";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

function rows(records, type) {
  const filtered = (records || []).filter((record) => record.entity_type === type);
  if (!filtered.length) {
    return `<div class="empty-state">No ${escapeHtml(type.replace("_", " "))} records yet.</div>`;
  }
  return `
    <div class="table-panel">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (record) => `
                <tr>
                  <td>${escapeHtml(record.title || record.id)}</td>
                  <td><span class="status-pill ${escapeHtml(record.status)}">${escapeHtml(record.status)}</span></td>
                  <td>${escapeHtml(record.category || "-")}</td>
                  <td>${formatMoney(record.amount_cents || 0, record.currency)}</td>
                  <td>${record.updated_at ? new Date(record.updated_at).toLocaleString() : "-"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAdminPanel(state) {
  if (state.auth.profile?.data?.role !== "admin") {
    return `
      <section class="route-view section">
        <div class="empty-state">
          <h2>Admin access required.</h2>
          <p>Admin rights are resolved from your Craftvoya app profile.</p>
        </div>
      </section>
    `;
  }
  const records = state.data.adminRecords || [];
  const payments = records.filter((record) => record.entity_type === "payment");
  const paidNetVolume = payments
    .filter((record) => record.status === "paid")
    .reduce((sum, record) => sum + estimateNetOfInclusiveTax(record.amount_cents || 0), 0);
  const commission = Math.round(paidNetVolume * APP_CONFIG.commissionRate);
  return `
    <section class="route-view stack">
      <div class="section-head">
        <div>
          <p class="eyebrow">Admin review</p>
          <h2>Craftvoya marketplace control.</h2>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><strong>${records.filter((record) => record.entity_type === "expert_profile").length}</strong><span>Experts</span></div>
        <div class="stat"><strong>${records.filter((record) => record.entity_type === "session").length}</strong><span>Sessions</span></div>
        <div class="stat"><strong>${formatMoney(commission)}</strong><span>Platform commission</span></div>
      </div>
      <article class="stack">
        <h3>Experts</h3>
        ${rows(records, "expert_profile")}
      </article>
      <article class="stack">
        <h3>Sessions</h3>
        ${rows(records, "session")}
      </article>
      <article class="stack">
        <h3>Payments</h3>
        ${rows(records, "payment")}
      </article>
      <article class="stack">
        <h3>Reviews</h3>
        ${rows(records, "review")}
      </article>
    </section>
  `;
}

export function bindAdminPanel() {}
