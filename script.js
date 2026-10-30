(() => {
  "use strict";
  const menuToggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");
  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
      menuToggle.textContent = isOpen ? "×" : "☰";
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation");
      menuToggle.textContent = "☰";
    }));
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    revealItems.forEach((item) => observer.observe(item));
  }

  // Keep the hero visible immediately, even if a browser delays intersection callbacks.
  document.querySelectorAll(".hero .reveal").forEach((item, index) => {
    window.setTimeout(() => item.classList.add("is-visible"), 100 + index * 120);
  });

  // Load profile data progressively; static project cards remain available if it fails.
  fetch("profile.json")
    .then((response) => { if (!response.ok) throw new Error("Profile unavailable"); return response.json(); })
    .then((profile) => {
      const bio = document.getElementById("bio");
      if (bio && profile.bio) bio.textContent = profile.bio;
      const skills = document.getElementById("skills-list");
      if (skills && Array.isArray(profile.skills)) {
        skills.replaceChildren();
        profile.skills.forEach((skill) => {
          const item = document.createElement("li");
          item.textContent = String(skill);
          skills.appendChild(item);
        });
      }
    })
    .catch(() => { /* The page has useful static content as a fallback. */ });
})();