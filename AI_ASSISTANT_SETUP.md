# AI Portfolio Assistant — Setup

The portfolio remains a static HTML/CSS/JavaScript site. The AI endpoint is a Cloudflare Pages Function at \`/api/chat\`.

## Architecture
- \`assistant.js\`: floating monochrome chat interface and browser-side conversation state.
- \`functions/api/chat.js\`: server-side Gemini API proxy, profile grounding, optional Google Search grounding, validation and best-effort per-isolate request limiting.
- \`profile.json\`: authoritative public portfolio facts used by the assistant through the Pages static-assets binding.

## Configure the Gemini secret
1. Open Cloudflare Dashboard → Workers & Pages → your Pages project (the project serving \`sreerang.pages.dev\`).
2. Open Settings → Variables and Secrets.
3. Add a secret named \`GEMINI_API_KEY\`.
4. Paste your key from Google AI Studio and save it as an encrypted secret.
5. Redeploy the Pages project so the Function receives the secret.

Never put the key in \`index.html\`, \`assistant.js\`, \`profile.json\`, or any committed file.

## Local development
1. Install Node.js if it is not installed.
2. From the repository root, run \`npm install --save-dev wrangler\` (this creates local package files).
3. Create a \`.dev.vars\` file in the repository root:
   \`\`\`dotenv
   GEMINI_API_KEY="your-real-key"
   \`\`\`
4. Run \`npx wrangler pages dev .\`.
5. Open the local URL printed by Wrangler and test the floating assistant.
6. Do not commit \`.dev.vars\`; it is ignored by \`.gitignore\`.

## Behaviour
- Live web search is enabled by default. Gemini decides whether a Google Search is useful for the current question.
- Turning off Live Web Search omits the Google Search tool from the request.
- Search citations returned by Gemini are displayed as source links.
- Portfolio answers are grounded in \`profile.json\`. Missing personal facts should be described as unavailable rather than guessed.
- Chat history is held only in the browser tab and is not saved to a database.

## Before production
- Add a Cloudflare rate-limiting rule for \`/api/chat\`; the in-memory safeguard in the Function is best-effort and isolate-local.
- Review Gemini API quotas and Google Search grounding pricing.
- Test on both desktop and mobile, and confirm the API key is not present in browser network payloads or source files.
