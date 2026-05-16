import { APP_CONFIG } from "../config.js";
import { supabase } from "../supabaseClient.js";

export async function createSignalChannel(channelId, peerId, handlers = {}) {
  if (!supabase) {
    throw new Error("Supabase is not configured for realtime signaling.");
  }
  if (!channelId) {
    throw new Error("A call channel is required.");
  }

  const channel = supabase.channel(`${APP_CONFIG.appId}:webrtc:${channelId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: peerId },
    },
  });

  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    if (!payload || payload.senderId === peerId) return;
    handlers.onSignal?.(payload);
  });

  channel.on("presence", { event: "sync" }, () => {
    handlers.onPresence?.(channel.presenceState());
  });

  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Realtime signaling did not connect.")), 8000);
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timeout);
        await channel.track({ peerId, joinedAt: new Date().toISOString() });
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        window.clearTimeout(timeout);
        reject(new Error("Realtime signaling channel failed."));
      }
    });
  });

  return {
    async sendSignal(payload) {
      await channel.send({
        type: "broadcast",
        event: "signal",
        payload: {
          ...payload,
          senderId: peerId,
          sentAt: new Date().toISOString(),
        },
      });
    },
    close() {
      supabase.removeChannel(channel);
    },
  };
}
