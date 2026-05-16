// Polymai runtime Stripe config.
// Frontend-safe only: publishable key, mode, redirect defaults, and function URL.
// Never add Stripe secret keys, webhook secrets, restricted keys, or backend credentials here.
(function () {
  const config = Object.freeze({
    mode: "test",
    publishableKey: "pk_test_51TS3spRndyGeYiPN1ggn5xv2S9j498dTFjPEpx3uBcxjB2HNidQMf2LJ0vcTzso4JzbVVfFwHQf8IYFTZ88Y4xNm00gTQrWc28",
    functionsBaseUrl: "https://pfnlebwkbhblytpvaokd.supabase.co/functions/v1",
    defaultSuccessUrl: "",
    defaultCancelUrl: "",
    defaultPriceIds: [],
  });
  window.__POLYMAI_STRIPE_CONFIG__ = config;
})();
