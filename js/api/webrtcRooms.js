import { APP_CONFIG, SUPABASE_CONFIG } from "../config.js";
import { currentAccessToken } from "../supabaseClient.js";

async function callRoomFunction(payload) {
  const token = await currentAccessToken();
  if (!token) {
    throw new Error("Sign in before opening the call room.");
  }
  const base = SUPABASE_CONFIG.functionsBaseUrl || "";
  if (!base) {
    throw new Error("Supabase Functions base URL is missing.");
  }

  const response = await fetch(`${base}/${APP_CONFIG.webrtcRoomFunction}`, {
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
    const error = new Error(json.error || json.message || `Function returned HTTP ${response.status}.`);
    error.status = response.status;
    error.setupRequired = Boolean(json.setup_required);
    throw error;
  }
  return json;
}

export function roomIceServers(room = {}) {
  return Array.isArray(room.iceServers) && room.iceServers.length ? room.iceServers : APP_CONFIG.webrtcIceServers;
}

export async function startWebrtcRoom(sessionId) {
  return callRoomFunction({ action: "start-room", sessionId });
}

export async function joinWebrtcRoom(sessionId) {
  return callRoomFunction({ action: "join-room", sessionId });
}

export async function markWebrtcJoined(sessionId) {
  return callRoomFunction({ action: "mark-joined", sessionId });
}

export async function markWebrtcActive(sessionId, details = {}) {
  return callRoomFunction({ action: "mark-active", sessionId, ...details });
}

export async function markWebrtcFallback(sessionId, details = {}) {
  return callRoomFunction({ action: "mark-fallback", sessionId, ...details });
}
