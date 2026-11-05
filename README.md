# Sreerang P — Personal Portfolio

![Portfolio preview](assets/preview.png)

**Live site:** [itsme.cosmiccoder200x.workers.dev](https://itsme.cosmiccoder200x.workers.dev)  
**Owner:** [Sreerang P](https://github.com/cosmiccoder200x-sys) · [LinkedIn](https://in.linkedin.com/in/sreerang-p)

This repository contains the source code for my personal portfolio: a dark, editorial experience built to present my work in software engineering, data, and AI. It brings together a custom visual system, scroll-driven 3D interactions, project case studies, and an AI assistant grounded in my public profile.

This is my portfolio implementation and its supporting infrastructure—not a generic portfolio starter or a reusable template.

## What I built

- **Immersive 3D experience** — a Three.js scene tied to the page's scroll-driven narrative.
- **Motion and interaction system** — GSAP, ScrollTrigger, Rive, and custom CSS/JavaScript interactions.
- **Personal project showcase** — selected projects, technical interests, education, skills, and links presented through a bespoke interface.
- **Profile-grounded AI assistant** — a Cloudflare Worker endpoint connects the chat interface to Groq without exposing the API key in the browser.
- **Responsive interface** — layouts and interactions designed to work across desktop and mobile, with reduced-motion considerations.
- **GitHub traffic analytics** — a separate dashboard and scheduled collector for repository-level traffic history.

## Technology

| Area | Stack |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| 3D and motion | Three.js, GSAP, ScrollTrigger, Rive |
| AI assistant | Cloudflare Workers, Groq API |
| Analytics | Python, GitHub REST API, GitHub Actions |
| Responsive layer | Dedicated `mobile.css` for phone, tablet, and landscape layouts |
| Quality checks | Node.js, custom QA script |
| Hosting | Cloudflare Workers, GitHub Pages preview |

## Repository walkthrough

```text
.
├── index.html              # Portfolio page
├── profile.json            # My public portfolio content and assistant context
├── style.css               # Main visual system
├── script.js               # Core interface interactions
├── immersive.css           # Immersive experience styling
├── mobile.css              # Mobile and tablet responsive layer
├── immersive.js            # Three.js scene and scroll interactions
├── assistant.js            # AI assistant interface
├── functions/api/chat.js   # Server-side assistant endpoint
├── worker/index.js         # Cloudflare Worker entry point
├── wrangler.jsonc          # Worker and static asset configuration
├── assets/                 # Portfolio visuals, icons, and Rive assets
├── analytics/              # GitHub traffic dashboard and data
├── scripts/                # QA and analytics scripts
└── .github/workflows/      # Quality checks, deployment, and analytics
```

## Run the portfolio locally

The frontend is static. From the repository root:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

Use a local server rather than opening `index.html` directly so the browser can load `profile.json` and local assets correctly.

## AI assistant

The assistant's browser interface lives in `assistant.js`. Its API handler runs server-side through the Cloudflare Worker and reads the `GROQ_API_KEY` secret from the Worker environment.

For the deployment and local development steps, see [AI_ASSISTANT_SETUP.md](AI_ASSISTANT_SETUP.md).

**Security:** never commit API keys or place them in `profile.json`, HTML, or browser-side JavaScript.

## Deployment and quality checks

- **Production portfolio:** served through the Cloudflare Worker configured by `wrangler.jsonc`. Commits to the connected deployment branch can trigger the configured Cloudflare build; even documentation-only commits update the deployment revision.

- **GitHub Pages preview:** the `Deploy feature portfolio to GitHub Pages` workflow publishes the feature branch.
- **Automated checks:** the `Portfolio QA` workflow runs the static portfolio checks, including responsive-layer regression checks.

Run the QA script locally with Node.js 20 or newer:

```bash
node scripts/portfolio_qa.mjs
```

## GitHub traffic dashboard

The analytics dashboard is available at [`/analytics/`](https://itsme.cosmiccoder200x.workers.dev/analytics/). Its collector uses the GitHub REST API and a repository secret named `GH_TRAFFIC_STATS_TOKEN`.

See [analytics/README.md](analytics/README.md) for the collector's data scope, permissions, and operational details.

## Project notes

- [`instructions.md`](instructions.md) documents the design system, architecture, and implementation constraints behind this portfolio.
- [`AI_ASSISTANT_SETUP.md`](AI_ASSISTANT_SETUP.md) documents the assistant's deployment and configuration.
- The `showcase/` directory is retained as historical community material from the repository's earlier FOSS Cell context; it is not part of my personal portfolio content.

## Attribution and license

The existing [MIT license](LICENSE) is preserved with its original copyright attribution to **FOSS Cell TKMCE**. That attribution is intentionally not changed here. Portfolio-specific content and identity are maintained in this repository by Sreerang P; third-party and pre-existing contributions retain their applicable attribution and license terms.

---

Built, designed, and continuously iterated on by **[Sreerang P](https://github.com/cosmiccoder200x-sys)**.
