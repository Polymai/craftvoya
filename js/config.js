const supabaseRuntime = window.__POLYMAI_SUPABASE_CONFIG__ || {};
const stripeRuntime = window.__POLYMAI_STRIPE_CONFIG__ || {};
const googleRuntime = window.__POLYMAI_GOOGLE_CONFIG__ || {};
const GOOGLE_CONFIG_SCRIPT_SRC = "data/googleConfig.js";
const GOOGLE_CONFIG_VERSION = "20260511-google-meet";

export const APP_CONFIG = Object.freeze({
  brandName: "Craftvoya",
  appId: "app674_quickfix",
  schema: "app674_quickfix",
  tables: {
    userProfiles: "user_profiles",
    expertProfiles: "expert_profiles",
    availability: "availability_statuses",
    sessions: "consultation_sessions",
    payments: "payments",
    reviews: "reviews",
    stripeAccounts: "stripe_accounts",
    webhookEvents: "webhook_events",
  },
  mediaBucket: "app674_quickfix_media",
  commissionRate: 0.18,
  defaultVatRate: 0.25,
  sessionMinutes: 20,
  onlineMeetBlockMinutes: 480,
  currency: "usd",
  checkoutFunction: "app674-quickfix-create-checkout-session",
  billingPortalFunction: "app674-quickfix-create-billing-portal",
  connectOnboardingFunction: "app674-quickfix-create-connect-onboarding",
  webrtcRoomFunction: "app674-quickfix-webrtc-room",
  webrtcConnectTimeoutMs: 18000,
  webrtcIceServers: [
    { urls: ["stun:stun.l.google.com:19302"] },
    {
      urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
});

export const SUPABASE_CONFIG = Object.freeze({
  url: supabaseRuntime.url || "",
  anonKey: supabaseRuntime.anonKey || "",
  functionsBaseUrl: supabaseRuntime.functionsBaseUrl || "",
  siteUrl: supabaseRuntime.siteUrl || "",
});

export const STRIPE_CONFIG = Object.freeze({
  mode: stripeRuntime.mode || "test",
  publishableKey: stripeRuntime.publishableKey || "",
  functionsBaseUrl: stripeRuntime.functionsBaseUrl || SUPABASE_CONFIG.functionsBaseUrl,
  defaultSuccessUrl: stripeRuntime.defaultSuccessUrl || "",
  defaultCancelUrl: stripeRuntime.defaultCancelUrl || "",
  defaultPriceIds: Array.isArray(stripeRuntime.defaultPriceIds) ? stripeRuntime.defaultPriceIds : [],
});

export const GOOGLE_CONFIG = Object.freeze({
  clientId: googleRuntime.clientId || "",
  calendarId: googleRuntime.calendarId || "primary",
  calendarScope: "https://www.googleapis.com/auth/calendar.events",
});

let googleRuntimeConfigPromise = null;

export function getGoogleConfig() {
  const runtime = window.__POLYMAI_GOOGLE_CONFIG__ || {};
  return {
    clientId: String(runtime.clientId || GOOGLE_CONFIG.clientId || "").trim(),
    calendarId: String(runtime.calendarId || GOOGLE_CONFIG.calendarId || "primary").trim(),
    calendarScope: GOOGLE_CONFIG.calendarScope,
  };
}

export async function ensureGoogleRuntimeConfig() {
  if (getGoogleConfig().clientId || typeof document === "undefined") {
    return getGoogleConfig();
  }

  if (googleRuntimeConfigPromise) {
    return googleRuntimeConfigPromise;
  }

  googleRuntimeConfigPromise = new Promise((resolve) => {
    let loadedFreshConfig = false;
    const finish = () => resolve(getGoogleConfig());
    const loadFreshConfig = () => {
      if (getGoogleConfig().clientId || loadedFreshConfig) {
        finish();
        return;
      }
      loadedFreshConfig = true;
      const script = document.createElement("script");
      script.src = `${GOOGLE_CONFIG_SCRIPT_SRC}?v=${GOOGLE_CONFIG_VERSION}`;
      script.async = false;
      script.onload = finish;
      script.onerror = finish;
      document.head.appendChild(script);
    };
    const existing = document.querySelector(`script[src^="${GOOGLE_CONFIG_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", loadFreshConfig, { once: true });
      existing.addEventListener("error", loadFreshConfig, { once: true });
      window.setTimeout(loadFreshConfig, 1000);
      return;
    }

    loadFreshConfig();
  });

  return googleRuntimeConfigPromise;
}

export const CATEGORIES = Object.freeze([
  { key: "carpentry", label: "Carpentry & framing", short: "Carpentry", minutes: 4 },
  { key: "tv_mounting", label: "TV mounting & wall prep", short: "TV mounting", minutes: 4 },
  { key: "painting", label: "Painting & finishing", short: "Painting", minutes: 5 },
  { key: "flooring", label: "Flooring", short: "Flooring", minutes: 6 },
  { key: "electrical", label: "Electrical planning", short: "Electrical", minutes: 5 },
  { key: "plumbing", label: "Plumbing triage", short: "Plumbing", minutes: 5 },
  { key: "smart_home", label: "Smart home & tech", short: "Smart home", minutes: 3 },
  { key: "handyman", label: "General handyman help", short: "Handyman", minutes: 4 },
]);

export const DEMO_EXPERTS = Object.freeze([
  {
    id: "demo-carpentry-mara",
    title: "Mara Finch",
    category: "carpentry",
    amount_cents: 2900,
    currency: "usd",
    status: "active",
    published: true,
    expert_user_id: "demo-carpentry-mara",
    data: {
      demo: true,
      headline: "Framing and built-in specialist",
      bio: "Guides partition walls, blocking, stud layout, fastener choices, and contractor-ready next steps before you cut or drill.",
      rating: 4.9,
      reviewCount: 182,
      responseMins: 2,
      years: 14,
      meetReady: true,
      availability: "online",
      initials: "MF",
    },
  },
  {
    id: "demo-tv-eli",
    title: "Eli Moreno",
    category: "tv_mounting",
    amount_cents: 2400,
    currency: "usd",
    status: "active",
    published: true,
    expert_user_id: "demo-tv-eli",
    data: {
      demo: true,
      headline: "TV mounting and media wall expert",
      bio: "Checks brackets, wall structure, cable paths, and safe mounting plans before the first hole goes in.",
      rating: 4.8,
      reviewCount: 236,
      responseMins: 1,
      years: 11,
      meetReady: true,
      availability: "online",
      initials: "EM",
    },
  },
  {
    id: "demo-paint-nora",
    title: "Nora Patel",
    category: "painting",
    amount_cents: 3900,
    currency: "usd",
    status: "active",
    published: true,
    expert_user_id: "demo-paint-nora",
    data: {
      demo: true,
      headline: "Interior painting and finishing pro",
      bio: "Helps choose primer, surface prep, edge strategy, drying times, and the right finish for the room.",
      rating: 4.9,
      reviewCount: 94,
      responseMins: 5,
      years: 9,
      meetReady: true,
      availability: "online",
      initials: "NP",
    },
  },
  {
    id: "demo-smart-jules",
    title: "Jules Carter",
    category: "smart_home",
    amount_cents: 3200,
    currency: "usd",
    status: "active",
    published: true,
    expert_user_id: "demo-smart-jules",
    data: {
      demo: true,
      headline: "Smart home and network installer",
      bio: "Walks through router placement, camera setup, smart switches, and device planning before installation gets messy.",
      rating: 4.7,
      reviewCount: 121,
      responseMins: 4,
      years: 13,
      meetReady: true,
      availability: "online",
      initials: "JC",
    },
  },
]);

export function categoryByKey(key) {
  return CATEGORIES.find((category) => category.key === key) || CATEGORIES[0];
}

function normalizeAppBaseUrl(value = "") {
  const cleaned = String(value || "").replace(/#.*$/, "");
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

function currentAppBaseUrl() {
  return normalizeAppBaseUrl(`${window.location.origin}${window.location.pathname}`);
}

function isLocalRuntime() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

export function appBaseUrl() {
  if (isLocalRuntime()) {
    return currentAppBaseUrl();
  }
  const configured = SUPABASE_CONFIG.siteUrl || "";
  if (configured) {
    return normalizeAppBaseUrl(configured);
  }
  return currentAppBaseUrl();
}

export function authRedirectUrl() {
  return appBaseUrl();
}

export function checkoutSuccessUrl() {
  if (!isLocalRuntime() && STRIPE_CONFIG.defaultSuccessUrl) {
    return STRIPE_CONFIG.defaultSuccessUrl;
  }
  return `${appBaseUrl()}#/success?checkout_session_id={CHECKOUT_SESSION_ID}`;
}

export function checkoutCancelUrl(expertId = "") {
  if (!isLocalRuntime() && STRIPE_CONFIG.defaultCancelUrl) {
    return STRIPE_CONFIG.defaultCancelUrl;
  }
  return `${appBaseUrl()}#/expert/${encodeURIComponent(expertId)}`;
}

export function billingReturnUrl() {
  return `${appBaseUrl()}#/dashboard`;
}

export function formatMoney(cents = 0, currency = APP_CONFIG.currency) {
  const amount = Number.isFinite(Number(cents)) ? Number(cents) / 100 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || APP_CONFIG.currency).toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function estimateNetOfInclusiveTax(cents = 0, taxRate = APP_CONFIG.defaultVatRate) {
  const gross = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  const rate = Number.isFinite(Number(taxRate)) && Number(taxRate) >= 0 ? Number(taxRate) : 0;
  return Math.max(0, Math.round(gross / (1 + rate)));
}

export function estimateExpertPayoutFromGross(cents = 0) {
  return Math.round(estimateNetOfInclusiveTax(cents) * (1 - APP_CONFIG.commissionRate));
}

window.__DATA__ = Object.freeze({
  app: APP_CONFIG,
  categories: CATEGORIES,
  demoExperts: DEMO_EXPERTS,
});
