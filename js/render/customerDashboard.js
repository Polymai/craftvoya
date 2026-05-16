import { formatMoney } from "../config.js";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return "No date";
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(value = "") {
  return String(value || "pending").replace(/_/g, " ");
}

function shortStripeId(value = "") {
  const id = String(value || "");
  if (!id) return "";
  return id.length > 18 ? `${id.slice(0, 10)}...${id.slice(-6)}` : id;
}

function collapsibleSection({ section, kicker, title, status, statusClass = "pending", body }) {
  return `
    <details class="dashboard-collapsible" data-section="${escapeHtml(section)}" open>
      <summary>
        <span>
          <span class="eyebrow">${escapeHtml(kicker)}</span>
          <strong>${escapeHtml(title)}</strong>
        </span>
        ${status ? `<span class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(status)}</span>` : ""}
      </summary>
      <div class="dashboard-collapsible-body">
        ${body}
      </div>
    </details>
  `;
}

function callRows(sessions = []) {
  if (!sessions.length) {
    return `
      <div class="empty-state">
        <h3>No previous calls yet.</h3>
        <p>Booked Craftvoya consultations will appear here after checkout.</p>
        <button class="button primary" data-route="/marketplace">Find an expert</button>
      </div>
    `;
  }

  return sessions
    .map((session) => `
      <article class="session-bar">
        <div>
          <strong>${escapeHtml(session.title || "Craftvoya consultation")}</strong>
          <div class="meta">${formatDate(session.created_at)} &middot; ${formatMoney(session.amount_cents, session.currency)}</div>
        </div>
        <div class="button-row">
          <span class="status-pill ${escapeHtml(session.status || "pending")}">${escapeHtml(statusLabel(session.status))}</span>
          <button class="button ghost" data-route="/session/${escapeHtml(session.id)}">Open call</button>
        </div>
      </article>
    `)
    .join("");
}

