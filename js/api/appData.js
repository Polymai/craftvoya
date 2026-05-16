import { APP_CONFIG, DEMO_EXPERTS, estimateExpertPayoutFromGross } from "../config.js";
import { supabase, uploadExpertImage as uploadImageToStorage } from "../supabaseClient.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nowIso() {
  return new Date().toISOString();
}

function ensureClient() {
  if (!supabase) {
    throw new Error("Supabase runtime config is missing.");
  }
}

function table(name) {
  ensureClient();
  return supabase.from(name);
}

function tables() {
  return APP_CONFIG.tables;
}

function dataOf(row) {
  return row?.data && typeof row.data === "object" ? row.data : {};
}

function demoExperts(category = "carpentry") {
  const filtered = DEMO_EXPERTS.filter((expert) => !category || expert.category === category);
  return filtered.length ? filtered.map((expert) => normalizeExpertProfile(expert)) : DEMO_EXPERTS.map((expert) => normalizeExpertProfile(expert));
}

function dollarsToCents(value, fallback = 2900) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback;
  }
  return Math.round(amount * 100);
}

function normalizePublicUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function parseUrlList(value, fallback = []) {
  const source = Array.isArray(value) ? value : String(value || "").split(/\r?\n|,/);
  const urls = source.map(normalizePublicUrl).filter(Boolean);
  return urls.length ? [...new Set(urls)].slice(0, 8) : fallback.filter(Boolean).slice(0, 8);
}

function fieldOrCurrent(input, key, currentValue = "") {
  return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : currentValue;
}

function isDuplicateKeyError(error) {
  return error?.code === "23505" || /duplicate key|unique constraint/i.test(error?.message || "");
}

function schemaRepairError() {
  return new Error("Craftvoya's live database needs the new multi-table Supabase schema. Return to Polymai and run provisioning.");
}

function normalizeUserProfile(row) {
  if (!row) return null;
  const data = dataOf(row);
  return {
    ...row,
    entity_type: "user_profile",
    owner_user_id: row.user_id,
    title: row.display_name || data.displayName || row.email || "Craftvoya user",
    published: false,
    data: {
      ...data,
      email: row.email || data.email || "",
      displayName: row.display_name || data.displayName || "",
      role: row.role || data.role || "customer",
      accountType: row.role || data.accountType || "customer",
      stripeCustomerId: row.stripe_customer_id || data.stripeCustomerId || "",
    },
  };
}

function normalizeExpertProfile(row, availability = null) {
  if (!row) return null;
  const data = dataOf(row);
  const expertUserId = row.user_id || row.expert_user_id || row.owner_user_id || row.id || "";
  const routeId = row.slug || row.id || expertUserId;
  const availabilityData = dataOf(availability);
  const availabilityStatus = availability?.status || data.availability || "offline";
  const meetUrl = availability?.meet_url || data.meetUrl || data.manualMeetUrl || "";
  const meetingProvider = availabilityData.meetingProvider || data.meetingProvider || (meetUrl ? "google_meet" : "webrtc");
  const googleCalendarEventId = availability?.google_calendar_event_id || data.googleCalendarEventId || "";
  const googleMeetSpaceName = availability?.google_meet_space_name || data.googleMeetSpaceName || "";
  const onlineMeetEndsAt = availability?.online_meet_ends_at || data.onlineMeetEndsAt || "";
  const socialLinks = data.socialLinks && typeof data.socialLinks === "object" ? data.socialLinks : {};
  return {
    ...row,
    entity_type: "expert_profile",
    owner_user_id: expertUserId,
    expert_user_id: expertUserId,
    route_id: routeId,
    title: row.title || data.displayName || "Craftvoya expert",
    amount_cents: Number(row.amount_cents || 0),
    currency: row.currency || APP_CONFIG.currency,
    data: {
      ...data,
      ...availabilityData,
      headline: row.headline || data.headline || "On-call Craftvoya trade expert",
      bio: row.bio || data.bio || "",
      avatarUrl: row.avatar_url || data.avatarUrl || "",
      portfolioImages: Array.isArray(data.portfolioImages) ? data.portfolioImages.filter(Boolean).slice(0, 8) : [],
      socialLinks: {
        linkedin: socialLinks.linkedin || "",
        instagram: socialLinks.instagram || "",
        website: socialLinks.website || "",
      },
      availability: availabilityStatus,
      meetingProvider,
      meetUrl,
      fallbackMeetUrl: availabilityData.fallbackMeetUrl || data.fallbackMeetUrl || meetUrl || "",
      meetReady: Boolean(meetUrl || meetingProvider === "webrtc"),
      routeId,
      meetGeneratedBy: data.meetGeneratedBy || (meetUrl ? "google_calendar" : ""),
      googleCalendarEventId,
      googleMeetSpaceName,
      googleMeetCode: data.googleMeetCode || availabilityData.googleMeetCode || "",
      googleMeetHtmlLink: data.googleMeetHtmlLink || availabilityData.googleMeetHtmlLink || "",
      onlineMeetCreatedAt: data.onlineMeetCreatedAt || availabilityData.onlineMeetCreatedAt || "",
      onlineMeetEndsAt,
      stripeConnectAccountId: row.stripe_connect_account_id || data.stripeConnectAccountId || "",
      stripeConnectOnboardingComplete: Boolean(row.stripe_connect_onboarding_complete || data.stripeConnectOnboardingComplete),
    },
  };
}

