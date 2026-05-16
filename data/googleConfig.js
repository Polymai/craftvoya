// Polymai runtime Google Meet config.
// Frontend-safe only: Google OAuth client ID and Calendar ID.
// Never add OAuth client secrets, refresh tokens, service account keys, or private tokens here.
(function () {
  const config = Object.freeze({
    clientId: "1085050846979-vrr50oj7l6e75stbtu5filqdlgtir9aa.apps.googleusercontent.com",
    calendarId: "primary",
  });
  window.__POLYMAI_GOOGLE_CONFIG__ = config;
})();
