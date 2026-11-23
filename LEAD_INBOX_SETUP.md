# Client enquiry inbox and notification setup

The new Hire Me enquiry tracker is implemented on draft PR #26. **It is NOT on the public production site until the PR is reviewed and merged.**

## Immediate answer: where do messages go?

**Existing main portfolio Contact form:** It submits to Google Forms (separate from the new Hire Me form). As the form owner, open the linked Google Form, choose **Responses → ⋮ → Get email notifications for new responses**. Optionally click the green Sheets icon under Responses to create a response spreadsheet. These original responses do **not** enter the D1 lead inbox automatically.

**New Hire Me form (preview branch):** Successful enquiries are stored in Cloudflare's D1 database under the `enquiries` table (binding `LEADS_DB`). They start with `status = 'new'`.

**Private inbox:** Preview URL: https://feat-portfolio-hire-and-temp.sreerang.pages.dev/leads/ . After configuring the access token, you can see contact details, project budget and description, and change each lead's status:
- `New`: you have not read it yet.
- `Seen`: you have read it but still need to respond.
- `Replied`: you have answered via email.
- `Closed`: completed, declined, or no further action.

Enquiries older than 24 hours and still `New` or `Seen` are marked as overdue. **The dashboard does not mark a lead as read just because you open the page.** There is a Reply by email link for each lead. The dashboard never stores your access token in localStorage, sessionStorage or cookies.

## One-time Cloudflare setup: private inbox

The preview D1 database `sreerang-portfolio-leads-preview` is already created and bound on the Pages **preview** environment as `LEADS_DB`. Migration 0001 and 0002 have already been applied there.

1. Cloudflare Dashboard → Workers & Pages → `sreerang` → Settings → Variables and Secrets → **Preview**.
2. Add an encrypted secret called `ADMIN_METRICS_TOKEN` with a random 32+ character value. Do not paste or commit the token in source code. Make a secure copy for yourself.
3. Trigger a new preview build/deployment after changing secrets if required.
4. Open `/leads/`, type the token, and verify access. The same token authorizes `/insights/` and `/api/admin-metrics`.
5. For production, create separate production secrets and database bindings before merging. Never point the production site at the preview D1 database.

## Instant notification: choose Telegram (no custom domain needed) or email

**Option A — Telegram push (easiest when you don't own a verified mail-sending domain)**

1. In Telegram, open the verified `@BotFather` account, enter `/newbot`, and create your private notification bot.
2. Open a chat with your new bot and send `/start`.
3. Retrieve the bot chat ID through Telegram's official `getUpdates` API. Handle the bot token privately; it is a credential. Never paste the token into a public GitHub issue, browser screenshot or README.
4. In the same Cloudflare Pages environment, add **encrypted secrets** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Configure separately in Production after launch approval.
5. Submit a legitimate test enquiry through the preview and confirm a Telegram notification arrives. The push includes **project type and budget only**, with a link to the authenticated inbox; it does not include the customer's email or message body.

The Telegram integration is optional; a failed push will not reject a successfully stored enquiry. Use the private dashboard as your source of truth.

**Option B — email alerts**

Verify a sender domain with Resend, then set these Cloudflare environment secrets:
- `RESEND_API_KEY`
- `LEAD_FROM_EMAIL` (verified sender address)
- `LEAD_TO_EMAIL` (your inbox)

New enquiry emails are sent immediately after the form is submitted. Do not substitute an unverified `@gmail.com` From address. Email delivery has not been enabled or tested on the preview account.

## Daily reminder if you forget to respond

A secure `POST /api/lead-reminder` checks for **New/Seen enquiries older than 24 hours**. If any exist, it sends a *daily counts-only reminder* through the configured Telegram bot and/or verified email sender. It does not send clients' personal data. Successful sends are recorded in `lead_reminder_runs` to reduce duplicate daily alerts.

A GitHub Actions workflow is included at `.github/workflows/lead-reminder.yml`, scheduled for about **7:10 PM India time** (13:40 UTC). GitHub Actions scheduled runs can be delayed.

This workflow is **disabled by default**. Activate it only after production deployment is approved:

1. In Cloudflare Pages Production, set a long random `LEAD_REMINDER_TOKEN` encrypted secret, plus D1 and at least one notification provider.
2. In GitHub repository Settings → Secrets and variables → Actions, create repository **secret** `LEAD_REMINDER_TOKEN` with *the exact same value*.
3. Create repository **variable** `ENABLE_LEAD_REMINDERS=true`.
4. Leave `LEAD_REMINDER_SITE` unset to use `https://sreerang.pages.dev` or set it to the approved Pages preview hostname while testing.
5. Manually trigger the workflow once after creating a synthetic overdue lead and verify a single reminder arrives. A regular new lead younger than 24 hours does not trigger a daily overdue alert.

**Never enable it before the production endpoint and alert provider are configured.** Missing credentials lead to a failed-safe error, not a false success.

## Security and verification

All private endpoints use `Cache-Control: no-store`. Enquiry details are returned only after a Bearer token check; status updates also require same-origin requests, a valid UUID, and a whitelisted status. The UI displays server-provided text with `textContent`, not HTML.

Run:
```bash
node scripts/portfolio_qa.mjs
node --test scripts/monetization.test.mjs
```

Smoke test: invalid token refused, new enquiries appear, status changes persist, Reply email opens correctly, filtered counts work, Telegram/email alert arrives when configured, reminder only sends for >24h open leads, original Google Forms contact still works.

Privacy: Treat D1 as personal data storage. Enable security controls on your Cloudflare/GitHub accounts and delete stale enquiries under a reasonable retention policy.
