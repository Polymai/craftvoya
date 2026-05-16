const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

export function renderPaymentSuccess(state) {
  const confirmation = state.data.paymentConfirmation;
  const session = state.data.activeSession;
  const status = confirmation?.status || (state.ui.routeLoading ? "checking" : "pending");
  return `
    <section class="route-view section">
      <div class="form-panel">
        <p class="eyebrow">Checkout return</p>
        <h2>${status === "paid" || status === "confirmed" ? "Payment confirmed." : "Checking payment status."}</h2>
        <p class="meta">Craftvoya asks the server to retrieve the Checkout Session and reconcile the local payment record before opening the session.</p>
        <span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>
        ${
          session
            ? `<button class="button primary" data-route="/session/${escapeHtml(session.id)}">Open consultation</button>`
            : '<div class="empty-state"><h3>Session not ready yet.</h3><p>Webhook fulfillment may still be pending. You can return here after Polymai provisions Supabase.</p></div>'
        }
        <button class="button ghost" data-route="/marketplace">Back to marketplace</button>
      </div>
    </section>
  `;
}

export function bindPaymentSuccess(root, actions) {
  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => actions.navigate(button.dataset.route));
  });
}
