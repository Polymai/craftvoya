import { CATEGORIES } from "./config.js";

const initialState = {
  booting: true,
  route: {
    name: "landing",
    path: "/",
    params: {},
    query: {},
  },
  auth: {
    loading: true,
    session: null,
    user: null,
    profile: null,
    error: "",
    notice: "",
  },
  ui: {
    routeLoading: false,
    routeError: "",
    actionError: "",
    actionNotice: "",
  },
  data: {
    categories: CATEGORIES,
    selectedCategory: CATEGORIES[0].key,
    experts: [],
    expertsDemo: false,
    selectedExpert: null,
    selectedReviews: [],
    sessions: [],
    payments: [],
    activeSession: null,
    paymentConfirmation: null,
    dashboard: null,
    adminRecords: null,
  },
};

let state = structuredClone(initialState);
const listeners = new Set();

function notify() {
  for (const listener of listeners) {
    listener(state);
  }
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

export function setAuth(patch) {
  state = { ...state, auth: { ...state.auth, ...patch } };
  notify();
}

export function setUi(patch) {
  state = { ...state, ui: { ...state.ui, ...patch } };
  notify();
}

export function setData(patch) {
  state = { ...state, data: { ...state.data, ...patch } };
  notify();
}

export function setRoute(route) {
  state = { ...state, route };
  notify();
}

export function clearActionMessages() {
  setUi({ actionError: "", actionNotice: "" });
}

export function signedInUserId() {
  return state.auth.user?.id || "";
}

export function currentRole() {
  return state.auth.profile?.data?.role || "";
}

export function isCustomer() {
  return currentRole() === "customer";
}

export function isExpert() {
  return currentRole() === "expert" || isAdmin();
}

export function isAdmin() {
  return state.auth.profile?.data?.role === "admin";
}
