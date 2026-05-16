import { APP_CONFIG, formatMoney } from "../config.js";
import { createWebrtcCall } from "../api/webrtcCall.js";
import { roomIceServers } from "../api/webrtcRooms.js";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

const VIDEO_PLACEHOLDER_SRC = "assets/video-placeholder.svg";

let timer = null;
let activeCall = null;

function sessionDurationMs(session) {
  return Number(session?.data?.durationMinutes || APP_CONFIG.sessionMinutes) * 60 * 1000;
}

function isCompleteSession(session) {
  return ["complete", "completed"].includes(String(session?.status || ""));
}

function timerStart(session) {
  return session?.data?.startedAt || session?.data?.meeting?.expertJoinedAt || session?.data?.meeting?.activeAt || "";
}

function timerTarget(session) {
  if (isCompleteSession(session)) return "";
  const start = timerStart(session);
  if (!start) return "";
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs)) return "";
  return startMs + sessionDurationMs(session);
}

function initialCountdown(session) {
  if (isCompleteSession(session)) return "00:00";
  const minutes = Math.floor(sessionDurationMs(session) / 60000);
  return `${String(minutes).padStart(2, "0")}:00`;
}

function timerMeta(session, timerStarted) {
  if (isCompleteSession(session)) {
    return "The timer ended when the call was completed.";
  }
  return timerStarted ? "The timer started when the expert joined the in-app room." : "The timer starts when the expert joins the in-app room.";
}

function isExpert(state, session) {
  return state.auth.user?.id === session.expert_user_id;
}

function isCustomer(state, session) {
  return state.auth.user?.id === session.customer_user_id;
}

function sessionActionMarkup(state, session) {
  const status = String(session.status || "");
  const expert = isExpert(state, session);
  const customer = isCustomer(state, session);
  const meeting = session.data?.meeting || {};
  if (isCompleteSession(session)) {
    return '<p class="meta">This meeting is complete.</p>';
  }
  if (["paid", "expert_ready", "connecting", "active", "fallback_required"].includes(status)) {
    if (expert && status === "paid") {
      return `
        <div class="button-row">
          <button class="button primary" data-action="start-webrtc" data-session-id="${escapeHtml(session.id)}">Start in-app call</button>
        </div>
      `;
    }
    if (customer && status === "paid") {
      return '<div class="empty-state compact"><h3>Waiting for expert.</h3><p>The in-app call unlocks when the expert has opened the room.</p></div>';
    }
    const joinText = activeCall?.sessionId === session.id ? "Call open" : "Join in-app call";
    return `
      <div class="button-row">
        <button class="button primary" data-action="join-webrtc" data-session-id="${escapeHtml(session.id)}">${joinText}</button>
        <button class="button ghost" data-action="request-fallback" data-session-id="${escapeHtml(session.id)}">Report connection problem</button>
        ${expert ? `<button class="button ghost" data-action="complete-session" data-session-id="${escapeHtml(session.id)}">Complete</button>` : ""}
      </div>
      ${meeting.fallbackRequiredAt ? '<p class="meta">A connection problem was logged for this call. Try rejoining from both browsers.</p>' : ""}
    `;
  }
  return '<p class="meta">Actions will appear after payment is confirmed.</p>';
}

