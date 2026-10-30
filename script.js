(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const safeURL = (value) => {
    try {
      const url = new URL(String(value), window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };
  const labelFor = (key) => key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function renderProfile(profile) {
    if (!profile || typeof profile !== "object") throw new Error("Profile data is missing.");
    const name = String(profile.name || "Sreerang P");
    document.title = name + " — AI Engineer & Full-Stack Developer";
    const bio = byId("bio");
    if (bio && profile.bio) bio.textContent = profile.bio;

    const skills = byId("skills");
    if (skills) {
      skills.replaceChildren();
      (Array.isArray(profile.skills) ? profile.skills : []).forEach((skill) => {
        const item = document.createElement("li");
        item.textContent = String(skill);
        skills.appendChild(item);
      });
    }

    const projects = byId("projects-grid");
    if (projects) {
      projects.replaceChildren();
      (Array.isArray(profile.projects) ? profile.projects : []).forEach((project, index) => {
        const card = document.createElement("article");
        card.className = "project-card reveal";
        const title = String(project.title || "Untitled project");
        const description = String(project.desc || "");
        const link = safeURL(project.link);
        const stack = Array.isArray(project.stack) ? project.stack.join(" · ") : String(project.stack || "Software project");
        card.innerHTML = `
          <div>
            <div class="project-top"><span class="project-type">${escapeHTML(project.type || "SELECTED PROJECT")}</span><span class="project-number">0${index + 1}</span></div>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(description)}</p>
          </div>
          <div class="project-bottom"><span class="project-stack">${escapeHTML(stack)}</span>${link ? `<a class="project-link" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">View project <span aria-hidden="true">↗</span></a>` : ""}</div>`;
        projects.appendChild(card);
      });
      if (!projects.children.length) {
        projects.innerHTML = '<p class="empty-project">Projects will appear here as they are added to the profile.</p>';
      }
    }

    const links = byId("links");
    if (links) {
      links.replaceChildren();
      Object.entries(profile.links || {}).forEach(([key, value]) => {
        const url = safeURL(value);
        if (!url) return;
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = labelFor(key);
        links.appendChild(anchor);
      });
    }

    const footer = byId("footer-year");
    if (footer) footer.textContent = "© " + new Date().getFullYear() + " " + name;
    setupReveal();
  }

  async function loadProfile() {
    try {
      const response = await fetch("profile.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Could not load profile.json (HTTP " + response.status + ").");
      renderProfile(await response.json());
    } catch (error) {
      console.error(error);
      const projects = byId("projects-grid");
      if (projects) projects.innerHTML = '<p class="empty-project">Profile data could not be loaded. Please refresh in a moment.</p>';
    }
  }

  function setupReveal() {
    const elements = document.querySelectorAll(".section-heading, .glass-card, .project-card, .skills-panel, .contact-panel");
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach((el) => { el.classList.add("reveal"); observer.observe(el); });
  }

  function setupMobileMenu() {
    const toggle = byId("menu-toggle");
    const nav = document.querySelector(".main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      toggle.textContent = open ? "×" : "☰";
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
      toggle.textContent = "☰";
    }));
  }

  function setupNeuralCanvas() {
    const canvas = byId("neural-canvas");
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = 0, height = 0, frame = 0, points = [], raf = 0;
    let pointer = { x: 0, y: 0, active: false };
    const palette = { cyan: [102, 242, 229], blue: [110, 139, 255], violet: [178, 139, 255] };
    const resize = () => {
      const rect = stage.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.7);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      points = [];
      const count = Math.max(58, Math.min(105, Math.floor(width * height / 2900)));
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const z = Math.random() * 2 - 1;
        const radius = Math.sqrt(1 - z * z);
        points.push({ x: Math.cos(theta) * radius, y: z, z: Math.sin(theta) * radius, phase: Math.random() * Math.PI * 2, size: .6 + Math.random() * 1.5 });
      }
    };
    const draw = () => {
      frame += reducedMotion ? 0.001 : 0.006;
      ctx.clearRect(0, 0, width, height);
      const cx = width * .51, cy = height * .49, radius = Math.min(width, height) * .31;
      const rot = frame * (reducedMotion ? .15 : .55);
      const projected = points.map((p) => {
        const x = p.x * Math.cos(rot) - p.z * Math.sin(rot);
        const z = p.x * Math.sin(rot) + p.z * Math.cos(rot);
        const tilt = p.y * Math.cos(.22) - z * Math.sin(.22);
        const depth = p.y * Math.sin(.22) + z * Math.cos(.22);
        const scale = 1 + depth * .12;
        return { x: cx + x * radius * scale + (pointer.active ? pointer.x * 8 : 0), y: cy + tilt * radius * scale + (pointer.active ? pointer.y * 6 : 0), depth, size: p.size, phase: p.phase };
      });
      const maxDist = Math.max(25, width * .105);
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i], b = projected[j], dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (.1 + (a.depth + b.depth + 2) * .055);
            ctx.strokeStyle = `rgba(102,242,229,${alpha})`;
            ctx.lineWidth = .55;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      projected.forEach((p, i) => {
        const glow = .5 + .5 * Math.sin(frame * 2 + p.phase);
        const alpha = .38 + (p.depth + 1) * .22;
        ctx.beginPath();
        ctx.fillStyle = i % 9 === 0 ? `rgba(178,139,255,${alpha})` : `rgba(102,242,229,${alpha})`;
        ctx.arc(p.x, p.y, p.size * (.7 + glow * .45), 0, Math.PI * 2);
        ctx.fill();
      });
      const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius * .8);
      core.addColorStop(0, "rgba(82,205,220,.12)");
      core.addColorStop(.6, "rgba(80,113,210,.055)");
      core.addColorStop(1, "rgba(7,9,16,0)");
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(cx, cy, radius * .8, 0, Math.PI * 2); ctx.fill();
      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      pointer = { x: (event.clientX - rect.left) / rect.width - .5, y: (event.clientY - rect.top) / rect.height - .5, active: true };
    }, { passive: true });
    stage.addEventListener("pointerleave", () => { pointer.active = false; }, { passive: true });
    const observer = new ResizeObserver(() => { resize(); if (raf) cancelAnimationFrame(raf); draw(); });
    observer.observe(stage);
    resize(); draw();
  }

  setupMobileMenu();
  loadProfile();
  setupNeuralCanvas();
})();