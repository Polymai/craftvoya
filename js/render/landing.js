const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

export function renderLanding(state) {
  const signedIn = Boolean(state.auth.user);
  const role = state.auth.profile?.data?.role || "";
  const isExpertAccount = role === "expert" || role === "admin";
  const hasFixedRole = signedIn && role;
  const customerRoute = signedIn && !role ? "/auth?mode=complete&role=customer" : "/auth?mode=register&role=customer";
  const expertRoute = signedIn && !role ? "/auth?mode=complete&role=expert" : "/auth?mode=register&role=expert";

  if (hasFixedRole) {
    return `
      <section class="route-view section">
        <div class="empty-state">
          <p class="eyebrow">${isExpertAccount ? "Expert account" : "Customer account"}</p>
          <h2>${isExpertAccount ? "Open your expert workspace." : "Open your customer workspace."}</h2>
          <p>This Craftvoya account is locked to the ${escapeHtml(role)} side.</p>
          <button class="button primary" data-route="${isExpertAccount ? "/dashboard" : "/marketplace"}">
            ${isExpertAccount ? "Go to expert dashboard" : "Find an expert"}
          </button>
        </div>
      </section>
    `;
  }

  return `
    <section class="route-view hero role-hero">
      <div class="hero-copy">
        <p class="eyebrow">Live home project help</p>
        <h1>Expert help before the first hole.</h1>
        <p class="lede">Choose how you want to use Craftvoya. Customers book paid video calls with available trade experts; experts set up a profile and take calls when they are ready.</p>
        <div class="hero-actions">
          <span class="chip">Stripe checkout</span>
          <span class="chip">In-app video calls</span>
          <span class="chip">Fast trade guidance</span>
        </div>
      </div>
      <aside class="role-hero-panel" aria-label="Choose account type">
        <div class="role-hero-panel-head">
          <p class="eyebrow">Choose account type</p>
          <h2>Start on one side.</h2>
          <p>Customer accounts book calls. Expert accounts take calls and manage payouts.</p>
        </div>
        <div class="role-hero-options">
          <article class="role-hero-option" data-route="${customerRoute}">
            <span class="chip active">Customer</span>
            <div>
              <h3>Book a paid call.</h3>
              <p>Find an online expert, pay through Stripe, then join the in-app video session.</p>
            </div>
            <div class="button-row">
              <button class="button primary" data-route="${customerRoute}">${signedIn ? "Choose customer" : "Continue as customer"}</button>
              ${signedIn ? "" : '<button class="button ghost" data-route="/auth?mode=login&role=customer">Customer login</button>'}
            </div>
          </article>
          <article class="role-hero-option" data-route="${expertRoute}">
            <span class="chip">Expert</span>
            <div>
              <h3>Take paid calls.</h3>
              <p>Set your trade profile, turn on availability, and manage Stripe payouts.</p>
            </div>
            <div class="button-row">
              <button class="button primary" data-route="${expertRoute}">${signedIn ? "Choose expert" : "Continue as expert"}</button>
              ${signedIn ? "" : '<button class="button ghost" data-route="/auth?mode=login&role=expert">Expert login</button>'}
            </div>
          </article>
        </div>
        <p class="role-gate-note">Need both roles? Use two separate Craftvoya accounts.</p>
      </aside>
    </section>
    <section class="section" id="how-we-help">
      <div class="section-head">
        <div>
          <p class="eyebrow">How it works</p>
          <h2>Get a practical answer while the project is still fixable.</h2>
        </div>
      </div>
      <div class="grid three">
        <article class="card">
          <div>
            <span class="chip active">1</span>
            <h3>Pick a trade</h3>
            <p class="meta">Choose from carpentry, TV mounting, painting, flooring, plumbing, smart home, and general handyman support.</p>
          </div>
        </article>
        <article class="card">
          <div>
            <span class="chip active">2</span>
            <h3>Pay before the call</h3>
            <p class="meta">Checkout confirms the consultation, creates the local session, and records your receipt history.</p>
          </div>
        </article>
        <article class="card">
          <div>
            <span class="chip active">3</span>
            <h3>Join the room</h3>
            <p class="meta">Open the session page, join the in-app video room, and keep the call history in your dashboard.</p>
          </div>
        </article>
      </div>
    </section>
  `;
}

export function bindLanding(root, actions) {
  root.querySelectorAll("[data-route]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.navigate(element.dataset.route);
    });
  });
}
