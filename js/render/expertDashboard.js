import { CATEGORIES, categoryByKey, formatMoney } from "../config.js";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

const DASHBOARD_SESSION_LIMIT = 6;

function categoryOptions(selected = "carpentry") {
  return CATEGORIES.map((category) => `<option value="${category.key}"${category.key === selected ? " selected" : ""}>${escapeHtml(category.label)}</option>`).join("");
}

function portfolioImagesMarkup(images = [], compact = false) {
  const visibleImages = (Array.isArray(images) ? images : []).filter(Boolean).slice(0, compact ? 3 : 6);
  if (!visibleImages.length) {
    return "";
  }
  return `
    <div class="portfolio-grid${compact ? " compact" : ""}">
      ${visibleImages.map((url) => `<img src="${escapeHtml(url)}" alt="Portfolio work sample" loading="lazy">`).join("")}
    </div>
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

function collapsibleSection({ section, kicker, title, titleClass = "", status, statusClass = "pending", body }) {
  const titleClassAttr = titleClass ? ` class="${escapeHtml(titleClass)}"` : "";
  return `
    <details class="dashboard-collapsible" data-section="${escapeHtml(section)}" open>
      <summary>
        <span>
          <span class="eyebrow">${escapeHtml(kicker)}</span>
          <strong${titleClassAttr}>${escapeHtml(title)}</strong>
        </span>
        ${status ? `<span class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(status)}</span>` : ""}
      </summary>
      <div class="dashboard-collapsible-body">
        ${body}
      </div>
    </details>
  `;
}

function sessionRows(sessions = []) {
  if (!sessions.length) {
    return '<div class="empty-state"><h3>No calls yet.</h3><p>Paid customer sessions will appear here.</p></div>';
  }
  return sessions
    .map((session) => {
      const status = String(session.status || "");
      const statusAction = status === "active"
        ? `<button class="button ghost" data-session-status="complete" data-session-id="${escapeHtml(session.id)}">Complete</button>`
        : "";
      return `
        <article class="session-bar">
          <div>
            <strong>${escapeHtml(session.title || "Craftvoya session")}</strong>
            <div class="meta">${escapeHtml(session.status)} &middot; ${formatMoney(session.amount_cents, session.currency)}</div>
          </div>
          <div class="button-row">
            <button class="button ghost" data-route="/session/${escapeHtml(session.id)}">Open</button>
            ${statusAction}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSessionHistory(sessions = []) {
  const visibleSessions = sessions.slice(0, DASHBOARD_SESSION_LIMIT);
  const total = sessions.length;
  const summary = total > DASHBOARD_SESSION_LIMIT
    ? `<p class="meta">Showing latest ${DASHBOARD_SESSION_LIMIT} of ${total} paid calls.</p>`
    : "";
  return `
    <article class="stack" data-session-list>
      ${summary}
      <div class="timeline">${sessionRows(visibleSessions)}</div>
    </article>
  `;
}

function onboardingAction(action) {
  if (!action) {
    return "";
  }
  if (action.disabled) {
    return `<button class="button ghost onboarding-action" disabled>${escapeHtml(action.label)}</button>`;
  }
  const attributes = {
    profile: 'data-action="focus-profile"',
    payouts: 'data-action="connect-payouts"',
    online: 'data-availability="online"',
    sessions: 'data-action="focus-sessions"',
  };
  if (!attributes[action.type]) {
    return "";
  }
  return `<button class="button ghost onboarding-action" ${attributes[action.type]}>${escapeHtml(action.label)}</button>`;
}

function dashboardPrimaryAction({ payoutReady, isOnline }) {
  if (!payoutReady) {
    return '<button class="button primary" data-action="focus-payouts">Set up payouts</button>';
  }
  return `<button class="button primary" data-availability="online">${isOnline ? "Refresh call status" : "Start taking calls"}</button>`;
}

function showActionProblem(actions, error) {
  if (error?.setupRequired) {
    actions.showNotice(error.message);
    return;
  }
  actions.showError(error.message);
}

function hasTradeDetails(profile, data) {
  const hasSavedListing = Boolean(profile.id);
  return Boolean(
    hasSavedListing &&
      profile.title &&
      profile.category &&
      Number(profile.amount_cents || 0) > 0 &&
      String(data.headline || "").trim() &&
      String(data.bio || "").trim(),
  );
}

function onboardingSteps(profile, data, payoutReady) {
  const tradeDetailsReady = hasTradeDetails(profile, data);
  return [
    {
      title: "Fill in your profile",
      detail: "Add your name, trade, price, and a short note about what you can help with.",
      done: tradeDetailsReady,
      action: { type: "profile", label: profile.id ? "Edit profile" : "Start here" },
    },
    {
      title: "Set up payouts",
      detail: "Open Stripe's secure onboarding, add payout details, and return here when Stripe marks payouts ready.",
      done: payoutReady,
      action: tradeDetailsReady ? { type: "payouts", label: "Set up payouts" } : null,
    },
    {
      title: "In-app video ready",
      detail: "Craftvoya opens a browser call room after payment.",
      done: true,
      action: null,
    },
  ];
}

function renderOnboarding(profile, data, dashboard, isOnline, activeMeetUrl, payoutReady) {
  const tradeDetailsReady = hasTradeDetails(profile, data);
  const setupReady = Boolean(tradeDetailsReady && payoutReady);
  if (setupReady) {
    return collapsibleSection({
      section: "setup",
      kicker: "Availability",
      title: isOnline ? "You are online." : "You are offline.",
      titleClass: isOnline ? "availability-title online" : "availability-title offline",
      status: "",
      statusClass: isOnline ? "online" : "pending",
      body: `
      <article class="dashboard-info-card">
        <p class="meta">${isOnline ? "Customers can book you now. Stop calls when you are busy." : "You are not visible in the marketplace right now. Start calls when you are ready for new paid sessions."}</p>
      </article>
    `,
    });
  }
  const steps = onboardingSteps(profile, data, payoutReady);
  const complete = steps.filter((step) => step.done).length;
  const percent = Math.round((complete / steps.length) * 100);
  const nextStep = steps.find((step) => !step.done);
  return collapsibleSection({
    section: "setup",
    kicker: "Simple setup",
    title: nextStep ? `Next: ${nextStep.title}` : "Setup complete",
    status: `${complete} of ${steps.length}`,
    statusClass: complete === steps.length ? "paid" : "pending",
    body: `
    <article class="onboarding-card">
      <div class="onboarding-head">
        <div>
          <h3>${nextStep ? "Do these steps once, then start taking calls." : "You are ready for customers."}</h3>
          <p class="meta">${nextStep ? `Next step: ${escapeHtml(nextStep.title.toLowerCase())}.` : "Keep your call link current and stop calls when you are busy."}</p>
        </div>
        <div class="onboarding-score">
          <strong>${complete} of ${steps.length}</strong>
          <span>done</span>
        </div>
      </div>
      <div class="onboarding-meter" aria-label="${percent}% onboarding complete">
        <span style="width: ${percent}%"></span>
      </div>
      <div class="onboarding-steps">
        ${steps
          .map(
            (step, index) => `
              <div class="onboarding-step${step.done ? " done" : ""}">
                <div class="onboarding-index">${step.done ? "Done" : String(index + 1).padStart(2, "0")}</div>
                <div>
                  <strong>${escapeHtml(step.title)}</strong>
                  <p>${escapeHtml(step.detail)}</p>
                </div>
                ${step.done ? "" : onboardingAction(step.action)}
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `,
  });
}

function renderPublicPreviewSurface(profile, data, isOnline, activeMeetUrl, payoutReady) {
  const category = categoryByKey(profile.category || "carpentry");
  const title = profile.title || "Your expert name";
  const initials = data.initials || title.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "EX";
  const headline = data.headline || "Short headline customers will see";
  const bio = data.bio || "Add a short, practical note about what you can help customers solve on a paid call.";
  const bookable = Boolean(isOnline && payoutReady);
  const portfolioImages = Array.isArray(data.portfolioImages) ? data.portfolioImages : [];
  const socialLinks = data.socialLinks || {};
  return `
    <div class="public-preview-surface" data-public-preview>
      <div class="profile-hero">
        ${avatarMarkup(initials, data.avatarUrl, "avatar-lg")}
        <div>
          <p class="eyebrow">${escapeHtml(category.label)}</p>
          <h2>${escapeHtml(title)}</h2>
          <p class="lede">${escapeHtml(headline)}</p>
        </div>
      </div>
      <div class="stat-grid profile-stats public-stats">
        <div class="stat"><strong>${data.rating || 5}</strong><span>Average rating</span></div>
        <div class="stat"><strong>${data.years || 1}</strong><span>Years experience</span></div>
      </div>
      <p>${escapeHtml(bio)}</p>
      ${portfolioImagesMarkup(portfolioImages, true)}
      ${socialLinksMarkup(socialLinks)}
      <div class="button-row">
        <span class="status-pill ${bookable ? "online" : "pending"}">${bookable ? "online" : "offline"}</span>
        <span class="status-pill paid">In-app video ready</span>
        <span class="price">${formatMoney(profile.amount_cents || 0)} incl. VAT</span>
      </div>
      <div class="preview-checkout-row">
        <button class="button primary" disabled>${bookable ? "Start checkout" : "Checkout hidden until ready"}</button>
        <p class="meta">Customers join the in-app room after checkout and after the expert opens the call.</p>
      </div>
    </div>
  `;
}

function renderPublicPreviewModal(profile, data, isOnline, activeMeetUrl, payoutReady) {
  return `
    <div class="modal-backdrop profile-preview-modal" data-preview-modal hidden>
      <div class="modal-panel preview-modal-panel" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Public page preview</p>
            <h3 id="preview-modal-title">What customers will see</h3>
          </div>
          <button class="button ghost" type="button" data-action="close-preview">Close</button>
        </div>
        ${renderPublicPreviewSurface(profile, data, isOnline, activeMeetUrl, payoutReady)}
      </div>
    </div>
  `;
}

function renderExpertReadiness({ isOnline, payoutReady, hasConnectAccount, connectStatus, data }) {
  const payoutLabel = payoutReady ? "Ready" : (hasConnectAccount ? "Pending" : "Setup needed");
  const title = isOnline ? "Customers can book you now" : (payoutReady ? "Ready when you are" : "Finish payouts to go live");
  const status = isOnline ? "Live" : (payoutReady ? "Ready" : "Needs setup");
  const statusClass = isOnline ? "online" : (payoutReady ? "paid" : "pending");
  const note = payoutReady
    ? (isOnline ? "You are visible in the marketplace. Stop calls when you are busy." : "Start taking calls when you want to appear in the marketplace.")
    : "Finish Stripe payout setup once before customers can book you.";
  return collapsibleSection({
    section: "payouts",
    kicker: "Ready check",
    title,
    status,
    statusClass,
    body: `
    <article class="dashboard-info-card">
      <div class="readiness-list">
        <div class="readiness-item ${isOnline ? "ok" : ""}">
          <span>Marketplace</span>
          <strong>${isOnline ? "Online" : "Offline"}</strong>
        </div>
        <div class="readiness-item ok">
          <span>Payment</span>
          <strong>Checkout first</strong>
        </div>
        <div class="readiness-item ok">
          <span>Video</span>
          <strong>In-app room</strong>
        </div>
        <div class="readiness-item ${payoutReady ? "ok" : "pending"}">
          <span>Payouts</span>
          <strong>${escapeHtml(payoutLabel)}</strong>
        </div>
      </div>
      <p class="meta">${escapeHtml(note)}</p>
      ${connectStatus && hasConnectAccount && !payoutReady ? `<p class="meta">Stripe status: ${escapeHtml(connectStatus)}.</p>` : ""}
      ${data.onlineMeetEndsAt ? `<p class="meta">Current call window ends ${escapeHtml(new Date(data.onlineMeetEndsAt).toLocaleString())} unless you stop calls first.</p>` : ""}
      <div class="dashboard-action-row">
        ${
          payoutReady
            ? `<button class="button primary" data-availability="${isOnline ? "offline" : "online"}">${isOnline ? "Stop calls" : "Start taking calls"}</button>`
            : `<button class="button primary" data-action="connect-payouts">${hasConnectAccount ? "Continue Stripe setup" : "Set up payouts"}</button>`
        }
        ${hasConnectAccount ? '<button class="button ghost" data-action="connect-dashboard">Stripe payouts</button>' : ""}
        ${hasConnectAccount && !payoutReady ? '<button class="button ghost" data-action="refresh-connect">Check status</button>' : ""}
      </div>
    </article>
  `,
  });
}

export function renderExpertDashboard(state) {
  if (!state.auth.user) {
    return '<section class="route-view section"><div class="empty-state"><h2>Expert dashboard needs sign-in.</h2><button class="button primary" data-route="/auth?mode=login&role=expert">Expert login</button></div></section>';
  }
  const dashboard = state.data.dashboard || {};
  const profile = dashboard.expertProfile || {};
  const data = profile.data || {};
  const isOnline = data.availability === "online";
  const activeMeetUrl = data.meetUrl || "";
  const hasConnectAccount = Boolean(profile.stripe_connect_account_id || data.stripeConnectAccountId);
  const payoutReady = Boolean(profile.stripe_connect_onboarding_complete || data.stripeConnectOnboardingComplete);
  const connectStatus = data.stripeConnectStatus || (payoutReady ? "active" : (hasConnectAccount ? "pending" : "not_started"));
  const setupReady = Boolean(hasTradeDetails(profile, data) && payoutReady);
  const paidSessions = dashboard.sessions || [];
  const canStopCalls = Boolean(isOnline);
  return `
    <section class="route-view stack">
      <div class="section-head dashboard-hero">
        <div>
          <p class="eyebrow">Expert home</p>
          <h2>${setupReady ? "Take paid calls when you are ready." : "Set up once. Start taking paid calls."}</h2>
          <p class="lede">${setupReady ? `${isOnline && activeMeetUrl ? "You are online and customers can book you now." : "You are offline. Start calls when you want to appear in the marketplace."}` : "Keep this page simple: save your profile, set up payouts, then turn yourself on when you are ready."}</p>
        </div>
        <div class="status-controls">
          ${dashboardPrimaryAction({ payoutReady, isOnline })}
          <button class="button ghost" data-action="focus-preview">Preview page</button>
          ${canStopCalls ? '<button class="button ghost" data-availability="offline">Stop calls</button>' : ""}
          ${hasConnectAccount ? '<button class="button ghost" data-action="connect-dashboard">Stripe payouts</button>' : ""}
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><strong>${paidSessions.length}</strong><span>Paid calls</span></div>
        <div class="stat"><strong>${formatMoney(dashboard.gross || 0)}</strong><span>Total paid</span></div>
        <div class="stat"><strong>${formatMoney(dashboard.net || 0)}</strong><span>Your estimate after VAT</span></div>
      </div>
      ${renderOnboarding(profile, data, dashboard, isOnline, activeMeetUrl, payoutReady)}
      <div class="split">
        <div class="stack">
          ${collapsibleSection({
            section: "profile",
            kicker: "Profile editor",
            title: "Edit public details",
            status: hasTradeDetails(profile, data) ? "Saved" : "Needs details",
            statusClass: hasTradeDetails(profile, data) ? "paid" : "pending",
            body: `
          <form class="simple-profile-form" data-expert-form>
            <div>
              <p class="meta">Use normal words. Customers just need to know what you do and how you can help.</p>
            </div>
            <label>
              Your name
              <input name="title" required value="${escapeHtml(profile.title || state.auth.profile?.title || "")}">
            </label>
            <div class="form-grid three">
              <label>
                Your trade
                <select name="category">${categoryOptions(profile.category || "carpentry")}</select>
              </label>
              <label>
                Price customers pay, incl. VAT
                <input name="rate" type="number" min="5" max="500" step="1" value="${Math.round(Number(profile.amount_cents || 2900) / 100)}">
              </label>
              <label>
                Years experience
                <input name="years" type="number" min="0" max="80" step="1" value="${Number(data.years || 1)}">
              </label>
            </div>
            <label>
              Short headline
              <input name="headline" placeholder="Example: I help with walls, framing, and TV mounting" value="${escapeHtml(data.headline || "")}">
            </label>
            <label>
              What can you help with?
              <textarea name="bio" placeholder="Example: Send me photos or join the call. I will help you plan the wall, find studs, choose screws, and avoid mistakes.">${escapeHtml(data.bio || "")}</textarea>
            </label>
            <label>
              Profile photo
              <input name="avatarFile" type="file" accept="image/*">
            </label>
            <div class="profile-editor-block">
              <div>
                <p class="eyebrow">Portfolio</p>
                <p class="meta">Add finished work, before/after examples, or project photos customers can trust.</p>
              </div>
              <label>
                Portfolio image URLs
                <textarea name="portfolioImageUrls" placeholder="https://example.com/project-photo.jpg">${escapeHtml((Array.isArray(data.portfolioImages) ? data.portfolioImages : []).join("\n"))}</textarea>
              </label>
              <label>
                Upload portfolio images
                <input name="portfolioFiles" type="file" accept="image/*" multiple>
              </label>
            </div>
            <div class="profile-editor-block">
              <div>
                <p class="eyebrow">Social links</p>
                <p class="meta">Optional links that make the profile easier to trust.</p>
              </div>
              <div class="form-grid three">
                <label>
                  LinkedIn
                  <input name="linkedinUrl" inputmode="url" placeholder="https://linkedin.com/in/..." value="${escapeHtml(data.socialLinks?.linkedin || "")}">
                </label>
                <label>
                  Instagram
                  <input name="instagramUrl" inputmode="url" placeholder="https://instagram.com/..." value="${escapeHtml(data.socialLinks?.instagram || "")}">
                </label>
                <label>
                  Website
                  <input name="websiteUrl" inputmode="url" placeholder="https://example.com" value="${escapeHtml(data.socialLinks?.website || "")}">
                </label>
              </div>
            </div>
            <details class="advanced-settings">
              <summary>Advanced profile options</summary>
              <div class="advanced-settings-body">
                <label>
                  Profile photo URL
                  <input name="avatarUrl" value="${escapeHtml(data.avatarUrl || "")}">
                </label>
              </div>
            </details>
            <button class="button primary" type="submit">Save my profile</button>
          </form>
          `,
          })}
        </div>
        <div class="stack">
          ${renderExpertReadiness({ isOnline, payoutReady, hasConnectAccount, connectStatus, data })}
          ${collapsibleSection({
            section: "sessions",
            kicker: "Recent jobs",
            title: "Latest calls",
            status: `${paidSessions.length} total`,
            statusClass: paidSessions.length ? "paid" : "pending",
            body: renderSessionHistory(paidSessions),
          })}
        </div>
      </div>
      ${renderPublicPreviewModal(profile, data, isOnline, activeMeetUrl, payoutReady)}
    </section>
  `;
}

export function bindExpertDashboard(root, actions, state) {
  root.querySelectorAll("[data-avatar-image]").forEach((image) => {
    image.addEventListener("error", () => {
      image.remove();
      image.parentElement?.classList.remove("has-image");
    });
  });
  const previewModal = root.querySelector("[data-preview-modal]");
  const openPreviewModal = () => {
    if (!previewModal) {
      return;
    }
    previewModal.hidden = false;
    window.setTimeout(() => previewModal.querySelector('[data-action="close-preview"]')?.focus({ preventScroll: true }), 0);
  };
  const closePreviewModal = () => {
    if (previewModal) {
      previewModal.hidden = true;
    }
  };
  const openDashboardSection = (sectionName) => {
    const section = root.querySelector(`[data-section="${sectionName}"]`);
    if (section?.tagName?.toLowerCase() === "details") {
      section.open = true;
    }
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    return section;
  };

  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => actions.navigate(button.dataset.route));
  });

  root.querySelectorAll("[data-availability]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await actions.setExpertAvailability(state.auth.user, button.dataset.availability);
        await actions.refresh();
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll("[data-session-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await actions.updateSessionStatus(button.dataset.sessionId, button.dataset.sessionStatus);
        await actions.refresh();
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-action="connect-payouts"]').forEach((connectPayouts) => {
    connectPayouts.addEventListener("click", async () => {
      connectPayouts.disabled = true;
      actions.showSiteLoader("Opening Stripe payout setup...");
      try {
        const result = await actions.createConnectOnboarding();
        if (!result?.url) {
          throw new Error("Stripe did not return a payout setup link.");
        }
        window.location.assign(result.url);
      } catch (error) {
        actions.hideSiteLoader?.();
        showActionProblem(actions, error);
        connectPayouts.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-action="connect-dashboard"]').forEach((connectDashboard) => {
    connectDashboard.addEventListener("click", async () => {
      connectDashboard.disabled = true;
      actions.showSiteLoader("Opening Stripe payouts...");
      try {
        const result = await actions.createConnectDashboard();
        if (!result?.url) {
          throw new Error("Stripe did not return a payout dashboard link.");
        }
        window.location.assign(result.url);
      } catch (error) {
        actions.hideSiteLoader?.();
        showActionProblem(actions, error);
        connectDashboard.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-action="refresh-connect"]').forEach((refreshConnect) => {
    refreshConnect.addEventListener("click", async () => {
      refreshConnect.disabled = true;
      try {
        await actions.refreshConnectStatus();
        actions.showNotice("Stripe payout status updated.");
        await actions.refresh();
      } catch (error) {
        showActionProblem(actions, error);
      } finally {
        refreshConnect.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-action="focus-profile"]').forEach((button) => {
    button.addEventListener("click", () => {
      const section = openDashboardSection("profile");
      const form = section?.querySelector("[data-expert-form]") || root.querySelector("[data-expert-form]");
      window.setTimeout(() => form?.querySelector("input, select, textarea")?.focus({ preventScroll: true }), 240);
    });
  });

  root.querySelectorAll('[data-action="focus-preview"]').forEach((button) => {
    button.addEventListener("click", () => {
      openPreviewModal();
    });
  });

  root.querySelectorAll('[data-action="close-preview"]').forEach((button) => {
    button.addEventListener("click", closePreviewModal);
  });

  if (previewModal) {
    previewModal.addEventListener("click", (event) => {
      if (event.target === previewModal) {
        closePreviewModal();
      }
    });
    previewModal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePreviewModal();
      }
    });
  }

  root.querySelectorAll('[data-action="focus-payouts"]').forEach((button) => {
    button.addEventListener("click", () => {
      openDashboardSection("payouts");
    });
  });

  root.querySelectorAll('[data-action="focus-sessions"]').forEach((button) => {
    button.addEventListener("click", () => {
      openDashboardSection("sessions");
    });
  });

  const form = root.querySelector("[data-expert-form]");
  if (!form) {
    return;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const formData = new FormData(form);
      const file = formData.get("avatarFile");
      if (file && file.size) {
        const url = await actions.uploadProfileImage(state.auth.user.id, file);
        formData.set("avatarUrl", url);
      }
      const portfolioFiles = formData.getAll("portfolioFiles").filter((item) => item && item.size);
      if (portfolioFiles.length) {
        const uploadedUrls = [];
        for (const portfolioFile of portfolioFiles.slice(0, 8)) {
          uploadedUrls.push(await actions.uploadPortfolioImage(state.auth.user.id, portfolioFile));
        }
        const existingUrls = String(formData.get("portfolioImageUrls") || "")
          .split(/\r?\n|,/)
          .map((url) => url.trim())
          .filter(Boolean);
        formData.set("portfolioImageUrls", [...existingUrls, ...uploadedUrls].join("\n"));
      }
      formData.delete("avatarFile");
      formData.delete("portfolioFiles");
      await actions.saveExpertProfile(state.auth.user, Object.fromEntries(formData.entries()));
      actions.showNotice("Expert profile saved.");
      await actions.refresh();
    } catch (error) {
      actions.showError(error.message);
    } finally {
      submit.disabled = false;
    }
  });
}
