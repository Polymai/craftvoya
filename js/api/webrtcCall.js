import { APP_CONFIG } from "../config.js";
import { createSignalChannel } from "./webrtcSignaling.js";

function shortId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function selectedCandidateType(pc) {
  try {
    const stats = await pc.getStats();
    let selectedPair = null;
    stats.forEach((report) => {
      if (report.type === "transport" && report.selectedCandidatePairId) {
        selectedPair = stats.get(report.selectedCandidatePairId);
      }
      if (report.type === "candidate-pair" && report.selected) {
        selectedPair = report;
      }
    });
    const candidate = selectedPair?.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
    return candidate?.candidateType || "";
  } catch {
    return "";
  }
}

export async function createWebrtcCall({
  role,
  channelId,
  iceServers,
  localVideo,
  remoteVideo,
  onMediaChanged,
  onStatus,
  onConnected,
  onFailed,
}) {
  const peerId = `${role}-${shortId()}`;
  const state = {
    makingOffer: false,
    ignoreOffer: false,
    connected: false,
    closed: false,
    remoteReady: false,
    readyEchoed: false,
    failureReported: false,
    stream: null,
    videoDeviceId: "",
    remoteStream: new MediaStream(),
    signal: null,
  };
  const polite = role === "customer";
  const isExpert = role === "expert";
  const pc = new RTCPeerConnection({ iceServers: iceServers || APP_CONFIG.webrtcIceServers });

  function setStatus(message) {
    onStatus?.(message);
  }

  function attach(nextLocalVideo = localVideo, nextRemoteVideo = remoteVideo) {
    if (nextLocalVideo && state.stream) {
      nextLocalVideo.srcObject = state.stream;
      nextLocalVideo.muted = true;
      nextLocalVideo.playsInline = true;
    }
    if (nextRemoteVideo) {
      nextRemoteVideo.srcObject = state.remoteStream;
      nextRemoteVideo.playsInline = true;
    }
    onMediaChanged?.();
  }

  function videoSender() {
    return pc.getSenders().find((sender) => sender.track?.kind === "video");
  }

  async function videoInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput" && device.deviceId);
  }

  async function switchCamera() {
    if (state.closed) {
      throw new Error("The call is closed.");
    }
    const devices = await videoInputs();
    if (devices.length < 2) {
      throw new Error("No second camera was found on this device.");
    }

    const currentTrack = state.stream?.getVideoTracks()[0] || null;
    const currentId = state.videoDeviceId || currentTrack?.getSettings?.().deviceId || "";
    const currentIndex = devices.findIndex((device) => device.deviceId === currentId);
    const nextDevice = devices[(currentIndex + 1 + devices.length) % devices.length];
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: nextDevice.deviceId } },
      audio: false,
    });
    const nextTrack = nextStream.getVideoTracks()[0];
    if (!nextTrack) {
      nextStream.getTracks().forEach((track) => track.stop());
      throw new Error("The selected camera did not provide a video track.");
    }

    const sender = videoSender();
    if (!sender) {
      nextTrack.stop();
      throw new Error("The call has no active video sender.");
    }

    try {
      await sender.replaceTrack(nextTrack);
    } catch (error) {
      nextTrack.stop();
      throw error;
    }
    if (currentTrack) {
      state.stream.removeTrack(currentTrack);
      currentTrack.stop();
    }
    state.stream.addTrack(nextTrack);
    state.videoDeviceId = nextDevice.deviceId;
    attach();
    return { label: nextDevice.label || "" };
  }

  async function makeOffer() {
    if (!isExpert || state.closed || !state.remoteReady) return;
    try {
      state.makingOffer = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await state.signal.sendSignal({ type: "offer", description: pc.localDescription });
      setStatus("Waiting for answer...");
    } finally {
      state.makingOffer = false;
    }
  }

  async function handleSignal(message) {
    if (state.closed) return;
    if (message.type === "peer-ready") {
      state.remoteReady = true;
      if (!isExpert && !state.readyEchoed) {
        state.readyEchoed = true;
        await state.signal.sendSignal({ type: "peer-ready", role });
      }
      if (isExpert) await makeOffer();
      return;
    }
    if (message.type === "peer-left") {
      setStatus("The other side left the call.");
      return;
    }
    if (message.description) {
      const description = message.description;
      const offerCollision = description.type === "offer" && (state.makingOffer || pc.signalingState !== "stable");
      state.ignoreOffer = !polite && offerCollision;
      if (state.ignoreOffer) return;

      await pc.setRemoteDescription(description);
      if (description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await state.signal.sendSignal({ type: "answer", description: pc.localDescription });
        setStatus("Connecting...");
      }
      return;
    }
    if (message.candidate) {
      try {
        await pc.addIceCandidate(message.candidate);
      } catch (error) {
        if (!state.ignoreOffer) throw error;
      }
    }
  }

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      state.signal?.sendSignal({ type: "ice-candidate", candidate });
    }
  };

  pc.ontrack = ({ track }) => {
    state.remoteStream.addTrack(track);
    attach();
  };

  pc.onconnectionstatechange = async () => {
    setStatus(`Connection: ${pc.connectionState}`);
    if (pc.connectionState === "connected" && !state.connected) {
      state.connected = true;
      const candidateType = await selectedCandidateType(pc);
      onConnected?.({ candidateType });
    }
    if (["failed", "disconnected"].includes(pc.connectionState) && !state.closed && !state.failureReported) {
      state.failureReported = true;
      onFailed?.(pc.connectionState);
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(pc.iceConnectionState) && !state.closed && !state.failureReported) {
      state.failureReported = true;
      onFailed?.(pc.iceConnectionState);
    }
  };

  state.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  state.videoDeviceId = state.stream.getVideoTracks()[0]?.getSettings?.().deviceId || "";
  state.stream.getTracks().forEach((track) => pc.addTrack(track, state.stream));
  attach();

  state.signal = await createSignalChannel(channelId, peerId, {
    onSignal: handleSignal,
    onPresence: () => {},
  });

  await state.signal.sendSignal({ type: "peer-ready", role });
  setStatus("Waiting for peer...");

  const timeout = window.setTimeout(() => {
    if (!state.connected && !state.closed && !state.failureReported) {
      state.failureReported = true;
      onFailed?.("connection_timeout");
    }
  }, APP_CONFIG.webrtcConnectTimeoutMs);

  return {
    attach,
    switchCamera,
    close() {
      state.closed = true;
      window.clearTimeout(timeout);
      state.signal?.sendSignal({ type: "peer-left", role }).catch(() => {});
      state.signal?.close();
      state.stream?.getTracks().forEach((track) => track.stop());
      pc.getSenders().forEach((sender) => sender.track?.stop());
      pc.close();
    },
  };
}