function webrtcPanel(session) {
  const active = activeCall?.sessionId === session.id;
  return `
    <article class="card webrtc-panel${active ? " live" : ""}" data-webrtc-panel>
      <div class="section-head compact-head">
        <div>
          <p class="eyebrow">In-app video</p>
          <h3>${active ? "Call room open" : "Join when both sides are ready"}</h3>
        </div>
        <span class="status-pill ${active ? "online" : "pending"}" data-webrtc-status>${active ? "connecting" : "idle"}</span>
      </div>
      <div class="video-grid">
        <div class="video-tile" data-video-tile>
          <video data-local-video autoplay muted playsinline></video>
          <div class="video-placeholder">
            <div class="video-placeholder-body">
              <img class="video-placeholder-image" src="${VIDEO_PLACEHOLDER_SRC}" alt="" loading="lazy" decoding="async">
              <strong>Camera preview</strong>
              <small>${active ? "Starting camera" : "Not live yet"}</small>
            </div>
          </div>
          <span class="video-label">You</span>
        </div>
        <div class="video-tile" data-video-tile>
          <video data-remote-video autoplay playsinline></video>
          <div class="video-placeholder">
            <div class="video-placeholder-body">
              <img class="video-placeholder-image" src="${VIDEO_PLACEHOLDER_SRC}" alt="" loading="lazy" decoding="async">
              <strong>Other side</strong>
              <small>${active ? "Waiting for video" : "Not live yet"}</small>
            </div>
          </div>
          <span class="video-label">Other side</span>
        </div>
      </div>
      <div class="dashboard-action-row">
        <button class="button ghost" data-action="switch-camera"${active ? "" : " disabled"}>Switch camera</button>
        <button class="button ghost" data-action="leave-webrtc"${active ? "" : " disabled"}>Leave in-app call</button>
      </div>
    </article>
  `;
}

function reviewMarkup(session, canReview) {
  const review = session.data?.customerReview;
  if (review) {
    const rating = Math.max(1, Math.min(5, Number(review.data?.rating || review.rating || 5) || 5));
    const body = String(review.data?.body || review.body || "").trim();
    return `
      <article class="form-panel review-panel">
        <div>
          <p class="eyebrow">Review</p>
          <h3>Review published</h3>
        </div>
        <div class="stat-grid">
          <div class="stat"><strong>${rating}</strong><span>Rating</span></div>
          <div class="stat"><strong>1</strong><span>Review for this call</span></div>
        </div>
        ${body ? `<p>${escapeHtml(body)}</p>` : '<p class="meta">Your review for this call has been saved.</p>'}
      </article>
    `;
  }
  if (!canReview) return "";
  return `
    <form class="form-panel review-panel" data-review-form>
      <div>
        <p class="eyebrow">Review</p>
        <h3>Rate this consultation</h3>
      </div>
      <div class="form-field">
        Rating
        <div class="rating-grid">
          <label class="rating-choice">
            <input type="radio" name="rating" value="5" checked>
            <strong>5</strong>
            <span>Excellent</span>
          </label>
          <label class="rating-choice">
            <input type="radio" name="rating" value="4">
            <strong>4</strong>
            <span>Good</span>
          </label>
          <label class="rating-choice">
            <input type="radio" name="rating" value="3">
            <strong>3</strong>
            <span>Okay</span>
          </label>
          <label class="rating-choice">
            <input type="radio" name="rating" value="2">
            <strong>2</strong>
            <span>Poor</span>
          </label>
          <label class="rating-choice">
            <input type="radio" name="rating" value="1">
            <strong>1</strong>
            <span>Bad</span>
          </label>
        </div>
      </div>
      <label>
        Review
        <textarea name="body" placeholder="What helped most?"></textarea>
      </label>
      <button class="button primary" type="submit">Publish review</button>
    </form>
  `;
}

