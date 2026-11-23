// Cloudflare Web Analytics (cookieless, configured for sreerang.pages.dev).
// Deliberately excludes temporary preview deployments to protect visit counts.
(() => {
  if (location.hostname !== "sreerang.pages.dev") return;
  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
  const beacon = document.createElement("script");
  beacon.defer = true;
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token: "2444b00e8b2b4f3382e2c1c56718e06e" });
  document.head.appendChild(beacon);
})();