function receiptRows(payments = []) {
  if (!payments.length) {
    return `
      <div class="empty-state">
        <h3>No receipts yet.</h3>
        <p>Stripe receipt records will appear here after your first paid consultation.</p>
        <button class="button ghost" data-action="manage-billing">Open Stripe billing</button>
      </div>
    `;
  }

  return payments
    .map((payment) => {
      const stripeId = shortStripeId(payment.stripe_session_id || payment.data?.checkoutSessionId || "");
      const canOpenReceipt = payment.status === "paid" || Boolean(payment.data?.receiptUrl);
      const taxAmount = Number(payment.data?.taxAmountCents || 0);
      const taxText = taxAmount > 0 ? ` &middot; incl. VAT ${formatMoney(taxAmount, payment.currency)}` : "";
      return `
        <article class="session-bar">
          <div>
            <strong>${escapeHtml(payment.title || payment.data?.title || "Craftvoya receipt")}</strong>
            <div class="meta">${formatDate(payment.created_at)}${stripeId ? ` &middot; Stripe ${escapeHtml(stripeId)}` : ""}${taxText}</div>
          </div>
          <div class="button-row">
            <span class="status-pill ${escapeHtml(payment.status || "pending")}">${escapeHtml(statusLabel(payment.status))}</span>
            <span class="price">${formatMoney(payment.amount_cents, payment.currency)}</span>
            <button class="button ghost" data-action="open-receipt" data-payment-id="${escapeHtml(payment.id)}"${canOpenReceipt ? "" : " disabled"}>${canOpenReceipt ? "Receipt" : "Pending"}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function portalInvoiceCount(payments = []) {
  return payments.filter((payment) => payment.data?.stripeInvoiceId || payment.data?.hostedInvoiceUrl).length;
}

function renderBillingCard(profile, payments) {
  const customerId = profile?.stripe_customer_id || profile?.data?.stripeCustomerId || payments.find((payment) => payment.stripe_customer_id)?.stripe_customer_id || "";
  const invoiceCount = portalInvoiceCount(payments);
  return `
    <article class="dashboard-info-card">
      <p class="meta">Use the receipt buttons for card receipts. New checkouts also create Stripe invoices that show included VAT and appear in the portal with billing details and payment methods.</p>
      <div class="dashboard-mini-grid">
        <div class="dashboard-mini-stat"><strong>${customerId ? "Linked" : "After checkout"}</strong><span>Stripe customer</span></div>
        <div class="dashboard-mini-stat"><strong>${invoiceCount}</strong><span>Portal invoices</span></div>
      </div>
      <div class="dashboard-action-row">
        <button class="button primary" data-action="manage-billing">Open Stripe portal</button>
        <button class="button ghost" data-action="refresh-dashboard">Refresh</button>
      </div>
    </article>
  `;
}

function showActionProblem(actions, error) {
  if (error?.setupRequired) {
    actions.showNotice(error.message);
    return;
  }
  actions.showError(error.message);
}

export function renderCustomerDashboard(state) {
  if (!state.auth.user) {
    return '<section class="route-view section"><div class="empty-state"><h2>Customer dashboard needs sign-in.</h2><button class="button primary" data-route="/auth?mode=login&role=customer">Customer login</button></div></section>';
  }

  const dashboard = state.data.dashboard || {};
  const sessions = dashboard.sessions || state.data.sessions || [];
  const payments = dashboard.payments || state.data.payments || [];
  const activeSessions = dashboard.activeSessions || sessions.filter((session) => ["paid", "active"].includes(session.status));
  const completedSessions = dashboard.completedSessions || sessions.filter((session) => ["complete", "completed"].includes(session.status));
  const totalSpend = Number(dashboard.totalSpend || 0);
  const invoiceCount = portalInvoiceCount(payments);

  return `
    <section class="route-view stack">
      <div class="section-head dashboard-hero">
        <div>
          <p class="eyebrow">Customer home</p>
          <h2>Your calls and receipts.</h2>
          <p class="lede">Review past Craftvoya consultations, return to active calls, and open Stripe for invoices or billing details.</p>
        </div>
        <div class="status-controls">
          <button class="button primary" data-route="/marketplace">Find an expert</button>
          <button class="button ghost" data-action="manage-billing">Stripe portal</button>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><strong>${sessions.length}</strong><span>Total calls</span></div>
        <div class="stat"><strong>${activeSessions.length}</strong><span>Open calls</span></div>
        <div class="stat"><strong>${formatMoney(totalSpend)}</strong><span>Paid receipts</span></div>
      </div>
      <div class="split">
        <div class="stack">
          ${collapsibleSection({
            section: "calls",
            kicker: "Previous calls",
            title: "Consultation history",
            status: `${sessions.length} total`,
            statusClass: sessions.length ? "paid" : "pending",
            body: `<div class="timeline">${callRows(sessions)}</div>`,
          })}
          ${collapsibleSection({
            section: "receipts",
            kicker: "Receipts",
            title: "Payment history",
            status: `${payments.length} records`,
            statusClass: payments.length ? "paid" : "pending",
            body: `<div class="timeline">${receiptRows(payments)}</div>`,
          })}
        </div>
        <div class="stack">
          ${collapsibleSection({
            section: "billing",
            kicker: "Stripe",
            title: "Stripe portal",
            status: invoiceCount ? "Invoices ready" : (payments.length ? "Receipts only" : "No history"),
            statusClass: invoiceCount ? "paid" : "pending",
            body: renderBillingCard(state.auth.profile, payments),
          })}
          ${collapsibleSection({
            section: "summary",
            kicker: "Account",
            title: "Call status summary",
            status: completedSessions.length ? "Used before" : "New customer",
            statusClass: completedSessions.length ? "paid" : "pending",
            body: `
              <article class="dashboard-info-card">
                <div class="dashboard-mini-grid">
                  <div class="dashboard-mini-stat"><strong>${completedSessions.length}</strong><span>Completed calls</span></div>
                  <div class="dashboard-mini-stat"><strong>${payments.filter((payment) => payment.status === "pending").length}</strong><span>Pending receipts</span></div>
                </div>
                <p class="meta">After checkout, open calls show the in-app video room and session timer from the call page.</p>
              </article>
            `,
          })}
        </div>
      </div>
    </section>
  `;
}

export function bindCustomerDashboard(root, actions) {
  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => actions.navigate(button.dataset.route));
  });

  root.querySelectorAll('[data-action="manage-billing"]').forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      actions.showSiteLoader("Opening Stripe portal...");
      try {
        const result = await actions.createBillingPortal();
        if (!result?.url) {
          throw new Error("Stripe did not return a billing link.");
        }
        window.location.assign(result.url);
      } catch (error) {
        actions.hideSiteLoader?.();
        showActionProblem(actions, error);
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-action="open-receipt"]').forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = "Opening...";
      actions.showSiteLoader("Opening Stripe receipt...");
      try {
        const result = await actions.openPaymentReceipt(button.dataset.paymentId);
        if (!result?.url) {
          throw new Error("Stripe did not return a receipt link.");
        }
        window.location.assign(result.url);
      } catch (error) {
        actions.hideSiteLoader?.();
        showActionProblem(actions, error);
        button.disabled = false;
        button.textContent = previousText;
      }
    });
  });

  root.querySelectorAll('[data-action="refresh-dashboard"]').forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await actions.refresh();
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}
