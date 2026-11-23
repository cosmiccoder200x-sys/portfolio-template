/* Lightweight, privacy-first lead conversion: no third-party tracking cookies. */
(() => {
  "use strict";
  const config = window.PORTFOLIO_MONETIZATION || {};
  const page = document.body.dataset.monetizationPage;
  const track = (event) => {
    if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
    const data = JSON.stringify({ event });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/event", new Blob([data], { type: "application/json" }));
      } else {
        fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: data, keepalive: true }).catch(() => {});
      }
    } catch (_) { /* Metrics never block site use. */ }
  };
  if (page === "hire") track("hire_view");
  if (page === "templates") track("template_view");
  document.querySelectorAll("[data-track]").forEach((link) => {
    link.addEventListener("click", () => track(link.dataset.track));
  });
  const checkout = document.getElementById("template-checkout");
  if (checkout && typeof config.checkoutUrl === "string") {
    try {
      const destination = new URL(config.checkoutUrl);
      if (destination.protocol === "https:" && destination.username === "" && destination.password === "") {
        checkout.href = destination.href;
        checkout.hidden = false;
        checkout.addEventListener("click", () => track("template_interest"));
        document.getElementById("checkout-pending")?.remove();
      }
    } catch (_) { /* No confirmed checkout: leave the button hidden. */ }
  }

  const form = document.getElementById("hire-form");
  if (!form) return;
  const submit = document.getElementById("hire-submit");
  const status = document.getElementById("hire-status");
  const notice = document.getElementById("setup-notice");
  const project = document.getElementById("project-type");
  if (new URLSearchParams(location.search).get("project") === "template") project.value = "template";
  let token = "";
  let widgetId = null;
  let startedAt = Date.now();
  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.className = "status " + type;
  };
  if (typeof config.turnstileSiteKey !== "string" || !config.turnstileSiteKey.trim()) {
    setStatus("Online enquiries are not available yet. Please email me directly.", "error");
    return;
  }
  const challengeScript = document.createElement("script");
  challengeScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  challengeScript.async = true;
  challengeScript.onload = () => {
    if (!window.turnstile) {
      setStatus("Security check couldn't load. Please use the email link.", "error");
      return;
    }
    widgetId = window.turnstile.render("#turnstile", {
      sitekey: config.turnstileSiteKey,
      callback: (value) => { token = value; submit.disabled = false; },
      "expired-callback": () => { token = ""; submit.disabled = true; },
      "error-callback": () => { token = ""; submit.disabled = true; setStatus("Security verification failed. Please retry.", "error"); }
    });
    if (notice) notice.hidden = true;
    setStatus("");
  };
  challengeScript.onerror = () => setStatus("Security check couldn't load. Please email me instead.", "error");
  document.head.appendChild(challengeScript);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || !token || submit.disabled) return;
    submit.disabled = true;
    setStatus("Sending your enquiry…");
    const values = new FormData(form);
    const payload = Object.fromEntries(values.entries());
    payload.consent = values.get("consent") === "on";
    payload.startedAt = startedAt;
    payload.turnstileToken = token;
    const resetChallenge = () => {
      token = "";
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    };
    try {
      const reply = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await reply.json().catch(() => ({}));
      if (!reply.ok || !result.ok) throw new Error(result.error || "Your enquiry could not be sent. Please email me directly.");
      setStatus("Enquiry received. Thank you — I'll reply by email.", "success");
      track("enquiry_success");
      form.reset();
      startedAt = Date.now();
    } catch (error) {
      setStatus(error.message || "Could not send. Please use email.", "error");
    } finally {
      resetChallenge();
    }
  });
})();
