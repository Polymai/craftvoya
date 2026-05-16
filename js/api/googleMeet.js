import { APP_CONFIG, getGoogleConfig } from "../config.js";

let gisLoadPromise = null;
let tokenClient = null;
let tokenClientId = "";
let accessToken = "";
let accessTokenExpiresAt = 0;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisLoadPromise) {
    return gisLoadPromise;
  }
  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google sign-in failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google sign-in failed to load."));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

export function isGoogleMeetAutomationConfigured() {
  return Boolean(getGoogleConfig().clientId);
}

export async function connectGoogleCalendar() {
  const googleConfig = getGoogleConfig();
  if (!googleConfig.clientId) {
    throw new Error("Google Meet is not connected for this app yet. Ask the app owner to finish Google setup in Polymai.");
  }
  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    if (!tokenClient || tokenClientId !== googleConfig.clientId) {
      tokenClientId = googleConfig.clientId;
      accessToken = "";
      accessTokenExpiresAt = 0;
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleConfig.clientId,
        scope: googleConfig.calendarScope,
        callback: () => {},
      });
    }
    tokenClient.callback = (response) => {
      if (response?.error) {
        reject(new Error(response.error_description || response.error || "Google Meet authorization failed."));
        return;
      }
      accessToken = response?.access_token || "";
      const expiresInMs = Math.max(60, Number(response?.expires_in || 3600) - 60) * 1000;
      accessTokenExpiresAt = Date.now() + expiresInMs;
      if (!accessToken) {
        reject(new Error("Google did not return access to create a Meet room."));
        return;
      }
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: accessToken && Date.now() < accessTokenExpiresAt ? "" : "consent" });
  });
}

function calendarIdPath() {
  return encodeURIComponent(getGoogleConfig().calendarId || "primary");
}

async function googleCalendarFetch(path, options = {}) {
  if (!accessToken || Date.now() >= accessTokenExpiresAt) {
    await connectGoogleCalendar();
  }
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(json.error?.message || json.message || `Google Calendar returned HTTP ${response.status}.`);
  }
  return json;
}

function findMeetUrl(event) {
  const direct = String(event?.hangoutLink || "").trim();
  if (direct) return direct;
  const entryPoints = Array.isArray(event?.conferenceData?.entryPoints) ? event.conferenceData.entryPoints : [];
  const video = entryPoints.find((entry) => entry?.entryPointType === "video" && entry?.uri);
  return String(video?.uri || "").trim();
}

async function createCalendarMeetEvent(input = {}) {
  const now = new Date();
  const minutes = Number.isFinite(Number(input.durationMinutes))
    ? Math.max(1, Number(input.durationMinutes))
    : APP_CONFIG.onlineMeetBlockMinutes;
  const end = new Date(now.getTime() + minutes * 60 * 1000);
  const requestId = `${APP_CONFIG.appId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const event = await googleCalendarFetch(`/calendars/${calendarIdPath()}/events?conferenceDataVersion=1&sendUpdates=none`, {
    method: "POST",
    body: JSON.stringify({
      summary: input.summary || `${input.expertName || "Craftvoya expert"} is online on Craftvoya`,
      description: input.description || "Temporary Craftvoya expert consultation room. This event is created when the expert goes online and removed when they stop taking calls.",
      start: { dateTime: now.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  });

  const meetUrl = findMeetUrl(event);
  if (!meetUrl) {
    throw new Error("Google Meet created a room but did not return a join link.");
  }
  return {
    meetUrl,
    htmlLink: event.htmlLink || meetUrl,
    googleCalendarEventId: event.id || "",
    googleMeetSpaceName: event.id || "",
    googleMeetCode: String(event.conferenceData?.conferenceId || "").trim(),
    createdAt: now.toISOString(),
    endsAt: end.toISOString(),
  };
}

export async function createOnlineMeetEvent(input = {}) {
  return createCalendarMeetEvent(input);
}

export async function deleteOnlineMeetEvent(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return null;
  if (!accessToken || Date.now() >= accessTokenExpiresAt) {
    await connectGoogleCalendar();
  }
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarIdPath()}/events/${encodeURIComponent(id)}?sendUpdates=none`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.ok || response.status === 404 || response.status === 410) {
    return null;
  }
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  throw new Error(json.error?.message || json.message || `Google Calendar returned HTTP ${response.status}.`);
}

export async function testGoogleMeetSetup() {
  const created = await createCalendarMeetEvent({
    expertName: "Craftvoya test",
    summary: "Craftvoya Google Meet setup test",
    description: "Temporary setup test. This event should be deleted automatically within a few seconds.",
    durationMinutes: 5,
  });
  try {
    await deleteOnlineMeetEvent(created.googleCalendarEventId || created.googleMeetSpaceName);
  } catch (error) {
    throw new Error(`Google Meet test created a room, but could not delete the test event: ${error.message}`);
  }
  return created;
}
