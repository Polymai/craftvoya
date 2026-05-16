import { APP_CONFIG } from "./config.js";
import { supabase } from "./supabaseClient.js";

let channel = null;

export function stopRealtime() {
  if (channel && supabase) {
    supabase.removeChannel(channel);
  }
  channel = null;
}

function rowTouchesUser(row, userId) {
  return row.user_id === userId || row.customer_user_id === userId || row.expert_user_id === userId;
}

export function startRealtime(userId, onChange) {
  stopRealtime();
  if (!supabase || !userId) {
    return;
  }

  const tables = [
    APP_CONFIG.tables.userProfiles,
    APP_CONFIG.tables.expertProfiles,
    APP_CONFIG.tables.availability,
    APP_CONFIG.tables.sessions,
    APP_CONFIG.tables.payments,
    APP_CONFIG.tables.reviews,
  ];

  channel = supabase.channel(`${APP_CONFIG.appId}:multi-table:${userId}`);
  tables.forEach((table) => {
    channel.on(
      "postgres_changes",
      { event: "*", schema: APP_CONFIG.schema, table },
      (payload) => {
        const row = payload.new || payload.old || {};
        const publicMarketplace = [APP_CONFIG.tables.expertProfiles, APP_CONFIG.tables.availability, APP_CONFIG.tables.reviews].includes(table);
        if (rowTouchesUser(row, userId) || publicMarketplace) {
          onChange(payload);
        }
      },
    );
  });
  channel.subscribe();
}
