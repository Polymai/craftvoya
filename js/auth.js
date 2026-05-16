import { authRedirectUrl } from "./config.js";
import { supabase } from "./supabaseClient.js";
import { getUserProfile, saveExpertProfile, upsertUserProfile } from "./api/appData.js";
import { getState, setAuth, setUi } from "./state.js";

const pendingSignupKey = "craftvoya.pendingAppSignup";

function ensureAuthClient() {
  if (!supabase) {
    throw new Error("Supabase auth is not configured.");
  }
}

function savePendingSignup(input) {
  const payload = {
    displayName: input.displayName || "",
    role: input.role || "customer",
    email: input.email || "",
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
  window.localStorage.setItem(pendingSignupKey, JSON.stringify(payload));
}

function readPendingSignup() {
  try {
    const raw = window.localStorage.getItem(pendingSignupKey);
    if (!raw) {
      return null;
    }
    const payload = JSON.parse(raw);
    if (!payload.expiresAt || payload.expiresAt < Date.now()) {
      window.localStorage.removeItem(pendingSignupKey);
      return null;
    }
    return payload;
  } catch {
    window.localStorage.removeItem(pendingSignupKey);
    return null;
  }
}

function clearPendingSignup() {
  window.localStorage.removeItem(pendingSignupKey);
}

function signupPayload(input, includeRedirect = true) {
  const options = {
    data: {
      display_name: input.displayName || "",
      craftvoya_role: input.role || "customer",
    },
  };
  if (includeRedirect) {
    options.emailRedirectTo = authRedirectUrl();
  }
  return {
    email: String(input.email || "").trim(),
    password: String(input.password || ""),
    options,
  };
}

function isRedirectRejected(error) {
  return error?.status === 422 && /redirect|redirect_to|not allowed|uri/i.test(error.message || "");
}

async function signUpWithRedirectFallback(input) {
  const first = await supabase.auth.signUp(signupPayload(input, true));
  if (!first.error || !isRedirectRejected(first.error)) {
    return first;
  }
  return supabase.auth.signUp(signupPayload(input, false));
}

async function applySession(session) {
  setAuth({
    loading: false,
    session,
    user: session?.user || null,
    error: "",
  });

  if (!session?.user) {
    setAuth({ profile: null });
    return;
  }

  await hydrateProfile();
}

export async function hydrateProfile() {
  ensureAuthClient();
  const user = getState().auth.user;
  if (!user) {
    setAuth({ profile: null });
    return null;
  }

  const existing = await getUserProfile(user.id);
  if (existing) {
    setAuth({ profile: existing });
    return existing;
  }

  const pending = readPendingSignup();
  if (pending) {
    const profile = await completeProfile(pending);
    clearPendingSignup();
    return profile;
  }

  setAuth({ profile: null });
  return null;
}

export async function initAuth() {
  ensureAuthClient();
  setAuth({ loading: true, error: "", notice: "" });
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setAuth({ loading: false, error: error.message });
    return;
  }
  await applySession(data.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session).catch((error) => {
      setAuth({ error: error.message, loading: false });
    });
  });
}

export async function signIn(input) {
  ensureAuthClient();
  setUi({ actionError: "", actionNotice: "" });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(input.email || "").trim(),
    password: String(input.password || ""),
  });
  if (error) {
    throw new Error(error.message);
  }
  await applySession(data.session);
  return data.session;
}

export async function register(input) {
  ensureAuthClient();
  setUi({ actionError: "", actionNotice: "" });
  savePendingSignup(input);
  const { data, error } = await signUpWithRedirectFallback(input);

  if (error) {
    clearPendingSignup();
    throw new Error(error.message);
  }

  if (data.session) {
    await applySession(data.session);
    if (!getState().auth.profile) {
      await completeProfile(input);
    }
    clearPendingSignup();
  } else {
    setAuth({ notice: "Check your email to finish sign-in, then Craftvoya will complete your app profile." });
  }
  return data;
}

export async function completeProfile(input) {
  ensureAuthClient();
  const user = getState().auth.user;
  if (!user) {
    throw new Error("Sign in before completing your Craftvoya profile.");
  }
  const requestedRole = input.role === "expert" ? "expert" : "customer";
  const existing = await getUserProfile(user.id);
  const existingRole = existing?.data?.role || "";
  if (existingRole && existingRole !== requestedRole) {
    throw new Error(`This Craftvoya account is already a ${existingRole} account. Log out to use a different account type.`);
  }
  const profile = await upsertUserProfile(user, input);
  if (requestedRole === "expert") {
    await saveExpertProfile(user, {
      title: input.displayName || profile.title,
      category: input.category || "carpentry",
      rate: input.rate || 29,
      headline: "On-call Craftvoya trade expert",
      bio: "Focused live help for practical home projects.",
      meetUrl: "",
    });
  }
  setAuth({ profile, notice: "" });
  return profile;
}

export async function logout() {
  ensureAuthClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
  setAuth({ session: null, user: null, profile: null, notice: "" });
}
