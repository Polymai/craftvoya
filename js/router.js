import { CATEGORIES } from "./config.js";
import {
  getExpertProfile,
  getPaymentByStripeSession,
  getReviewForSession,
  getSessionRecord,
  listAdminRecords,
  listExpertProfiles,
  listMySessions,
  loadCustomerDashboard,
  listReviewsForExpert,
  loadExpertDashboard,
} from "./api/appData.js";
import { reconcileCheckoutSession } from "./api/payments.js";
import { currentRole, getState, isAdmin, setData, setRoute, setUi, signedInUserId } from "./state.js";

function parseQuery(queryString = "") {
  const params = new URLSearchParams(queryString);
  return Object.fromEntries(params.entries());
}

export function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryString = ""] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const segments = path.split("/").filter(Boolean);
  const query = parseQuery(queryString);

  if (segments.length === 0) {
    return { name: "landing", path: "/", params: {}, query };
  }
  if (segments[0] === "auth") {
    return { name: "auth", path, params: {}, query };
  }
  if (segments[0] === "marketplace") {
    return { name: "marketplace", path, params: {}, query };
  }
  if (segments[0] === "expert" && segments[1]) {
    return { name: "expert", path, params: { id: decodeURIComponent(segments[1]) }, query };
  }
  if (segments[0] === "session" && segments[1]) {
    return { name: "session", path, params: { id: decodeURIComponent(segments[1]) }, query };
  }
  if (segments[0] === "success") {
    return { name: "success", path, params: {}, query };
  }
  if (segments[0] === "dashboard") {
    return { name: "dashboard", path, params: {}, query };
  }
  if (segments[0] === "admin") {
    return { name: "admin", path, params: {}, query };
  }
  return { name: "landing", path: "/", params: {}, query };
}

export function navigate(path) {
  window.location.hash = path;
}

function guardedRedirect(route) {
  const state = getState();
  const customerOnly = ["marketplace", "expert", "success"];
  const expertOnly = ["admin"];
  const signedInOnly = [...customerOnly, ...expertOnly, "dashboard", "session"];

  if (!state.auth.user && signedInOnly.includes(route.name)) {
    return {
      path: "/",
      message: "Choose Customer or Expert before entering Craftvoya.",
    };
  }

  if (state.auth.user && !state.auth.profile && route.name !== "auth" && route.name !== "landing") {
    return {
      path: "/",
      message: "Choose Customer or Expert to finish this Craftvoya account.",
    };
  }

  if (!state.auth.user || !state.auth.profile) {
    return null;
  }

  if (route.name === "landing") {
    const role = currentRole();
    return {
      path: role === "expert" || role === "admin" ? "/dashboard" : "/marketplace",
      message: "",
    };
  }

  const role = currentRole();
  const isExpertAccount = role === "expert" || role === "admin";
  if (isExpertAccount && customerOnly.includes(route.name)) {
    return {
      path: "/dashboard",
      message: "Expert accounts cannot use customer marketplace or checkout pages.",
    };
  }
  if (!isExpertAccount && expertOnly.includes(route.name)) {
    return {
      path: "/marketplace",
      message: "Customer accounts cannot access expert settings. Log out to use an expert account.",
    };
  }
  return null;
}

async function loadMarketplace(route) {
  const category = route.query.category || getState().data.selectedCategory || CATEGORIES[0].key;
  const result = await listExpertProfiles(category);
  setData({
    selectedCategory: category,
    experts: result.experts,
    expertsDemo: result.demo,
  });
  if (result.notice) {
    setUi({ actionNotice: result.notice });
  }
}

function findLoadedExpert(identifier) {
  const lookupId = String(identifier || "");
  return (getState().data.experts || []).find((expert) =>
    [
      expert.route_id,
      expert.data?.routeId,
      expert.slug,
      expert.id,
      expert.expert_user_id,
      expert.user_id,
      expert.owner_user_id,
    ]
      .filter(Boolean)
      .includes(lookupId),
  ) || null;
}

async function loadExpert(route) {
  const expert = await getExpertProfile(route.params.id) || findLoadedExpert(route.params.id);
  const reviews = await listReviewsForExpert(expert);
  setData({
    selectedExpert: expert,
    selectedReviews: reviews,
  });
}

async function loadSession(route) {
  const session = await getSessionRecord(route.params.id);
  const userId = signedInUserId();
  if (session && userId === session.customer_user_id) {
    const review = await getReviewForSession(session.id, userId);
    session.data = {
      ...session.data,
      customerReview: review,
    };
  }
  setData({ activeSession: session });
}

async function loadSuccess(route) {
  const checkoutSessionId = route.query.checkout_session_id || route.query.session_id || "";
  if (!checkoutSessionId) {
    setData({ paymentConfirmation: { status: "missing" }, activeSession: null });
    return;
  }
  const confirmation = await reconcileCheckoutSession(checkoutSessionId);
  let session = null;
  if (confirmation.sessionRecordId) {
    session = await getSessionRecord(confirmation.sessionRecordId);
  }
  if (!session) {
    const payment = await getPaymentByStripeSession(checkoutSessionId);
    if (payment?.session_id) {
      session = await getSessionRecord(payment.session_id);
    }
  }
  setData({ paymentConfirmation: confirmation, activeSession: session });
}

async function loadDashboard() {
  const userId = signedInUserId();
  if (!userId) {
    setData({ dashboard: null, sessions: [], payments: [] });
    return;
  }
  if (currentRole() === "customer") {
    const dashboard = await loadCustomerDashboard(userId);
    setData({ dashboard, sessions: dashboard.sessions, payments: dashboard.payments });
    return;
  }
  const dashboard = await loadExpertDashboard(userId);
  const sessions = await listMySessions(userId);
  setData({ dashboard, sessions, payments: [] });
}

async function loadAdmin() {
  if (!isAdmin()) {
    setData({ adminRecords: [] });
    return;
  }
  const records = await listAdminRecords();
  setData({ adminRecords: records });
}

export async function syncRoute() {
  const route = parseHash();
  setRoute(route);
  setUi({ routeLoading: true, routeError: "", actionError: "" });

  try {
    const redirect = guardedRedirect(route);
    if (redirect) {
      setUi({ routeLoading: false, actionNotice: redirect.message });
      navigate(redirect.path);
      return;
    }
    if (route.name === "landing") {
      const result = await listExpertProfiles(CATEGORIES[0].key);
      setData({ experts: result.experts.slice(0, 3), expertsDemo: result.demo, selectedCategory: CATEGORIES[0].key });
    }
    if (route.name === "marketplace") {
      await loadMarketplace(route);
    }
    if (route.name === "expert") {
      await loadExpert(route);
    }
    if (route.name === "session") {
      await loadSession(route);
    }
    if (route.name === "success") {
      await loadSuccess(route);
    }
    if (route.name === "dashboard") {
      await loadDashboard();
    }
    if (route.name === "admin") {
      await loadAdmin();
    }
  } catch (error) {
    setUi({ routeError: error.message || "This view could not load." });
  } finally {
    setUi({ routeLoading: false });
  }
}

export function installRouter() {
  window.addEventListener("hashchange", () => {
    syncRoute();
  });
}
