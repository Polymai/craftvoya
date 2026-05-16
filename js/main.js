import { completeProfile, initAuth, logout, register, signIn } from "./auth.js";
import { createReview, saveExpertProfile, setExpertAvailability, updateSessionStatus, uploadPortfolioImage, uploadProfileImage } from "./api/appData.js";
import { createBillingPortal, createCheckoutForExpert, createConnectDashboard, createConnectOnboarding, openPaymentReceipt, refreshConnectStatus } from "./api/payments.js";
import { joinWebrtcRoom, markWebrtcActive, markWebrtcFallback, markWebrtcJoined, startWebrtcRoom } from "./api/webrtcRooms.js";
import { installRouter, navigate, syncRoute } from "./router.js";
import { startRealtime } from "./realtime.js";
import { clearActionMessages, getState, setState, setUi, subscribe } from "./state.js";
import { bindAdminPanel, renderAdminPanel } from "./render/adminPanel.js";
import { bindAuthPage, renderAuthPage } from "./render/authPage.js";
import { bindCustomerDashboard, renderCustomerDashboard } from "./render/customerDashboard.js";
import { bindExpertDashboard, renderExpertDashboard } from "./render/expertDashboard.js";
import { bindExpertProfile, renderExpertProfile } from "./render/expertProfile.js";
import { bindLanding, renderLanding } from "./render/landing.js";
import { bindMarketplace, renderMarketplace } from "./render/marketplace.js";
import { bindPaymentSuccess, renderPaymentSuccess } from "./render/paymentSuccess.js";
import { bindSessionPage, renderSessionPage } from "./render/sessionPage.js";
import { bindShell, renderShell } from "./render/shell.js";

const root = document.getElementById("app");
let lastRealtimeUserId = "";

function renderRoute(state) {
  if (state.booting) {
    return `
      <section class="route-view section">
        <div class="empty-state">
          <p class="eyebrow">Craftvoya</p>
          <h2>Loading trade expert desk.</h2>
        </div>
      </section>
    `;
  }

  if (state.route.name === "auth") {
    return renderAuthPage(state);
  }
  if (state.route.name === "marketplace") {
    return renderMarketplace(state);
  }
  if (state.route.name === "expert") {
    return renderExpertProfile(state);
  }
  if (state.route.name === "session") {
    return renderSessionPage(state);
  }
  if (state.route.name === "success") {
    return renderPaymentSuccess(state);
  }
  if (state.route.name === "dashboard") {
    if (state.auth.profile?.data?.role === "customer") {
      return renderCustomerDashboard(state);
    }
    return renderExpertDashboard(state);
  }
  if (state.route.name === "admin") {
    return renderAdminPanel(state);
  }
  return renderLanding(state);
}

function showError(message) {
  hideSiteLoader();
  setUi({ actionError: message || "Action failed.", actionNotice: "" });
}

function showNotice(message) {
  hideSiteLoader();
  setUi({ actionNotice: message || "Done.", actionError: "" });
}

function showSiteLoader(message = "Preparing the secure Stripe page...") {
  const loader = document.querySelector("[data-site-loader]");
  const messageTarget = loader?.querySelector("[data-site-loader-message]");
  if (messageTarget) {
    messageTarget.textContent = message;
  }
  document.body.classList.add("site-loading");
}

function hideSiteLoader() {
  document.body.classList.remove("site-loading");
}

async function setExpertAvailabilityFlow(user, availability) {
  const state = getState();
  const profile = state.data.dashboard?.expertProfile;
  const profileData = profile?.data || {};

  if (availability === "online") {
    if (!profile?.id) {
      throw new Error("Save your profile first. Add your name, trade, and price.");
    }
    if (!profile.stripe_connect_onboarding_complete && !profileData.stripeConnectOnboardingComplete) {
      throw new Error("Finish Stripe payout setup before taking paid calls.");
    }
    await setExpertAvailability(user, "online", {
      meetingProvider: "webrtc",
      meetUrl: "",
      fallbackMeetUrl: "",
      meetReady: true,
      meetGeneratedBy: "webrtc",
      onlineMeetCreatedAt: new Date().toISOString(),
      onlineMeetEndsAt: "",
    });
    showNotice("You are taking calls. Craftvoya will open an in-app WebRTC room after each customer pays.");
    return;
  }

  await setExpertAvailability(user, "offline", {
    meetUrl: "",
    fallbackMeetUrl: "",
    meetingProvider: "webrtc",
    meetReady: false,
    meetGeneratedBy: "",
    onlineMeetCreatedAt: "",
    onlineMeetEndsAt: "",
  });
  showNotice("Calls are stopped. Customers will not see you as available.");
}

const actions = {
  navigate: (path) => {
    clearActionMessages();
    navigate(path);
  },
  refresh: syncRoute,
  showError,
  showNotice,
  showSiteLoader,
  hideSiteLoader,
  signIn,
  register,
  completeProfile,
  logout,
  createCheckoutForExpert,
  createBillingPortal,
  openPaymentReceipt,
  createConnectDashboard,
  createConnectOnboarding,
  refreshConnectStatus,
  saveExpertProfile,
  setExpertAvailability: setExpertAvailabilityFlow,
  updateSessionStatus,
  createReview,
  uploadPortfolioImage,
  uploadProfileImage,
  startWebrtcRoom,
  joinWebrtcRoom,
  markWebrtcJoined,
  markWebrtcActive,
  markWebrtcFallback,
};

window.addEventListener("pageshow", () => {
  hideSiteLoader();
});

function bindRoute(state) {
  if (state.route.name === "auth") {
    bindAuthPage(root, actions, state);
  } else if (state.route.name === "marketplace") {
    bindMarketplace(root, actions);
  } else if (state.route.name === "expert") {
    bindExpertProfile(root, actions, state);
  } else if (state.route.name === "session") {
    bindSessionPage(root, actions, state);
  } else if (state.route.name === "success") {
    bindPaymentSuccess(root, actions);
  } else if (state.route.name === "dashboard") {
    if (state.auth.profile?.data?.role === "customer") {
      bindCustomerDashboard(root, actions, state);
      return;
    }
    bindExpertDashboard(root, actions, state);
  } else if (state.route.name === "admin") {
    bindAdminPanel(root, actions, state);
  } else {
    bindLanding(root, actions);
  }
}

function renderApp() {
  const state = getState();
  root.innerHTML = renderShell(state, renderRoute(state));
  bindShell(root, actions);
  bindRoute(state);

  if (state.route.name === "landing" && state.route.query.section === "how") {
    window.requestAnimationFrame(() => {
      document.getElementById("how-we-help")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  const userId = state.auth.user?.id || "";
  if (userId !== lastRealtimeUserId) {
    lastRealtimeUserId = userId;
    startRealtime(userId, () => {
      syncRoute();
    });
  }
}

async function boot() {
  subscribe(renderApp);
  renderApp();
  try {
    await initAuth();
  } catch (error) {
    setUi({ actionError: error.message });
  }
  installRouter();
  await syncRoute();
  setState({ booting: false });
}

boot();
