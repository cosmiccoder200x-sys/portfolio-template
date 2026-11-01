# Portfolio Architecture & Animation System Guidelines

## 1. Project Overview & Architecture
This project is a high-performance, single-page portfolio built for **Sreerang P** (Software Developer, AI Builder, Forward-Deployed Engineer). It operates on a static stack designed for speed, high visual polish, and zero hydration delay:
- **Markup**: Semantic HTML5 (`index.html`)
- **Styles**: Modern CSS3 (`style.css`) with custom properties, CSS Grid/Flexbox, and GPU-accelerated transforms
- **Scripting**: Native ES6+ JavaScript (`script.js`) with progressive data enrichment via `profile.json`
- **Interactive Motion**: Native Rive WebGL2 runtime (`@rive-app/webgl2`) loading `assets/rive/hero-orb.riv`, paired with CSS transitions/keyframes and IntersectionObserver scroll triggers.

## 2. Visual & Design Language
- **Palette**: Dark monochrome — Background `#090909`, Surface `#111111`, High-contrast Text `#EDEDED`, Muted `#A3A3A3`, Dim accents `#707070`, Thin geometric borders `rgba(255, 255, 255, 0.15)`.
- **Typography**: Dual font hierarchy:
  - Sans-serif: `Manrope` for editorial display headlines and body copy
  - Monospace: `DM Mono` for index tags, kicking labels, metadata, and timestamps
- **Grid & Framing**: Fixed inset frame (`.page-frame`) and structured grid lines giving an architectural, brutalist-editorial aesthetic.

## 3. Motion & Animation Foundation Rules
1. **GPU Acceleration**: Animate exclusively `transform` and `opacity` properties to guarantee 60fps/120fps smooth compositing without triggering layout recalculations or paint thrashing.
2. **Timing Curves**:
   - Primary Ease: `cubic-bezier(0.16, 1, 0.3, 1)` (Apple/Vercel standard deceleration curve)
   - Accent Ease: `cubic-bezier(0.2, 0.75, 0.25, 1)`
   - Durations: Standard UI interactions `200ms–350ms`; Entrance reveals `600ms–900ms`; Ambient cycles `3s–6s`.
3. **Accessibility**: Strictly honor `prefers-reduced-motion: reduce`:
   - Instantly display content without transform deltas
   - Disable ambient loops, cursor tracking, and continuous rotations
4. **Single IntersectionObserver Registry**: Prevent duplicate observer allocations by sharing a unified observer that manages reveal classes and section highlighting.
5. **No Layout Shift**: All interactive hover transforms (card lift, link nudges) must use transforms or box-shadows rather than padding or margin modifications.

## 4. Section Implementation Decisions
- **Hero**:
  - Name reveal with smooth upward trajectory and subtle character cadence.
  - Dynamic rotating role transition (`Software Developer` · `AI Builder` · `Forward-Deployed Engineer`).
  - Interactive "SP" monochrome identity orb positioned in the top-right quadrant matching the closing section visual:
    - Central bold "SP" typography in heavy sans-serif.
    - Outer specular silver gradient rim with high-contrast reflection.
    - Deep dark inner plate for maximum optical contrast.
    - Concentric dashed orbital rings with counter-rotating cycles and satellite dots.
    - Convergence dashed crosshair axis lines.
    - Ambient radial glow.
    - Interactive 3D spatial gimbal deflection and perspective tilt (`perspective(900px) rotateY/rotateX`).
    - Direct pointer drag interaction with harmonic spring physics (`spring: 0.14`, `damping: 0.76`).
    - Passive cursor tracking across the hero section.
  - Subtle architectural dot/grid background canvas and optional mouse spotlight on desktop.
- **About**:
  - Two-column editorial layout: Left column features the bold section heading; Right column contains the narrative bio and links.
- **Skills**:
  - Constellation network visual (`skills-visual.svg`) displaying 6 core interconnected domains (Python, C++, DSA, AI, Data Science, Web Platform) with live topology telemetry.
  - Detailed 24-skill pill grid with hover translation and arrow micro-interactions.
- **Projects**:
  - 5 dedicated technical SVG mockups with bespoke schematics:
    - `modulr.svg`: Adaptive exam platform, topic syllabus graph, mastery retention metrics.
    - `local-brain-mcp.svg`: Local SQLite vector store, MCP JSON-RPC protocol panel, embedding projection.
    - `focusflow.svg`: Pomodoro timer dial, distraction shielding histogram, session telemetry.
    - `e-learning.svg`: Course schedule timeline, relational database schema matrix, grading pipeline.
    - `gullylabs.svg`: Storefront transaction pipeline, coupon logic, inventory state machine.
  - Interactive card lift, 3D desktop micro-tilt, and animated arrow links.
- **Contact**:
  - `Have an idea? Let's build it.` oversized typography.
  - Closing SP identity visual (`contact-visual.svg`) matching the hero orb.
  - Fully functional asynchronous contact form submitted to Google Forms with instant validation and status feedback.
- **Experience / Education / Certifications**:
  - Timeline styling with animated vertical line drawn on scroll, distinct achievement markers.
- **Contact & Footer**:
  - Editorial "Let's talk" heading, interactive inputs with border focus glow, animated send button with state feedback, preserved Google Forms iframe handler.
- **Global & Nav**:
  - Scroll progress bar at top, active section indicator in navigation, smooth keyboard navigation.
