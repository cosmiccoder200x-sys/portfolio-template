const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (u) => (/^https?:\/\//i.test(u) ? u : '#');

async function loadProfile() {
  try {
    const response = await fetch('profile.json');
    if (!response.ok) throw new Error('Profile data unavailable');
    const p = await response.json();
    document.title = `${p.name} | AI & Full-Stack Developer`;
    if ($('name')) $('name').textContent = p.name;
    if ($('tagline')) $('tagline').textContent = p.tagline;
    if ($('bio')) $('bio').textContent = p.bio;
    if ($('skills')) $('skills').innerHTML = (p.skills || []).map((s) => `<li class="reveal">${esc(s)}</li>`).join('');
    if ($('projects')) $('projects').innerHTML = (p.projects || []).map((x) =>
      `<article class="card reveal"><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p><a href="${esc(safe(x.link))}" target="_blank" rel="noopener noreferrer">View project</a></article>`).join('');
    if ($('links')) $('links').innerHTML = Object.entries(p.links || {}).map(([k, v]) =>
      `<a href="${esc(safe(v))}" target="_blank" rel="noopener noreferrer">${esc(k)}</a>`).join('');
    if ($('footer')) $('footer').textContent = `© ${new Date().getFullYear()} ${p.name} · Designed to explore what's next.`;
  } catch (error) {
    console.error('Could not load profile.json:', error);
  }
}

function initReveal() {
  const items = document.querySelectorAll('.section, .bento-main, .bento-side, .metric-card, .contact-card');
  items.forEach((el) => el.classList.add('reveal'));
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function initNeuralCore() {
  const canvas = $('neural-canvas');
  const host = canvas?.parentElement;
  if (!canvas || !host) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const points = [];
  const count = 190;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }
  let width = 0, height = 0, dpr = 1, frame = 0;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  const resize = () => {
    const box = host.getBoundingClientRect();
    width = box.width; height = box.height; dpr = Math.min(window.devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const onMove = (event) => {
    const box = host.getBoundingClientRect();
    targetX = ((event.clientX - box.left) / box.width - .5) * 1.1;
    targetY = ((event.clientY - box.top) / box.height - .5) * .8;
  };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  resize();
  const render = (time) => {
    frame = requestAnimationFrame(render);
    if (document.hidden) return;
    ctx.clearRect(0, 0, width, height);
    const t = reduceMotion ? 0 : time * .00022;
    pointerX += (targetX - pointerX) * .035;
    pointerY += (targetY - pointerY) * .035;
    const radius = Math.min(width, height) * .31;
    const rotY = t + pointerX, rotX = pointerY * .6 + .18;
    const sinY = Math.sin(rotY), cosY = Math.cos(rotY), sinX = Math.sin(rotX), cosX = Math.cos(rotX);
    const projected = points.map((p) => {
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y1 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const perspective = 2.8 / (2.8 - z2 * .42);
      return { x: width * .5 + x1 * radius * perspective, y: height * .49 + y1 * radius * perspective, z: z2, size: (1.05 + (z2 + 1) * .75) * perspective };
    });
    const linkDistance = Math.max(20, width * .072);
    for (let i = 0; i < projected.length; i++) {
      const a = projected[i];
      for (let j = i + 1; j < projected.length; j++) {
        const b = projected[j], dx = a.x - b.x, dy = a.y - b.y, dist = Math.hypot(dx, dy);
        if (dist < linkDistance) {
          const alpha = (1 - dist / linkDistance) * (.12 + (a.z + b.z + 2) * .035);
          ctx.strokeStyle = `rgba(70, 218, 255, ${alpha})`;
          ctx.lineWidth = .65;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    projected.forEach((p) => {
      const alpha = .3 + ((p.z + 1) / 2) * .65;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.6, p.size), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(125, 239, 255, ${alpha})`; ctx.fill();
      if (p.z > .48) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(70, 218, 255, ${alpha * .055})`; ctx.fill();
      }
    });
    const core = ctx.createRadialGradient(width*.5,height*.49,0,width*.5,height*.49,radius*.85);
    core.addColorStop(0,'rgba(45,145,255,.045)'); core.addColorStop(1,'rgba(45,145,255,0)');
    ctx.fillStyle = core; ctx.fillRect(0,0,width,height);
  };
  frame = requestAnimationFrame(render);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); host.removeEventListener('pointermove', onMove); }, { once: true });
}

loadProfile().then(() => {
  initReveal();
  initNeuralCore();
  // Newly injected skill and project items should animate in too.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .08 });
    document.querySelectorAll('#skills .reveal, #projects .reveal, #links a').forEach((el) => {
      el.classList.add('reveal'); observer.observe(el);
    });
  }
});
