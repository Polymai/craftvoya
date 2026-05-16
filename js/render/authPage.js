import { CATEGORIES } from "../config.js";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

function categoryOptions() {
  return CATEGORIES.map((category) => `<option value="${category.key}">${escapeHtml(category.label)}</option>`).join("");
}

function requestedRole(state) {
  if (state.route.query.role === "expert") return "expert";
  if (state.route.query.role === "customer") return "customer";
  return "";
}

function accountRole(state) {
  return state.auth.profile?.data?.role || "";
}

function isExpertRole(role) {
  return role === "expert" || role === "admin";
}

function roleChoice(state) {
  const signedIn = Boolean(state.auth.user);
  const customerRoute = signedIn ? "/auth?mode=complete&role=customer" : "/auth?mode=register&role=customer";
  const expertRoute = signedIn ? "/auth?mode=complete&role=expert" : "/auth?mode=register&role=expert";
  return `
    <section class="route-view section role-gate compact">
      <div class="role-gate-head">
        <div>
          <p class="eyebrow">Choose account type</p>
          <h2>Select one side.</h2>
          <p class="lede">Customer and expert accounts are separate. This choice cannot be changed inside the same Craftvoya account.</p>
        </div>
      </div>
      <div class="role-choice-grid">
        <article class="card role-card">
          <span class="chip active">Customer</span>
          <h3>Book calls</h3>
          <p class="meta">Browse experts, pay, join sessions, and leave reviews.</p>
          <div class="button-row">
            <button class="button primary" data-route="${customerRoute}">${signedIn ? "Choose customer" : "Create customer account"}</button>
            ${signedIn ? "" : '<button class="button ghost" data-route="/auth?mode=login&role=customer">Customer login</button>'}
          </div>
        </article>
        <article class="card role-card">
          <span class="chip">Expert</span>
          <h3>Take calls</h3>
          <p class="meta">Manage profile, availability, in-app video calls, paid jobs, and payouts.</p>
          <div class="button-row">
            <button class="button primary" data-route="${expertRoute}">${signedIn ? "Choose expert" : "Create expert account"}</button>
            ${signedIn ? "" : '<button class="button ghost" data-route="/auth?mode=login&role=expert">Expert login</button>'}
          </div>
        </article>
      </div>
    </section>
  `;
}

function completionForm(state) {
  const role = requestedRole(state);
  if (!role) {
    return roleChoice(state);
  }
  return `
    <section class="route-view section">
      <form class="form-panel" data-auth-form="complete">
        <div>
          <p class="eyebrow">${role === "expert" ? "Expert account" : "Customer account"}</p>
          <h2>${role === "expert" ? "Create your expert account." : "Create your customer account."}</h2>
          <p class="meta">This choice is fixed for this signed-in account.</p>
        </div>
        <label>
          Display name
          <input name="displayName" autocomplete="name" required value="${escapeHtml(state.auth.user?.email?.split("@")[0] || "")}">
        </label>
        <input type="hidden" name="role" value="${role}">
        ${role === "expert" ? `
          <label>
            Expert category
            <select name="category">
              ${categoryOptions()}
            </select>
          </label>
        ` : ""}
        <button class="button primary" type="submit">Continue</button>
      </form>
    </section>
  `;
}

function boundaryMessage(state) {
  const role = accountRole(state);
  const requested = requestedRole(state);
  if (!role || role === requested || (requested === "expert" && isExpertRole(role))) {
    return "";
  }
  const expert = isExpertRole(role);
  return `
    <section class="route-view section">
      <div class="form-panel">
        <p class="eyebrow">${expert ? "Expert account" : "Customer account"}</p>
        <h2>This account cannot enter the ${requested} side.</h2>
        <p class="meta">Craftvoya keeps customer and expert accounts separate. Log out and use a different account for the other side.</p>
        <div class="button-row">
          <button class="button primary" data-route="${expert ? "/dashboard" : "/marketplace"}">${expert ? "Open expert dashboard" : "Find experts"}</button>
        </div>
      </div>
    </section>
  `;
}

