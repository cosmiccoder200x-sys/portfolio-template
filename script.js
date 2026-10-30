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
    }, {
      // A zero threshold also reveals tall sections/forms that can never reach
      // a percentage-based visibility threshold on smaller screens.
      threshold: 0,
      rootMargin: "0px 0px -10px 0px"
    });
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

  // Contact form posts to the same Google Form used by the original portfolio.
  const contactForm = document.getElementById("portfolio-contact-form");
  const formStatus = document.getElementById("form-status");
  const submitBtn = document.getElementById("form-submit-btn");
  const hiddenFrame = document.getElementById("hidden_iframe");
  let formSubmitted = false;
  let submissionFallback = null;

  const completeSubmission = () => {
    if (!formSubmitted) return;
    formSubmitted = false;
    if (submissionFallback) window.clearTimeout(submissionFallback);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Send Message</span><span aria-hidden="true">↗</span>';
    }
    if (formStatus) {
      formStatus.className = "form-status success";
      formStatus.textContent = "Thank you! Your message has been sent.";
    }
    if (contactForm) contactForm.reset();
  };

  if (hiddenFrame) {
    hiddenFrame.addEventListener("load", () => {
      if (formSubmitted) completeSubmission();
    });
  }

  if (contactForm) {
    contactForm.addEventListener("submit", () => {
      formSubmitted = true;
      if (formStatus) {
        formStatus.className = "form-status";
        formStatus.textContent = "";
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Sending message...</span>';
      }
      submissionFallback = window.setTimeout(completeSubmission, 2500);
    });
  }

})();
