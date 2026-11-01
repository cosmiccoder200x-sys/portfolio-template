(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ==========================================================================
     1. NAVIGATION & MOBILE DRAWER
     ========================================================================== */
  const menuToggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");
  const siteHeader = document.querySelector(".site-header");

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
      menuToggle.textContent = isOpen ? "×" : "☰";
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
        menuToggle.textContent = "☰";
      });
    });
  }

  /* ==========================================================================
     2. SCROLL PROGRESS & HEADER STATE
     ========================================================================== */
  const scrollProgressBar = document.getElementById("scroll-progress");

  const updateScrollMetrics = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    // Header glassmorphism toggle
    if (siteHeader) {
      if (scrollY > 30) {
        siteHeader.classList.add("is-scrolled");
      } else {
        siteHeader.classList.remove("is-scrolled");
      }
    }

    // Scroll progress bar
    if (scrollProgressBar && docHeight > 0) {
      const progress = Math.min(100, Math.max(0, (scrollY / docHeight) * 100));
      scrollProgressBar.style.setProperty("--scroll-progress", `${progress.toFixed(2)}%`);
    }
  };

  window.addEventListener("scroll", updateScrollMetrics, { passive: true });
  updateScrollMetrics();

  /* ==========================================================================
     3. UNIFIED SCROLL REVEALS & ACTIVE SECTION OBSERVER
     ========================================================================== */
  const revealItems = document.querySelectorAll(".reveal");
  const navLinks = document.querySelectorAll("#main-nav a");
  const sections = document.querySelectorAll("main > section[id]");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    // Reveal Observer
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.05,
      rootMargin: "0px 0px -40px 0px"
    });

    revealItems.forEach((item) => revealObserver.observe(item));

    // Active Section Observer for Nav
    if (sections.length && navLinks.length) {
      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            navLinks.forEach((link) => {
              if (link.getAttribute("href") === `#${id}`) {
                link.classList.add("is-active");
              } else {
                link.classList.remove("is-active");
              }
            });
          }
        });
      }, {
        threshold: 0.35,
        rootMargin: "-20% 0px -40% 0px"
      });

      sections.forEach((sec) => sectionObserver.observe(sec));
    }
  }

  // Hero immediate entrance to prevent layout hesitation
  document.querySelectorAll(".hero .reveal").forEach((item, index) => {
    window.setTimeout(() => item.classList.add("is-visible"), 80 + index * 100);
  });

  /* ==========================================================================
     3A. ABOUT SECTION MASK + STAGGERED REVEAL
     ========================================================================== */
  const aboutSection = document.getElementById("about");
  const aboutRevealItems = aboutSection
    ? aboutSection.querySelectorAll(".about-reveal")
    : [];

  if (aboutSection && aboutRevealItems.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      aboutRevealItems.forEach((item) => item.classList.add("is-visible"));
    } else {
      aboutSection.classList.add("about-motion-ready");
      const aboutObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.12,
        rootMargin: "0px 0px -35px 0px"
      });

      aboutRevealItems.forEach((item) => aboutObserver.observe(item));
    }
  }

  /* ==========================================================================
     4. HERO ROLE ROTATOR
     ========================================================================== */
  const roleRotator = document.getElementById("role-rotator");
  if (roleRotator && !reduceMotion) {
    const roles = [
      "SOFTWARE DEVELOPER",
      "AI BUILDER",
      "FORWARD-DEPLOYED ENGINEER"
    ];
    let roleIndex = 0;

    window.setInterval(() => {
      roleRotator.classList.add("is-transitioning");
      window.setTimeout(() => {
        roleIndex = (roleIndex + 1) % roles.length;
        roleRotator.textContent = roles[roleIndex];
        roleRotator.classList.remove("is-transitioning");
      }, 300);
    }, 3800);
  }

  /* ==========================================================================
     5. RIVE SP ORB & VIRTUAL JOYSTICK GIMBAL
     ========================================================================== */
  const initOrbAndJoystick = () => {
    const orbWrap = document.getElementById("hero-orb-wrap");
    const orbCanvas = document.getElementById("hero-orb-canvas");
    const fallback = document.getElementById("hero-orb-fallback");
    const fallbackOuter = fallback ? fallback.querySelector(".fallback-ring-outer") : null;
    const fallbackMiddle = fallback ? fallback.querySelector(".fallback-ring-middle") : null;
    const fallbackInner = fallback ? fallback.querySelector(".fallback-ring-inner") : null;
    const fallbackHighlight = fallback ? fallback.querySelector(".fallback-highlight") : null;
    const heroSection = document.getElementById("home");

    if (!orbWrap) return;

    // State variables
    let currentX = 0; // Normalized -1 to +1
    let currentY = 0; // Normalized -1 to +1
    let targetX = 0;
    let targetY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let isDragging = false;
    let dragStartPointerX = 0;
    let dragStartPointerY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let animationFrameId = null;

    // Rive instance
    let riveOrb = null;

    const initRive = () => {
      if (!orbCanvas) return;
      if (typeof rive === "undefined") {
        if (!window._riveRetryCount) window._riveRetryCount = 0;
        if (window._riveRetryCount < 30) {
          window._riveRetryCount++;
          window.setTimeout(initRive, 100);
        }
        return;
      }
      try {
        riveOrb = new rive.Rive({
          src: "assets/rive/hero-orb.riv",
          canvas: orbCanvas,
          artboard: "PortfolioOrb",
          stateMachine: "State Machine 1",
          autoplay: !reduceMotion,
          onLoad: () => {
            riveOrb.resizeDrawingSurfaceToCanvas();
            orbWrap.classList.add("is-loaded");
          },
          onError: () => {
            orbWrap.classList.remove("is-loaded");
          }
        });

        let resizeTimeout = null;
        window.addEventListener("resize", () => {
          if (resizeTimeout) window.clearTimeout(resizeTimeout);
          resizeTimeout = window.setTimeout(() => {
            if (riveOrb) riveOrb.resizeDrawingSurfaceToCanvas();
          }, 120);
        }, { passive: true });
      } catch (e) {
        console.warn("Rive orb notice:", e);
      }
    };

    initRive();

    // Helper: update visual 3D transforms from currentX and currentY
    const updateTransforms = (x, y) => {
      if (reduceMotion) return;

      const dist = Math.min(Math.hypot(x, y), 1.2);

      // 3D Spatial Gimbal Deflection on Orb
      const rotY = x * 26;
      const rotX = -y * 26;
      const scaleFactor = 1 + dist * 0.04;
      orbWrap.style.transform = `perspective(900px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${scaleFactor})`;

      // Canvas / Fallback ring parallax layers
      if (fallbackOuter) {
        fallbackOuter.style.transform = `translate3d(${x * 14}px, ${y * 14}px, 0)`;
      }
      if (fallbackMiddle) {
        fallbackMiddle.style.transform = `translate3d(${x * 6}px, ${y * 6}px, 0)`;
      }
      if (fallbackInner) {
        fallbackInner.style.transform = `translate3d(${-x * 8}px, ${-y * 8}px, 0)`;
      }
      if (fallbackHighlight) {
        const rad = Math.atan2(y, x);
        const hDist = dist * 20;
        fallbackHighlight.style.transform = `translate3d(${Math.cos(rad) * hDist}px, ${Math.sin(rad) * hDist}px, 0)`;
      }
    };

    // Smooth physics loop (spring or lerp)
    const tick = () => {
      if (isDragging) {
        currentX = targetX;
        currentY = targetY;
        velocityX = 0;
        velocityY = 0;
      } else {
        // Harmonic spring physics towards targetX, targetY
        const spring = 0.14;
        const damping = 0.76;

        const forceX = (targetX - currentX) * spring;
        const forceY = (targetY - currentY) * spring;

        velocityX = (velocityX + forceX) * damping;
        velocityY = (velocityY + forceY) * damping;

        currentX += velocityX;
        currentY += velocityY;

        if (Math.abs(currentX - targetX) < 0.001 && Math.abs(currentY - targetY) < 0.001 && Math.abs(velocityX) < 0.001 && Math.abs(velocityY) < 0.001) {
          currentX = targetX;
          currentY = targetY;
          velocityX = 0;
          velocityY = 0;
        }
      }

      updateTransforms(currentX, currentY);

      if (isDragging || Math.abs(currentX - targetX) > 0.0005 || Math.abs(currentY - targetY) > 0.0005 || Math.abs(velocityX) > 0.0005) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        animationFrameId = null;
      }
    };

    const wakeUp = () => {
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    // Direct Virtual Joystick Dragging on the Orb
    const handlePointerDown = (e) => {
      isDragging = true;
      orbWrap.classList.add("is-dragging");
      dragStartPointerX = e.clientX;
      dragStartPointerY = e.clientY;
      dragStartX = targetX;
      dragStartY = targetY;
      try {
        orbWrap.setPointerCapture(e.pointerId);
      } catch (_) {}
    };

    const handlePointerMove = (e) => {
      if (!isDragging) return;
      const rect = orbWrap.getBoundingClientRect();
      const sensitivity = (rect.width / 2) || 120;

      let dx = dragStartX + (e.clientX - dragStartPointerX) / sensitivity;
      let dy = dragStartY + (e.clientY - dragStartPointerY) / sensitivity;
      const dist = Math.hypot(dx, dy);
      if (dist > 1.25) {
        dx = (dx / dist) * 1.25;
        dy = (dy / dist) * 1.25;
      }
      targetX = dx;
      targetY = dy;
      wakeUp();
    };

    const handlePointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      orbWrap.classList.remove("is-dragging");
      try {
        orbWrap.releasePointerCapture(e.pointerId);
      } catch (_) {}

      // Spring back to center or settle
      targetX = 0;
      targetY = 0;
      wakeUp();
    };

    orbWrap.addEventListener("pointerdown", handlePointerDown);
    orbWrap.addEventListener("pointermove", handlePointerMove);
    orbWrap.addEventListener("pointerup", handlePointerUp);
    orbWrap.addEventListener("pointercancel", handlePointerUp);

    // Cursor tracking across Hero section (Handle Source simulation)
    if (heroSection && isFinePointer && !reduceMotion) {
      heroSection.addEventListener("mousemove", (e) => {
        if (isDragging) return;
        const rect = heroSection.getBoundingClientRect();
        // Calculate offset relative to orb quadrant
        const relX = (e.clientX - (rect.left + rect.width * 0.7)) / (rect.width * 0.4);
        const relY = (e.clientY - (rect.top + rect.height * 0.35)) / (rect.height * 0.4);

        let dx = Math.max(-1, Math.min(1, relX));
        let dy = Math.max(-1, Math.min(1, relY));
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          dx /= dist;
          dy /= dist;
        }

        // Subtler motion for passive cursor tracking (max 0.6 deflection)
        targetX = dx * 0.6;
        targetY = dy * 0.6;
        wakeUp();
      }, { passive: true });

      heroSection.addEventListener("mouseleave", () => {
        if (!isDragging) {
          targetX = 0;
          targetY = 0;
          wakeUp();
        }
      });
    }

    // Initialize transforms at 0, 0
    updateTransforms(0, 0);
  };

  initOrbAndJoystick();

  /* ==========================================================================
     6. DESKTOP CURSOR SPOTLIGHT
     ========================================================================== */
  const spotlight = document.getElementById("cursor-spotlight");
  if (spotlight && isFinePointer && !reduceMotion) {
    let mouseX = -999;
    let mouseY = -999;
    let ticking = false;

    window.addEventListener("pointermove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          spotlight.style.setProperty("--spotlight-x", `${mouseX}px`);
          spotlight.style.setProperty("--spotlight-y", `${mouseY}px`);
          if (!spotlight.classList.contains("is-active")) {
            spotlight.classList.add("is-active");
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
      spotlight.classList.remove("is-active");
    });
  }

  /* ==========================================================================
     7. DESKTOP PROJECT CARDS 3D MICRO-TILT
     ========================================================================== */
  if (isFinePointer && !reduceMotion) {
    const projectCards = document.querySelectorAll(".project-card");
    projectCards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // Very subtle angle (max 2.5 deg)
        const rotateX = ((centerY - y) / centerY) * 2.5;
        const rotateY = ((x - centerX) / centerX) * 2.5;

        card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ==========================================================================
     8. PROFILE DATA PROGRESSIVE LOADING
     ========================================================================== */
  fetch("profile.json")
    .then((response) => {
      if (!response.ok) throw new Error("Profile unavailable");
      return response.json();
    })
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
    .catch(() => {
      /* Static HTML content remains completely functional */
    });

  /* ==========================================================================
     9. CONTACT FORM (ORIGINAL GOOGLE FORM BACKEND)
     ========================================================================== */
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
