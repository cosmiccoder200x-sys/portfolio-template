# Monetization implementation status — 23 November 2026

## Preview branch

- Repo: `cosmiccoder200x-sys/portfolio-template`
- Branch: `feat/portfolio-hire-and-templates`, draft PR #26
- Cloudflare Pages production branch: `feature/immersive-3d-portfolio` (unchanged)
- Stable preview alias: `https://feat-portfolio-hire-and-temp.sreerang.pages.dev`
- Store previews: `/templates/terminal-starter/`, `/templates/editorial-atelier/`, `/templates/launchpad-saas/`
- Existing 3D portfolio, contact Google Form, and AI chatbot kept intact.

## Provisioned in Cloudflare (preview only)

1. Cloudflare Turnstile widget `Sreerang Portfolio Enquiries` created for `sreerang.pages.dev` (subdomain previews included). Public site key `0x4AAAAAAGOkb1FD0bAwMhcB` is committed in `monetization.config.js`; secret is **Cloudflare-only**, in Pages preview env.
2. D1 database `sreerang-portfolio-leads-preview` was created and migration `0001_enquiries_and_events.sql` was applied. Bound to Pages **preview** as `LEADS_DB`. The production project has not been altered.
3. Cloudflare Web Analytics site `sreerang.pages.dev` created with public analytics tag `2444b00e8b2b4f3382e2c1c56718e06e`. The pageview beacon is added only to portfolio, hire and template collection pages, only when hostname is **exactly** `sreerang.pages.dev`; it is off on previews and respects DNT/GPC.
4. `POST /api/event` stores aggregate daily event counts in D1 without visitor identifiers.

## Still requires external account configuration

- **Notifications:** Project enquiries can be saved in preview D1. Email notifications need a verified sender and provider. This Cloudflare account currently has no DNS zones, so native Email Service sender-domain onboarding isn't available. Recommended path: verify an owned domain with your chosen email provider, then set `RESEND_API_KEY`, `LEAD_FROM_EMAIL`, and `LEAD_TO_EMAIL`. Until configured, check D1 via Cloudflare dashboard.
- **Private dashboard login:** To access `/insights/` set a long random `ADMIN_METRICS_TOKEN` secret in Pages preview env. Do not commit it. This key is intentionally not in the repository.
- **Checkout:** Product source bundles, terms/license and automated payment-confirmed fulfillment are not yet configured. The collection has no live payment buttons. Configure a legitimate Gumroad, Razorpay or other provider checkout only when source files and support policy are finalized.
- **Production activation:** Keep draft PR unmerged until walkthrough/testing is complete. Configure production bindings/secrets during approved production rollout; do not point production to the preview leads database by accident.

## Automated and manual verification

```bash
node scripts/portfolio_qa.mjs
node --test scripts/monetization.test.mjs
```

- CI tests cover input validation, honeypot timing, same-origin policy, Turnstile rejection, D1 persistence, email delivery fallback, dashboard token rejection, event whitelist, and presence of exactly three demos.
- Cloudflare has reported successful preview deployments; this is not a substitute for an authenticated real browser Turnstile submission.
- Manual remaining checks: complete Turnstile with a human browser; send a synthetic enquiry; confirm it appears in D1; test any sender after verification; verify responsive layout; test checkout in provider sandbox before production.

## Visitor and conversion funnel

- **Visitors and pageviews:** Cloudflare Web Analytics dashboard (available once public script is deployed).
- **Hire visits and CTA clicks:** D1 `event_counts`.
- **Enquiries:** D1 `enquiries`.
- **Paid purchases:** No tracking yet because there is no live checkout. Never derive purchases from click events alone.
