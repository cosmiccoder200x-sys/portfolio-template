# Portfolio monetization: installation and release checklist

This feature was implemented on a review branch. **Do not merge or deploy until the form, email sender and payment flow are configured and verified.**

## What is included

- `/hire/`: responsive pricing, examples and real enquiry UI
- `/templates/`: premium three-design collection with standalone responsive demos at `/templates/terminal-starter/`, `/templates/editorial-atelier/` and `/templates/launchpad-saas/`
- `/insights/`: private aggregate analytics with a secret-token gate
- `/leads/`: private client inbox with unread, seen, replied and closed statuses, secure API and overdue indicators. See [`LEAD_INBOX_SETUP.md`](LEAD_INBOX_SETUP.md).
- Optional instant Telegram/email notifications and opt-in GitHub Actions daily overdue reminders. The required private credentials are not committed.
- `POST /api/enquiry`: validates and verifies Turnstile; writes to D1 and/or sends via Resend
- `POST /api/event`: optional D1 aggregate event counts, no IP/cookies or names saved
- `GET /api/admin-metrics`: requires `ADMIN_METRICS_TOKEN`, returns no lead content
- Current Google Forms contact form remains in place as a fallback. Current 3D animation and assistant are unchanged.

## 1. Cloudflare Turnstile (required for new project enquiries)

1. Create a Turnstile widget in Cloudflare for your actual production domain(s).
2. Put the **public site key** in `monetization.config.js` as `turnstileSiteKey`.
3. Save the **private secret key** as a Cloudflare Worker / Pages secret named `TURNSTILE_SECRET_KEY`. Never put it in GitHub, HTML, or browser JavaScript.
4. Verify both the main domain and preview domain are allowed if you need to test previews. The backend checks the hostname reported by Turnstile against the request host.
5. Without these settings, `/hire/` shows the safe mailto fallback and disables form submission.

## 2. Enquiry delivery (choose one, preferably both)

**Email route (Resend):** verify a sending domain with Resend and set these Worker secrets/vars:

- `RESEND_API_KEY`: secret, Resend token with permission to send
- `LEAD_FROM_EMAIL`: verified sender address (do not spoof Gmail)
- `LEAD_TO_EMAIL`: your receiving inbox address

**D1 route (private lead storage + anonymous conversion counts):**

1. Create a D1 database called `portfolio-leads` in your Cloudflare account.
2. Add a D1 binding called `LEADS_DB` to the correct **Worker** and, if applicable, the **Pages project**. In `wrangler.jsonc`, a Worker binding looks like:
   ```json
   "d1_databases": [
     {"binding":"LEADS_DB","database_name":"portfolio-leads","database_id":"<YOUR_REAL_D1_DATABASE_ID>"}
   ]
   ```
   Put this as a top-level property and replace the placeholder with the actual database ID.
3. Apply `migrations/0001_enquiries_and_events.sql` to the created database before enabling the API:
   ```bash
   npx wrangler d1 execute portfolio-leads --remote --file=migrations/0001_enquiries_and_events.sql
   ```
4. Protect D1 admin access. Enquiry records contain personal information. Set a retention policy and delete stale records; do not expose database content to public endpoints.
5. Only aggregate event names and daily totals are recorded by `/api/event`; it does **not** measure unique visitors or purchases.

**Rate limiting:** optionally create Cloudflare rate-limit bindings named `ENQUIRY_LIMITER` and `EVENT_LIMITER`. Use realistic low thresholds for this portfolio. Cloudflare rate limits are approximate per location; Turnstile is still required. A rate limit binding is not automatically created on this branch.

No delivery method configured means `/api/enquiry` fails closed with HTTP 503. Email and D1 failures are returned as errors unless one delivery path succeeds; never claim a message was received without confirmation.

## 3. Private analytics

Set the secret `ADMIN_METRICS_TOKEN` to a long random access token in the Worker / Pages project environment. Visit `/insights/` and enter the token. The browser does not persist it. The protected API returns daily counters and enquiry-status totals only, not names, email addresses or messages.

`DNT: 1` / Global Privacy Control users are excluded from client-side event tracking. Counts are best-effort and can be affected by bot activity; do not label them verified unique visitors.

## 4. Template payments

`monetization.config.js` has an intentionally empty `checkoutUrl`. The store only displays a **Purchase template** button after you supply a real HTTPS payment checkout URL for a configured product. Do not invent a checkout URL or claim the paid source bundle is available.

Before selling a code package:
- Test source files separately from the public preview.
- Include setup guide, changelog, license and clear commercial usage rights.
- Verify third-party license attribution. The existing portfolio repository retains its upstream MIT license and contributions.
- Configure paid-file delivery, email receipts and refund/support policy with your chosen provider.

## 5. Run checks and publish safely

```bash
node scripts/portfolio_qa.mjs
node --test scripts/monetization.test.mjs
```

Test manually on a nonproduction preview: mobile nav and 3D animations unchanged; Google Forms contact still works; missing/expired Turnstile fails; same-origin check; invalid form input fails; valid enquiry arrives through configured provider; email failures are visible; D1 aggregate counters change; admin rejects bad tokens; checkout does not appear until configured.

Before merging, verify which branch deploys to your Cloudflare production (it may not match GitHub Pages) and confirm the deployment has the required secret bindings. Publishing the draft branch alone is **not** the same as turning on production.

## 6. Launch

See `MONETIZATION_LAUNCH_COPY.md` for posts ready for review, not automatically published. Announce only after an end-to-end test with real delivery, working checkout, and pricing approval.
