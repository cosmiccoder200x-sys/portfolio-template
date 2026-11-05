# Sreerang P — Immersive Portfolio

A dark, editorial portfolio built to showcase software projects, engineering interests, and experiments in AI and data. It combines a lightweight static frontend with a scroll-driven 3D experience and an optional AI portfolio assistant.

![Portfolio preview](assets/preview.png)

> **This repository contains the source code for my personal portfolio.** You can explore the implementation, learn from it, or adapt it as a starting point for your own portfolio.

## Explore

- **Portfolio:** [itsme.cosmiccoder200x.workers.dev](https://itsme.cosmiccoder200x.workers.dev)
- **GitHub:** [@cosmiccoder200x-sys](https://github.com/cosmiccoder200x-sys)
- **LinkedIn:** [Sreerang P](https://in.linkedin.com/in/sreerang-p)

## Highlights

- **Immersive 3D experience** — a Three.js scene responds to page scroll and portfolio chapters.
- **Motion-led interface** — GSAP, ScrollTrigger, Rive, and CSS transitions create the visual details and interactions.
- **Data-driven content** — profile, education, skills, projects, and links are maintained in `profile.json`.
- **Project showcase** — custom visuals and descriptions highlight selected software and AI projects.
- **AI portfolio assistant** — a Cloudflare Worker endpoint connects the assistant to Groq, with optional web search.
- **Responsive and accessible foundations** — semantic HTML, keyboard-friendly navigation, image descriptions, and reduced-motion support.
- **GitHub traffic dashboard** — an optional dashboard at `/analytics/` displays collected repository traffic history.

## Built with

| Area | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| 3D and motion | Three.js, GSAP, ScrollTrigger, Rive |
| AI assistant | Cloudflare Workers, Groq API |
| Analytics | Python, GitHub REST API, GitHub Actions |
| Quality checks | Node.js, dependency-free custom QA script |
| Deployment | Cloudflare Workers Builds, GitHub Pages |

## Run locally

The portfolio frontend is static and does not need a package installation.

1. Clone the repository:

   ```bash
   git clone https://github.com/cosmiccoder200x-sys/portfolio-template.git
   cd portfolio-template
   ```

2. Start a local web server from the repository root:

   ```bash
   python -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000).

Use a local server instead of opening `index.html` directly so browser requests for `profile.json` and other local assets work correctly.

## Personalise the portfolio

Most portfolio content is stored in `profile.json`. Update the relevant fields to customise:

- Name, tagline, and biography
- Education and certifications
- Skills and project descriptions
- Project repository and demo links
- Social and contact links

Keep the JSON valid after editing. The visual structure and interactions live mainly in `index.html`, `style.css`, `script.js`, `immersive.css`, and `immersive.js`.

## AI assistant setup

The assistant API runs through the Cloudflare Worker configured in `wrangler.jsonc`.

1. Create a Groq API key.
2. Add it as a Worker secret named `GROQ_API_KEY` in the Cloudflare dashboard, or configure it locally for Wrangler development.
3. Deploy the Worker using the connected Cloudflare Workers Builds integration, or run:

   ```bash
   npx wrangler deploy
   ```

Never put API keys in `profile.json`, frontend JavaScript, or committed files. The Worker reads the key from its environment and applies request validation and rate limiting.

## Deployment and checks

- **Cloudflare Workers:** the repository's `wrangler.jsonc` defines the Worker entry point, static assets, and API routing. The configured Cloudflare production branch is `feature/immersive-3d-portfolio`.
- **GitHub Pages preview:** the `Deploy feature portfolio to GitHub Pages` workflow deploys this feature branch when it receives a push.
- **Portfolio QA:** the `Portfolio QA` workflow runs static checks on pushes and pull requests.

Run the same QA check locally with Node.js 20 or newer:

```bash
node scripts/portfolio_qa.mjs
```

## GitHub traffic dashboard (optional)

The `analytics/` directory contains a dashboard and historical data collector. To enable collection, configure the `GH_TRAFFIC_STATS_TOKEN` repository secret with the read-only repository permissions described in [analytics/README.md](analytics/README.md). The collector runs on a schedule and can also be started manually from GitHub Actions.

## Project structure

```text
.
├── index.html              # Portfolio page
├── profile.json            # Editable portfolio content
├── style.css               # Main visual system
├── script.js               # Interface interactions
├── immersive.css           # 3D experience styling
├── immersive.js            # Three.js scene
├── assistant.js            # Portfolio assistant interface
├── functions/api/chat.js   # AI assistant API handler
├── worker/index.js         # Cloudflare Worker entry point
├── wrangler.jsonc          # Worker and asset configuration
├── assets/                 # Images, icons, and Rive assets
├── analytics/              # Traffic dashboard and history
├── scripts/                # QA and analytics scripts
└── .github/workflows/      # CI, Pages deployment, analytics
```

## Contributing and feedback

Found a bug, accessibility issue, or improvement? Open an issue with steps to reproduce it and, where possible, a screenshot or browser details. Focused pull requests are welcome.

For substantial visual or behavioural changes, please explain the motivation and test the portfolio at both desktop and mobile widths. Avoid committing credentials, personal tokens, generated build output, or unrelated personal data.

## License

No license file is currently included. Unless a license is added, the source is publicly visible but reuse and redistribution are not automatically granted. Please open an issue if you would like to discuss licensing.

---

Built and iterated on by **[Sreerang P](https://github.com/cosmiccoder200x-sys)**.
