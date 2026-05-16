import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { APP_CONFIG, SUPABASE_CONFIG } from "./config.js";

export const isSupabaseConfigured = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      db: { schema: APP_CONFIG.schema },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
      global: {
        headers: {
          "x-application-name": APP_CONFIG.appId,
        },
      },
    })
  : null;

export async function currentAccessToken() {
  if (!supabase) {
    return "";
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session?.access_token || "";
}

export async function uploadExpertImage(userId, file, mediaType = "avatar") {
  if (!supabase) {
    throw new Error("Supabase is not configured for uploads.");
  }
  if (!userId || !file) {
    throw new Error("A signed-in expert and image file are required.");
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
  const safeType = String(mediaType || "avatar").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "avatar";
  const path = `profiles/${userId}/${safeType}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from(APP_CONFIG.mediaBucket)
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(APP_CONFIG.mediaBucket).getPublicUrl(path);
  return data.publicUrl;
}
