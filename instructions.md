# Sreerang P's Portfolio — Engineering Notes

This document records the architecture, visual language, interaction principles, and implementation decisions for my personal portfolio. It is a project-specific engineering reference, not a generic portfolio-building guide.

## 1. Project architecture

The portfolio is a static-first, single-page experience designed for fast initial rendering and progressive enhancement.

- **Markup:** semantic HTML5 in `index.html`.
- **Styles:** CSS custom properties, Grid/Flexbox, and transform-based animation in `style.css` and `immersive.css`.
- **Content:** public portfolio information and assistant context in `profile.json`.
- **Interactions:** native JavaScript in `script.js` and `immersive.js`.
- **3D and motion:** Three.js, GSAP/ScrollTrigger, and Rive assets.
- **Assistant:** browser UI in `assistant.js`, server-side API handler in `functions/api/chat.js`, and Cloudflare Worker routing in `worker/index.js`.

## 2. Visual direction

- **Palette:** dark monochrome — background `#090909`, surface `#111111`, high-contrast text `#EDEDED`, muted text `#A3A3A3`, and restrained borders.
- **Typography:** Manrope for display and body text; DM Mono for labels, indices, metadata, and technical details.
- **Composition:** inset page frame, structured grid lines, editorial typography, and carefully controlled negative space.
- **Identity:** the SP orb and related visual elements establish a consistent visual motif across the hero and closing sections.

## 3. Motion and accessibility principles

1. Prefer `transform` and `opacity` for animation to reduce layout and paint work.
2. Use the established easing curves and restrained durations defined in the stylesheets.
3. Respect `prefers-reduced-motion: reduce`: remove nonessential movement, ambient loops, cursor tracking, and continuous rotations.
4. Avoid layout shifts during hover and focus interactions.
5. Keep navigation and interactive controls usable with a keyboard.

## 4. Portfolio sections and custom visuals

- **Hero:** animated name and role presentation, SP identity orb, grid/spotlight treatment, and pointer-responsive motion.
- **About:** editorial biography layout and links.
- **Skills:** visual skills constellation and grouped technical skills.
- **Projects:** bespoke SVG visuals and project descriptions for the selected work in `profile.json`.
- **Experience and education:** timeline presentation with scroll-linked progress.
- **Contact:** closing statement, SP visual, and contact form interaction.

## 5. Assistant design

- Treat `profile.json` as the source of public portfolio facts.
- Keep the Groq API key on the server as the `GROQ_API_KEY` Worker secret.
- Validate requests and apply rate limiting in the API handler.
- Do not invent personal details, project outcomes, employment, awards, or proficiency claims.
- If a fact is not present in the profile, the assistant should say it is not specified.

## 6. Performance and maintenance

- Lazy-load or defer noncritical visual assets where practical.
- Keep the static frontend independent from the AI endpoint so the portfolio remains useful if the assistant is unavailable.
- Test desktop and mobile layouts after changes.
- Test keyboard navigation and reduced-motion behaviour.
- Run `node scripts/portfolio_qa.mjs` before pushing changes.
- Never commit secrets, local environment files, generated caches, or unrelated personal data.

## 7. Deployment

The production Worker and static assets are configured in `wrangler.jsonc`. GitHub Actions also runs portfolio QA and publishes a GitHub Pages preview from the feature branch. The separate analytics workflow collects repository-level traffic data.

For assistant-specific configuration, see [AI_ASSISTANT_SETUP.md](AI_ASSISTANT_SETUP.md). For analytics operations, see [analytics/README.md](analytics/README.md).