export function renderSessionPage(state) {
  const session = state.data.activeSession;
  if (state.ui.routeLoading && !session) {
    return '<section class="route-view section"><div class="empty-state">Loading session...</div></section>';
  }
  if (!session) {
    return '<section class="route-view section"><div class="empty-state"><h2>Session unavailable.</h2><p>The consultation may still be pending payment or outside your access.</p></div></section>';
  }
  const complete = isCompleteSession(session);
  const target = timerTarget(session);
  const timerStarted = Boolean(target);
  const canReview = state.auth.user?.id === session.customer_user_id && complete && !session.data?.customerReview;
  return `
    <section class="route-view stack session-room">
      <div class="section-head">
        <div>
          <p class="eyebrow">Consultation session</p>
          <h2>${escapeHtml(session.title || "Craftvoya session")}</h2>
          <p class="meta">${formatMoney(session.amount_cents, session.currency)} &middot; ${escapeHtml(session.data?.expertName || "Expert")}</p>
        </div>
        <span class="status-pill ${escapeHtml(session.status)}">${escapeHtml(session.status.replaceAll("_", " "))}</span>
      </div>
      <div class="session-room-primary">
        <article class="card session-timer-card">
          <p class="eyebrow">Time remaining</p>
          <div class="countdown js-countdown" data-complete="${complete ? "true" : "false"}" data-started="${timerStarted ? "true" : "false"}" data-target="${target}" data-duration="${sessionDurationMs(session)}">${initialCountdown(session)}</div>
          <p class="meta">${timerMeta(session, timerStarted)}</p>
          ${sessionActionMarkup(state, session)}
        </article>
        ${webrtcPanel(session)}
      </div>
      ${reviewMarkup(session, canReview)}
    </section>
  `;
}

function updateCountdown(element) {
  if (element.dataset.complete === "true") {
    element.textContent = "00:00";
    return;
  }
  if (element.dataset.started !== "true") {
    const minutes = Math.floor(Number(element.dataset.duration || 0) / 60000);
    element.textContent = `${String(minutes).padStart(2, "0")}:00`;
    return;
  }
  const target = Number(element.dataset.target || Date.now());
  const remaining = Math.max(0, target - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  element.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function bindSessionPage(root, actions, state) {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  const countdown = root.querySelector(".js-countdown");
  if (countdown) {
    updateCountdown(countdown);
    if (countdown.dataset.complete !== "true") {
      timer = window.setInterval(() => updateCountdown(countdown), 1000);
    }
  }

  attachActiveCall(root);
  syncVideoPlaceholders(root);

  root.querySelectorAll("[data-action='complete-session']").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        closeActiveCall();
        await actions.updateSessionStatus(button.dataset.sessionId, "complete", { completedAt: new Date().toISOString() });
        await actions.refresh();
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll("[data-action='start-webrtc']").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await actions.startWebrtcRoom(button.dataset.sessionId);
        actions.showNotice("The in-app room is open. Join the room when your camera is ready.");
        await actions.refresh();
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll("[data-action='join-webrtc']").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const room = await actions.joinWebrtcRoom(button.dataset.sessionId);
        if (room.waiting) {
          actions.showNotice(room.message || "Waiting for the expert to open the room.");
          return;
        }
        await startCall(root, actions, button.dataset.sessionId, room);
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll("[data-action='leave-webrtc']").forEach((button) => {
    button.addEventListener("click", () => {
      closeActiveCall();
      resetCallPanel(root);
    });
  });

  root.querySelectorAll("[data-action='switch-camera']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!activeCall?.controller) {
        actions.showNotice("Join the in-app call before switching camera.");
        return;
      }
      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = "Switching...";
      try {
        const result = await activeCall.controller.switchCamera();
        actions.showNotice(result?.label ? `Camera switched to ${result.label}.` : "Camera switched.");
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
        button.textContent = previousText;
      }
    });
  });

  root.querySelectorAll("[data-action='request-fallback']").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await actions.markWebrtcFallback(button.dataset.sessionId, { reason: "manual_request" });
        actions.showNotice("Connection problem logged for this session.");
        await actions.refresh();
      } catch (error) {
        actions.showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  const reviewForm = root.querySelector("[data-review-form]");
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(reviewForm);
      try {
        await actions.createReview(state.auth.user, state.data.activeSession, Object.fromEntries(formData.entries()));
        actions.showNotice("Review published.");
        await actions.refresh();
      } catch (error) {
        actions.showError(error.message);
      }
    });
  }
}

function callElements(root) {
  const panel = root.querySelector("[data-webrtc-panel]");
  return {
    panel,
    status: panel?.querySelector("[data-webrtc-status]"),
    localVideo: panel?.querySelector("[data-local-video]"),
    remoteVideo: panel?.querySelector("[data-remote-video]"),
    switchCamera: panel?.querySelector("[data-action='switch-camera']"),
  };
}

