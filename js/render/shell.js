const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

function accountName(state) {
  const name = state.auth.profile?.data?.displayName || state.auth.user?.email || "";
  return name ? escapeHtml(name.split("@")[0]) : "Account";
}

export function renderShell(state, viewHtml) {
  const signedIn = Boolean(state.auth.user);
  const role = state.auth.profile?.data?.role || "";
  const adminLink = role === "admin" ? '<button class="nav-link" data-route="/admin">Admin</button>' : "";
  const isExpertAccount = role === "expert" || role === "admin";
  const authControls = signedIn
    ? role
      ? `<span class="account-label"><span>${isExpertAccount ? "Expert" : "Customer"}</span>${accountName(state)}</span><button class="button ghost" data-action="logout">Log out</button>`
      : '<span class="chip">Choose account type</span><button class="button ghost" data-action="logout">Log out</button>'
    : '<button class="nav-link" data-route="/auth?mode=login&role=customer">Customer login</button><button class="nav-link" data-route="/auth?mode=login&role=expert">Expert login</button>';
  const primaryLinks = signedIn
    ? (role
      ? (isExpertAccount
        ? `<button class="nav-link" data-route="/dashboard">Dashboard</button>${adminLink}`
        : '<button class="nav-link" data-route="/dashboard">Dashboard</button><button class="nav-link" data-route="/marketplace">Find an expert</button>')
      : '<button class="nav-link" data-route="/">Choose customer or expert</button>')
    : `
      <button class="nav-link" data-route="/auth?mode=register&role=customer">Customer</button>
      <button class="nav-link" data-route="/auth?mode=register&role=expert">Expert</button>
    `;

  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="wordmark" href="#/" aria-label="Craftvoya home">
          <span class="wordmark-main" aria-hidden="true">
            <span>Craft</span><span class="wordmark-v"></span><span>oya</span>
          </span>
        </a>
        <nav class="header-nav" aria-label="Primary navigation">
          ${primaryLinks}
        </nav>
        <div class="header-actions">
          ${authControls}
        </div>
        <button class="mobile-menu-button" type="button" data-action="toggle-mobile-menu" aria-label="Open menu" aria-expanded="false">
          <span></span>
          <span></span>
        </button>
      </div>
      <div class="mobile-menu-backdrop" data-action="close-mobile-menu"></div>
      <nav class="mobile-drawer" data-mobile-drawer aria-label="Mobile navigation">
        ${primaryLinks}
        <div class="mobile-drawer-actions">
          ${authControls}
        </div>
      </nav>
    </header>
    <main class="page-shell" id="main-content">
      ${state.ui.actionNotice ? `<div class="notice" role="status">${escapeHtml(state.ui.actionNotice)}</div>` : ""}
      ${state.ui.actionError ? `<div class="notice error" role="alert">${escapeHtml(state.ui.actionError)}</div>` : ""}
      ${state.ui.routeError ? `<div class="notice error" role="alert">${escapeHtml(state.ui.routeError)}</div>` : ""}
      ${viewHtml}
    </main>
    <div class="site-loader" data-site-loader role="status" aria-live="polite" aria-atomic="true">
      <div class="site-loader-card">
        <span class="site-loader-spinner" aria-hidden="true"></span>
        <strong data-site-loader-title>Opening Stripe</strong>
        <span class="site-loader-message" data-site-loader-message>Preparing the secure Stripe page...</span>
      </div>
    </div>
  `;
}

export function bindShell(root, actions) {
  const closeMobileMenu = () => {
    root.classList.remove("menu-open");
    const button = root.querySelector('[data-action="toggle-mobile-menu"]');
    if (button) {
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open menu");
    }
  };

  const toggleMobileMenu = root.querySelector('[data-action="toggle-mobile-menu"]');
  if (toggleMobileMenu) {
    toggleMobileMenu.addEventListener("click", () => {
      const isOpen = root.classList.toggle("menu-open");
      toggleMobileMenu.setAttribute("aria-expanded", String(isOpen));
      toggleMobileMenu.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });
  }

  root.querySelectorAll('[data-action="close-mobile-menu"]').forEach((element) => {
    element.addEventListener("click", closeMobileMenu);
  });

  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      closeMobileMenu();
      actions.navigate(button.dataset.route);
    });
  });

  root.querySelectorAll('[data-action="logout"]').forEach((logout) => {
    logout.addEventListener("click", async () => {
      try {
        closeMobileMenu();
        await actions.logout();
        actions.navigate("/");
      } catch (error) {
        actions.showError(error.message);
      }
    });
  });
}