export function renderAuthPage(state) {
  if (state.auth.user && !state.auth.profile) {
    return completionForm(state);
  }

  if (state.auth.user && state.auth.profile) {
    const boundary = boundaryMessage(state);
    if (boundary) {
      return boundary;
    }
    const role = accountRole(state);
    const expert = isExpertRole(role);
    return `
      <section class="route-view section">
        <div class="form-panel">
          <p class="eyebrow">${expert ? "Expert account" : "Customer account"}</p>
          <h2>${escapeHtml(state.auth.profile.title)}</h2>
          <p class="meta">${expert ? "This account can manage expert settings and paid jobs." : "This account can book calls, pay, join sessions, and leave reviews."}</p>
          <div class="button-row">
            <button class="button primary" data-route="${expert ? "/dashboard" : "/marketplace"}">${expert ? "Open expert dashboard" : "Find experts"}</button>
          </div>
        </div>
      </section>
    `;
  }

  const mode = state.route.query.mode === "login" ? "login" : "register";
  const role = requestedRole(state);
  if (!role) {
    return roleChoice(state);
  }
  const isLogin = mode === "login";
  return `
    <section class="route-view section">
      <form class="form-panel" data-auth-form="${mode}">
        <div>
          <p class="eyebrow">${role === "expert" ? "Expert account" : "Customer account"}</p>
          <h2>${isLogin ? "Log in to Craftvoya." : (role === "expert" ? "Create an expert account." : "Create a customer account.")}</h2>
          <p class="meta">${role === "expert" ? "Expert accounts only manage profile, availability, in-app video calls, paid jobs, and payouts." : "Customer accounts only browse experts, pay for calls, join sessions, and leave reviews."}</p>
        </div>
        <div class="form-grid">
          ${isLogin ? "" : `
            <label>
              Display name
              <input name="displayName" autocomplete="name" required>
            </label>
          `}
          <label>
            Email
            <input name="email" type="email" autocomplete="email" required>
          </label>
          <label>
            Password
            <input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="6" required>
          </label>
          ${isLogin ? "" : `
            <input type="hidden" name="role" value="${role}">
            ${role === "expert" ? `
              <label>
                Expert category
                <select name="category">
                  ${categoryOptions()}
                </select>
              </label>
            ` : ""}
          `}
        </div>
        ${state.auth.notice ? `<div class="notice success">${escapeHtml(state.auth.notice)}</div>` : ""}
        ${state.auth.error ? `<div class="notice error">${escapeHtml(state.auth.error)}</div>` : ""}
        <button class="button primary" type="submit">${isLogin ? "Log in" : "Create account"}</button>
        <button class="button ghost" type="button" data-route="${isLogin ? `/auth?mode=register&role=${role}` : `/auth?mode=login&role=${role}`}">
          ${isLogin ? "Create an account" : "I already have an account"}
        </button>
      </form>
    </section>
  `;
}

export function bindAuthPage(root, actions, state) {
  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => actions.navigate(button.dataset.route));
  });

  const form = root.querySelector("[data-auth-form]");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const mode = form.dataset.authForm;
    const role = requestedRole(state);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      if (mode === "login") {
        await actions.signIn(payload);
        actions.navigate(role === "expert" ? "/dashboard" : "/marketplace");
      } else if (mode === "complete") {
        await actions.completeProfile(payload);
        actions.navigate(payload.role === "expert" ? "/dashboard" : "/marketplace");
      } else {
        const result = await actions.register(payload);
        if (result.session) {
          actions.navigate(payload.role === "expert" ? "/dashboard" : "/marketplace");
        }
      }
    } catch (error) {
      actions.showError(error.message);
    } finally {
      submit.disabled = false;
    }
  });
}
