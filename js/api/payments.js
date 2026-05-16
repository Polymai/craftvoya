import { APP_CONFIG, STRIPE_CONFIG, billingReturnUrl, checkoutCancelUrl, checkoutSuccessUrl } from "../config.js";
import { currentAccessToken } from "../supabaseClient.js";

function functionErrorFromResponse(functionName, json, status) {
  let message = json.error || json.message || `Function returned HTTP ${status}.`;
  let code = json.code || "";
  if (functionName === APP_CONFIG.connectOnboardingFunction) {
    if (message.includes("signed up for Connect") || message.includes("registered your platform")) {
      code = "stripe_connect_platform_not_enabled";
      message = "Expert payouts are not available yet. The Craftvoya owner needs to finish Stripe Dashboard > Connect platform setup before experts can onboard payouts.";
    }
    if (message.includes("Connect branding")) {
      code = "stripe_connect_branding_required";
      message = "Stripe Connect needs platform branding before onboarding links can be created. Finish Connect branding in Stripe Dashboard, then try expert payouts again.";
    }
  }
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.setupRequired = Boolean(json.setup_required || code === "stripe_connect_platform_not_enabled" || code === "stripe_connect_branding_required");
  return error;
}

async function callFunction(functionName, payload) {
  const token = await currentAccessToken();
  if (!token) {
    throw new Error("Sign in before opening billing or checkout.");
  }
  const base = STRIPE_CONFIG.functionsBaseUrl || "";
  if (!base) {
    throw new Error("Supabase Functions base URL is missing.");
  }

  const response = await fetch(`${base}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text || `Function returned HTTP ${response.status}.` };
  }
  if (!response.ok) {
    throw functionErrorFromResponse(functionName, json, response.status);
  }
  if (json.setup_required) {
    throw functionErrorFromResponse(functionName, json, response.status);
  }
  return json;
}

export async function createCheckoutForExpert(expertProfileId) {
  return callFunction(APP_CONFIG.checkoutFunction, {
    action: "create",
    expertProfileId,
    successUrl: checkoutSuccessUrl(),
    cancelUrl: checkoutCancelUrl(expertProfileId),
  });
}

export async function reconcileCheckoutSession(checkoutSessionId) {
  return callFunction(APP_CONFIG.checkoutFunction, {
    action: "reconcile",
    checkoutSessionId,
  });
}

export async function openPaymentReceipt(paymentId) {
  return callFunction(APP_CONFIG.checkoutFunction, {
    action: "receipt",
    paymentId,
  });
}

export async function createBillingPortal() {
  return callFunction(APP_CONFIG.billingPortalFunction, {
    returnUrl: billingReturnUrl(),
  });
}

export async function createConnectOnboarding() {
  return callFunction(APP_CONFIG.connectOnboardingFunction, {
    action: "onboarding",
    returnUrl: billingReturnUrl(),
    refreshUrl: billingReturnUrl(),
  });
}

export async function createConnectDashboard() {
  return callFunction(APP_CONFIG.connectOnboardingFunction, {
    action: "dashboard",
    returnUrl: billingReturnUrl(),
    refreshUrl: billingReturnUrl(),
  });
}

export async function refreshConnectStatus() {
  return callFunction(APP_CONFIG.connectOnboardingFunction, {
    action: "status",
    returnUrl: billingReturnUrl(),
    refreshUrl: billingReturnUrl(),
  });
}
