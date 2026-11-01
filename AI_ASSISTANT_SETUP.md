# AI Portfolio Assistant — Setup

The portfolio remains a static HTML/CSS/JavaScript site. The AI endpoint is a Cloudflare Worker at \`/api/chat\`.

## Architecture
- \`assistant.js\`: floating monochrome chat interface and browser-side conversation state.
- \`functions/api/chat.js\`: server-side Groq API proxy, complete profile grounding, optional Groq web search, validation and best-effort per-isolate request limiting.
- \`profile.json\`: authoritative public portfolio facts used by the assistant through the Pages static-assets binding.

## Configure the Groq secret
1. Open Cloudflare Dashboard → Workers & Pages → the \`itsme\` Worker (the project serving \`sreerang.pages.dev\`).
2. Open Settings → Variables and Secrets.
3. Add a secret named \`GROQ_API_KEY\`.
4. Paste your key from Groq and save it as an encrypted secret.
5. Redeploy the Worker so it receives the secret.

Optional variables:
- \`GROQ_MODEL\` overrides the normal response model.
- \`GROQ_SEARCH_MODEL\` overrides the web-search model; it defaults to Groq's \`compound\` model.

Never put the key in \`index.html\`, \`assistant.js\`, \`profile.json\`, or any committed file.

## Local development
1. Install Node.js if it is not installed.
2. From the repository root, run \`npm install --save-dev wrangler\` (this creates local package files).
3. Create a \`.dev.vars\` file in the repository root:
   \`\`\`dotenv
   GROQ_API_KEY="your-real-key"
   \`\`\`
4. Run \`npx wrangler dev --config wrangler.jsonc\`.
5. Open the local URL printed by Wrangler and test the floating assistant.
6. Do not commit \`.dev.vars\`; it is ignored by \`.gitignore\`.

## Behaviour
- Live web search is opt-in. When enabled, Groq's Compound model can use web search and return citations.
- Turning off Live Web Search uses the configured normal Groq model.
- Portfolio answers use the complete \`profile.json\`, including \`assistant_context\`. Missing personal facts are described as unavailable rather than guessed.
- Answers are concise by default: normally 1–3 sentences and approximately 30–70 words.
- Chat history is held only in the browser tab and is not saved to a database.

## Before production
- Add a Cloudflare rate-limiting rule for \`/api/chat\`; the in-memory safeguard in the Function is best-effort and isolate-local.
- Review Groq API quotas and Compound web-search availability.
- Test on both desktop and mobile, and confirm the API key is not present in browser network payloads or source files.