function normalizeAvailability(row) {
  if (!row) return null;
  return {
    ...row,
    entity_type: "availability",
    owner_user_id: row.expert_user_id,
    expert_user_id: row.expert_user_id,
    title: "Expert availability",
    data: {
      ...dataOf(row),
      availability: row.status || "offline",
      meetUrl: row.meet_url || "",
      googleCalendarEventId: row.google_calendar_event_id || "",
      googleMeetSpaceName: row.google_meet_space_name || "",
      onlineMeetEndsAt: row.online_meet_ends_at || "",
    },
  };
}

function normalizeSession(row) {
  if (!row) return null;
  return {
    ...row,
    entity_type: "session",
    owner_user_id: row.customer_user_id,
    session_id: row.id,
    data: dataOf(row),
  };
}

function normalizePayment(row) {
  if (!row) return null;
  return {
    ...row,
    entity_type: "payment",
    owner_user_id: row.customer_user_id,
    title: dataOf(row).title || "Craftvoya payment",
    data: {
      ...dataOf(row),
      platformFeeCents: Number(row.platform_fee_cents || 0),
      expertPayoutCents: Number(row.expert_payout_cents || 0),
      stripeTransferId: row.stripe_transfer_id || "",
    },
  };
}

function normalizeReview(row) {
  if (!row) return null;
  return {
    ...row,
    entity_type: "review",
    owner_user_id: row.customer_user_id,
    amount_cents: 0,
    currency: APP_CONFIG.currency,
    data: {
      ...dataOf(row),
      rating: Number(row.rating || 5),
      body: row.body || dataOf(row).body || "",
    },
  };
}

async function availabilityForExperts(expertUserIds = []) {
  const ids = [...new Set(expertUserIds.filter(Boolean))];
  if (!ids.length) {
    return new Map();
  }
  const { data, error } = await table(tables().availability).select("*").in("expert_user_id", ids);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data || []).map((row) => [row.expert_user_id, row]));
}

export async function listExpertProfiles(category) {
  try {
    let query = table(tables().expertProfiles)
      .select("*")
      .eq("published", true)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return { experts: demoExperts(category), demo: true, notice: "Sample trade experts are shown until Craftvoya has live expert records." };
    }

    const availability = await availabilityForExperts(data.map((expert) => expert.user_id));
    const onlineExperts = data
      .map((expert) => normalizeExpertProfile(expert, availability.get(expert.user_id)))
      .filter((expert) => expert.data.availability === "online" && expert.data.meetReady && expert.data.stripeConnectOnboardingComplete);

    return { experts: onlineExperts, demo: false, notice: "" };
  } catch (error) {
    return { experts: demoExperts(category), demo: true, notice: error.message || "Live experts are not reachable yet." };
  }
}

