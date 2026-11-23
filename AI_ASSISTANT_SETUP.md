# Portfolio AI Assistant — Cloudflare Pages setup

The main portfolio is served by Cloudflare Pages project `sreerang`. The floating AI assistant calls `POST /api/chat` from `assistant.js`; API keys are used **only on the server** in `functions/api/chat.js`.

## Provider priority

1. If `GROQ_API_KEY` is configured, try Groq first (`GROQ_MODEL` / `GROQ_SEARCH_MODEL` may override default models).
2. If Groq is unavailable or fails and `GEMINI_API_KEY` is configured, use Gemini.
3. If only `GEMINI_API_KEY` is configured, use Gemini directly. Default: `gemini-3.5-flash-lite`. Optionally set `GEMINI_MODEL` to another currently supported model ID.
4. If neither works, return a generic HTTP 503 without sending credentials or provider error bodies to the browser.

The assistant uses `profile.json` for grounded facts, limits input length and recent conversation history, and responds concisely. Live web search is **off by default** and only requested when visitors enable it; Gemini uses Google Search grounding for this mode and Groq uses Compound. Provider-grounded URLs are checked before displaying.

## Production setup (Cloudflare Pages)

1. Go to **Cloudflare → Workers & Pages → sreerang → Settings → Variables and Secrets → Production**.
2. Add at least one encrypted secret:
   - `GEMINI_API_KEY` — Google AI Developer API key, or
   - `GROQ_API_KEY` — Groq API key.
3. Optional plaintext model overrides: `GEMINI_MODEL`, `GROQ_MODEL`, `GROQ_SEARCH_MODEL`.
4. Deploy a fresh production build after changing secrets.
5. Open the homepage in an incognito browser, click **ASK AI**, ask “What projects have you built?”, and confirm a normal short answer. Turn web search on only for a separate search test.

**Current state (23 November 2026):** Production has a Gemini API key configured, but no Groq key. This fix adds the missing Gemini backend path. The actual key validity, API quota and final response need a live test after the fix PR is approved and merged.

Preview and Production secrets are isolated; a Production API key is **not** automatically available to Preview. Do not paste keys into GitHub, frontend files, chat messages, URLs or screenshots. For the standalone Worker deployment, define secrets separately in that Worker's settings if it is actually used.

## Developer checks

```bash
node scripts/portfolio_qa.mjs
node --test scripts/monetization.test.mjs
node --test scripts/assistant.test.mjs
```

These tests use fake provider responses and deliberately **never contact Groq or Gemini**. Passing tests verify fallback and input handling, not live API key validity.

## Operational controls

- Apply Cloudflare rate limiting to `/api/chat` for production use; current per-isolate memory rate limiting is only best-effort.
- Monitor provider quotas and 429/503 responses. Avoid exposing upstream error payloads or secrets.
- Keep `profile.json` current. If all providers are unavailable, use the portfolio contact link as a fallback.
- Desktop/mobile accessibility and real provider responses must be verified during production acceptance testing.