function videoHasStream(video) {
  const stream = video?.srcObject;
  if (!stream) return false;
  if (typeof MediaStream !== "undefined" && stream instanceof MediaStream) {
    return stream.getVideoTracks().some((track) => track.readyState !== "ended");
  }
  return true;
}

function syncVideoPlaceholders(root) {
  root.querySelectorAll("[data-video-tile] video").forEach((video) => {
    video.closest("[data-video-tile]")?.classList.toggle("has-stream", videoHasStream(video));
  });
}

function attachActiveCall(root) {
  const elements = callElements(root);
  if (!elements.panel) return;
  if (activeCall?.controller) {
    activeCall.controller.attach(elements.localVideo, elements.remoteVideo);
    syncVideoPlaceholders(root);
    if (elements.status) {
      elements.status.textContent = activeCall.status || "connecting";
      elements.status.className = `status-pill ${activeCall.connected ? "online" : "pending"}`;
    }
    if (elements.switchCamera) {
      elements.switchCamera.disabled = false;
    }
  }
}

function resetCallPanel(root) {
  const elements = callElements(root);
  if (elements.localVideo) elements.localVideo.srcObject = null;
  if (elements.remoteVideo) elements.remoteVideo.srcObject = null;
  syncVideoPlaceholders(root);
  if (elements.status) {
    elements.status.textContent = "idle";
    elements.status.className = "status-pill pending";
  }
  if (elements.switchCamera) {
    elements.switchCamera.disabled = true;
  }
  root.querySelector("[data-action='leave-webrtc']")?.setAttribute("disabled", "");
}

function closeActiveCall() {
  activeCall?.controller?.close();
  activeCall = null;
}

async function startCall(root, actions, sessionId, room) {
  if (activeCall?.sessionId && activeCall.sessionId !== sessionId) {
    closeActiveCall();
  }
  const elements = callElements(root);
  if (!elements.localVideo || !elements.remoteVideo) {
    throw new Error("Call panel is not ready.");
  }
  activeCall = {
    sessionId,
    status: "connecting",
    connected: false,
    controller: null,
  };
  const setStatus = (message) => {
    if (!activeCall) return;
    activeCall.status = message;
    const statusEl = document.querySelector("[data-webrtc-panel] [data-webrtc-status]");
    if (statusEl) {
      statusEl.textContent = message.replace(/^Connection:\s*/i, "");
      statusEl.className = `status-pill ${activeCall.connected ? "online" : "pending"}`;
    }
  };
  try {
    activeCall.controller = await createWebrtcCall({
      role: room.role,
      channelId: room.channelId,
      iceServers: roomIceServers(room),
      localVideo: elements.localVideo,
      remoteVideo: elements.remoteVideo,
      onMediaChanged: () => syncVideoPlaceholders(root),
      onStatus: setStatus,
      onConnected: async ({ candidateType }) => {
        if (!activeCall) return;
        activeCall.connected = true;
        setStatus(candidateType === "relay" ? "connected via relay" : "connected");
        try {
          await actions.markWebrtcActive(sessionId, { candidateType });
        } catch (error) {
          actions.showNotice(`Call connected, but status sync failed: ${error.message}`);
        }
      },
      onFailed: async (reason) => {
        setStatus("connection problem");
        try {
          await actions.markWebrtcFallback(sessionId, { reason });
        } catch {
          // Keep the live UI usable even if fallback logging fails.
        }
      },
    });
  } catch (error) {
    activeCall = null;
    throw error;
  }
  if (room.role === "expert" && actions.markWebrtcJoined) {
    try {
      await actions.markWebrtcJoined(sessionId);
    } catch (error) {
      actions.showNotice(`Call opened, but timer sync failed: ${error.message}`);
    }
  }
  attachActiveCall(root);
  syncVideoPlaceholders(root);
}