export async function getExpertProfile(identifier) {
  const lookupId = String(identifier || "").trim();
  if (!lookupId) return null;

  const demo = DEMO_EXPERTS.find((expert) => [expert.id, expert.slug, expert.expert_user_id].filter(Boolean).includes(lookupId));
  if (demo) {
    return normalizeExpertProfile(demo);
  }

  const query = uuidPattern.test(lookupId)
    ? table(tables().expertProfiles).select("*").or(`id.eq.${lookupId},user_id.eq.${lookupId}`)
    : table(tables().expertProfiles).select("*").eq("slug", lookupId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const availability = await availabilityForExperts([data.user_id]);
  return normalizeExpertProfile(data, availability.get(data.user_id));
}

export async function listReviewsForExpert(expert) {
  if (!expert) return [];
  if (expert.data?.demo) {
    return [
      normalizeReview({
        id: `review-${expert.id}-1`,
        title: "Fast and practical",
        status: "published",
        rating: 5,
        body: "Clear next steps in one call. The issue was fixed before the session ended.",
        published: true,
        data: {},
        created_at: nowIso(),
      }),
      normalizeReview({
        id: `review-${expert.id}-2`,
        title: "Worth it",
        status: "published",
        rating: 5,
        body: "No filler. Just a focused diagnosis and a short action list.",
        published: true,
        data: {},
        created_at: nowIso(),
      }),
    ];
  }

  const { data, error } = await table(tables().reviews)
    .select("*")
    .eq("expert_user_id", expert.expert_user_id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message);
  return (data || []).map(normalizeReview);
}

export async function getReviewForSession(sessionId, customerUserId) {
  if (!sessionId || !customerUserId) return null;
  const { data, error } = await table(tables().reviews)
    .select("*")
    .eq("session_id", sessionId)
    .eq("customer_user_id", customerUserId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return normalizeReview((data || [])[0]);
}

export async function getUserProfile(userId) {
  if (!userId) return null;
  const { data, error } = await table(tables().userProfiles).select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeUserProfile(data);
}

export async function upsertUserProfile(user, input) {
  if (!user?.id) {
    throw new Error("A signed-in user is required.");
  }
  const existing = await getUserProfile(user.id);
  const displayName = String(input.displayName || existing?.data?.displayName || user.email || "Craftvoya user").trim();
  const requestedRole = input.role === "expert" || input.role === "admin" ? input.role : "customer";
  const role = existing?.data?.role || requestedRole;
  const payload = {
    user_id: user.id,
    display_name: displayName,
    email: String(user.email || input.email || existing?.data?.email || "").trim(),
    role,
    status: "active",
    stripe_customer_id: existing?.stripe_customer_id || existing?.data?.stripeCustomerId || null,
    data: {
      ...(existing?.data || {}),
      email: user.email || input.email || "",
      displayName,
      role,
      accountType: role,
      appId: APP_CONFIG.appId,
    },
    updated_at: nowIso(),
  };

  if (existing) {
    const { data, error } = await table(tables().userProfiles).update(payload).eq("id", existing.id).select("*").single();
    if (error) throw new Error(error.message);
    return normalizeUserProfile(data);
  }

  const { data, error } = await table(tables().userProfiles).insert({ ...payload, created_at: nowIso() }).select("*").single();
  if (error) {
    if (isDuplicateKeyError(error)) {
      const current = await getUserProfile(user.id);
      if (current) return current;
      throw schemaRepairError();
    }
    throw new Error(error.message);
  }
  return normalizeUserProfile(data);
}

export async function getMyExpertProfile(userId) {
  if (!userId) return null;
  const { data, error } = await table(tables().expertProfiles).select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const availability = await availabilityForExperts([userId]);
  return normalizeExpertProfile(data, availability.get(userId));
}

export async function saveExpertProfile(user, input) {
  if (!user?.id) {
    throw new Error("A signed-in expert is required.");
  }
  const existing = await getMyExpertProfile(user.id);
  const title = String(input.title || input.displayName || existing?.title || "Craftvoya expert").trim();
  const category = String(input.category || existing?.category || "carpentry");
  const rate = dollarsToCents(input.rate, existing?.amount_cents || 2900);
  const currentData = existing?.data || {};
  const manualMeetUrl = String(
    input.meetUrl ||
      currentData.manualMeetUrl ||
      (currentData.meetGeneratedBy === "manual" ? currentData.meetUrl : "") ||
      "",
  ).trim();
  const generatedMeetUrl = ["google_calendar", "google_meet_api"].includes(currentData.meetGeneratedBy) ? String(currentData.meetUrl || "").trim() : "";
  const activeMeetUrl = generatedMeetUrl || manualMeetUrl;
  const headline = String(input.headline || currentData.headline || "On-call Craftvoya trade expert").trim();
  const bio = String(input.bio || currentData.bio || "Focused support for practical home projects before you cut, drill, paint, or install.").trim();
  const avatarUrl = normalizePublicUrl(fieldOrCurrent(input, "avatarUrl", currentData.avatarUrl || ""));
  const existingSocialLinks = currentData.socialLinks && typeof currentData.socialLinks === "object" ? currentData.socialLinks : {};
  const portfolioImages = Object.prototype.hasOwnProperty.call(input, "portfolioImageUrls")
    ? parseUrlList(input.portfolioImageUrls, [])
    : (Array.isArray(currentData.portfolioImages) ? currentData.portfolioImages.filter(Boolean).slice(0, 8) : []);
  const socialLinks = {
    linkedin: normalizePublicUrl(fieldOrCurrent(input, "linkedinUrl", existingSocialLinks.linkedin || "")),
    instagram: normalizePublicUrl(fieldOrCurrent(input, "instagramUrl", existingSocialLinks.instagram || "")),
    website: normalizePublicUrl(fieldOrCurrent(input, "websiteUrl", existingSocialLinks.website || "")),
  };
  const dataPayload = {
    ...currentData,
    headline,
    bio,
    manualMeetUrl,
    meetUrl: activeMeetUrl,
    avatarUrl,
    portfolioImages,
    socialLinks,
    years: Number.isFinite(Number(input.years)) ? Number(input.years) : Number(currentData.years || 1),
    responseMins: Number.isFinite(Number(input.responseMins)) ? Number(input.responseMins) : Number(currentData.responseMins || 5),
    rating: Number(currentData.rating || 5),
    reviewCount: Number(currentData.reviewCount || 0),
    meetingProvider: currentData.meetingProvider || "webrtc",
    meetReady: Boolean(activeMeetUrl || (currentData.meetingProvider || "webrtc") === "webrtc"),
    meetGeneratedBy: generatedMeetUrl ? currentData.meetGeneratedBy : (manualMeetUrl ? "manual" : ""),
    availability: currentData.availability || "offline",
    initials: title.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
  };

  const payload = {
    user_id: user.id,
    title,
    slug: existing?.slug || `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${user.id.slice(0, 6)}`,
    category,
    headline,
    bio,
    avatar_url: avatarUrl || null,
    amount_cents: rate,
    currency: APP_CONFIG.currency,
    status: "active",
    published: true,
    stripe_connect_account_id: currentData.stripeConnectAccountId || null,
    stripe_connect_onboarding_complete: Boolean(currentData.stripeConnectOnboardingComplete),
    data: dataPayload,
    updated_at: nowIso(),
  };

  if (existing) {
    const { data, error } = await table(tables().expertProfiles).update(payload).eq("id", existing.id).select("*").single();
    if (error) throw new Error(error.message);
    return normalizeExpertProfile(data);
  }

  const { data, error } = await table(tables().expertProfiles).insert({ ...payload, created_at: nowIso() }).select("*").single();
  if (error) {
    if (isDuplicateKeyError(error)) {
      const current = await getMyExpertProfile(user.id);
      if (current) return current;
      throw schemaRepairError();
    }
    throw new Error(error.message);
  }
  return normalizeExpertProfile(data);
}

export async function setExpertAvailability(user, availability, meetPatch = {}) {
  if (!user?.id) {
    throw new Error("A signed-in expert is required.");
  }
  const status = availability === "online" ? "online" : "offline";
  const existingProfile = await getMyExpertProfile(user.id);
  if (!existingProfile?.id) {
    throw new Error("Save your expert profile before taking calls.");
  }
  const nextProfileData = {
    ...(existingProfile?.data || {}),
    availability: status,
    ...meetPatch,
  };
  if (nextProfileData.meetUrl) {
    nextProfileData.meetReady = true;
  } else if (nextProfileData.meetingProvider === "webrtc") {
    nextProfileData.meetReady = status === "online";
  } else if (Object.prototype.hasOwnProperty.call(meetPatch, "meetUrl")) {
    nextProfileData.meetReady = Boolean(nextProfileData.manualMeetUrl);
    nextProfileData.meetUrl = nextProfileData.manualMeetUrl || "";
    nextProfileData.meetGeneratedBy = nextProfileData.manualMeetUrl ? "manual" : "";
  }

  const { error: profileError } = await table(tables().expertProfiles)
    .update({ data: nextProfileData, updated_at: nowIso() })
    .eq("id", existingProfile.id);
  if (profileError) throw new Error(profileError.message);

  const { data: existingAvailability, error: lookupError } = await table(tables().availability)
    .select("*")
    .eq("expert_user_id", user.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const payload = {
    expert_profile_id: existingProfile.id,
    expert_user_id: user.id,
    status,
    published: status === "online",
    meet_url: nextProfileData.meetUrl || null,
    google_calendar_event_id: nextProfileData.googleCalendarEventId || null,
    google_meet_space_name: nextProfileData.googleMeetSpaceName || null,
    online_meet_ends_at: nextProfileData.onlineMeetEndsAt || null,
    data: {
      availability: status,
      changedAt: nowIso(),
      meetingProvider: nextProfileData.meetingProvider || "webrtc",
      meetUrl: nextProfileData.meetUrl || "",
      fallbackMeetUrl: nextProfileData.fallbackMeetUrl || "",
      googleCalendarEventId: nextProfileData.googleCalendarEventId || "",
      googleMeetSpaceName: nextProfileData.googleMeetSpaceName || "",
      googleMeetCode: nextProfileData.googleMeetCode || "",
      googleMeetHtmlLink: nextProfileData.googleMeetHtmlLink || "",
      onlineMeetCreatedAt: nextProfileData.onlineMeetCreatedAt || "",
      onlineMeetEndsAt: nextProfileData.onlineMeetEndsAt || "",
    },
    updated_at: nowIso(),
  };

  if (existingAvailability) {
    const { data, error } = await table(tables().availability).update(payload).eq("id", existingAvailability.id).select("*").single();
    if (error) throw new Error(error.message);
    return normalizeAvailability(data);
  }

  const { data, error } = await table(tables().availability).insert({ ...payload, created_at: nowIso() }).select("*").single();
  if (error) {
    if (isDuplicateKeyError(error)) {
      const { data: current } = await table(tables().availability).select("*").eq("expert_user_id", user.id).maybeSingle();
      if (current) return normalizeAvailability(current);
      throw schemaRepairError();
    }
    throw new Error(error.message);
  }
  return normalizeAvailability(data);
}

export async function listMySessions(userId) {
  if (!userId) return [];
  const { data, error } = await table(tables().sessions)
    .select("*")
    .or(`customer_user_id.eq.${userId},expert_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(normalizeSession);
}

export async function getSessionRecord(sessionId) {
  if (!sessionId || !uuidPattern.test(sessionId)) return null;
  const { data, error } = await table(tables().sessions).select("*").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeSession(data);
}

export async function updateSessionStatus(sessionId, status, extraData = {}) {
  const existing = await getSessionRecord(sessionId);
  if (!existing) {
    throw new Error("Session was not found.");
  }
  const { data, error } = await table(tables().sessions)
    .update({
      status,
      data: { ...existing.data, ...extraData, lastStatusChange: nowIso() },
      updated_at: nowIso(),
    })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalizeSession(data);
}

export async function createReview(user, session, input) {
  if (!user?.id || !session?.id) {
    throw new Error("A completed signed-in session is required.");
  }
  if (user.id !== session.customer_user_id) {
    throw new Error("Only the customer from this call can write a review.");
  }
  if (!["complete", "completed"].includes(String(session.status || ""))) {
    throw new Error("The call must be complete before it can be reviewed.");
  }
  const existingReview = await getReviewForSession(session.id, user.id);
  if (existingReview) {
    throw new Error("This call already has your review.");
  }
  const rating = Math.max(1, Math.min(5, Number(input.rating || 5)));
  const body = String(input.body || "").trim();
  const title = String(input.title || "Craftvoya review").trim();
  const payload = {
    customer_user_id: user.id,
    expert_user_id: session.expert_user_id,
    expert_profile_id: session.data?.expertProfileId || session.expert_profile_id || null,
    session_id: session.id,
    title,
    status: "published",
    rating,
    body,
    published: true,
    data: {
      rating,
      body,
      expertProfileId: session.data?.expertProfileId || "",
    },
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const { data, error } = await table(tables().reviews).insert(payload).select("*").single();
  if (error) {
    if (isDuplicateKeyError(error)) {
      throw new Error("This call already has your review.");
    }
    throw new Error(error.message);
  }
  return normalizeReview(data);
}

export async function getPaymentByStripeSession(stripeSessionId) {
  if (!stripeSessionId) return null;
  const { data, error } = await table(tables().payments).select("*").eq("stripe_session_id", stripeSessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizePayment(data);
}

export async function listMyPayments(userId) {
  if (!userId) return [];
  const { data, error } = await table(tables().payments)
    .select("*")
    .eq("customer_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(normalizePayment);
}

export async function loadCustomerDashboard(userId) {
  const [sessions, payments] = await Promise.all([listMySessions(userId), listMyPayments(userId)]);
  const customerSessions = sessions.filter((session) => session.customer_user_id === userId);
  const paidPayments = payments.filter((payment) => ["paid", "complete", "succeeded"].includes(payment.status));
  const activeSessions = customerSessions.filter((session) => ["paid", "expert_ready", "connecting", "active", "fallback_required"].includes(session.status));
  const completedSessions = customerSessions.filter((session) => ["complete", "completed"].includes(session.status));
  const pendingPayments = payments.filter((payment) => ["pending", "open"].includes(payment.status));
  return {
    sessions: customerSessions,
    payments,
    activeSessions,
    completedSessions,
    pendingPayments,
    totalSpend: paidPayments.reduce((sum, payment) => sum + Number(payment.amount_cents || 0), 0),
  };
}

export async function loadExpertDashboard(userId) {
  const [profile, sessions] = await Promise.all([getMyExpertProfile(userId), listMySessions(userId)]);
  const expertSessions = sessions.filter((session) => session.expert_user_id === userId);
  const paid = expertSessions.filter((session) => ["paid", "expert_ready", "connecting", "active", "fallback_required", "complete"].includes(session.status));
  const pending = expertSessions.filter((session) => session.status === "pending_payment");
  const gross = paid.reduce((sum, session) => sum + Number(session.amount_cents || 0), 0);
  return {
    expertProfile: profile,
    sessions: paid,
    pending,
    gross,
    net: estimateExpertPayoutFromGross(gross),
  };
}

export async function listAdminRecords() {
  const tableNames = [
    tables().expertProfiles,
    tables().sessions,
    tables().payments,
    tables().reviews,
    tables().userProfiles,
  ];
  const results = await Promise.all(
    tableNames.map((name) => table(name).select("*").order("created_at", { ascending: false }).limit(60)),
  );
  const errors = results.map((result) => result.error).filter(Boolean);
  if (errors.length) {
    throw new Error(errors[0].message);
  }
  const [experts, sessions, payments, reviews, users] = results.map((result) => result.data || []);
  return [
    ...experts.map((row) => normalizeExpertProfile(row)),
    ...sessions.map(normalizeSession),
    ...payments.map(normalizePayment),
    ...reviews.map(normalizeReview),
    ...users.map(normalizeUserProfile),
  ]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, 200);
}

export async function uploadProfileImage(userId, file) {
  return uploadImageToStorage(userId, file);
}

export async function uploadPortfolioImage(userId, file) {
  return uploadImageToStorage(userId, file, "portfolio");
}
