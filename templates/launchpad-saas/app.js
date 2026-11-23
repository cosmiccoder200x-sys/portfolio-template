/**
 * VELA — public interactive design demo.
 * No user accounts, tracking, network API calls, payment or durable storage.
 * Dashboard values are fictional and intentionally illustrative.
 */
(() => {
  "use strict";

  const scenarios = {
    overview: {
      overline: "MONDAY, NOVEMBER 23",
      label: "OVERVIEW",
      heading: ["Your space to ", "make waves."],
      subtitle: "Here's the energy behind your best ideas.",
      labels: ["Project momentum", "Ideas in motion", "Shared wins"],
      values: ["+28.6%", "128", "42"],
      activity: ["Refine launch story", "Review creative direction", "Ship new experiment"],
      chart: "Activity over time",
      curve: "M0 167 C54 158 78 187 124 143 S198 124 245 130 S324 66 380 99 S468 42 520 77 S590 26 640 20",
      markerY: 20
    },
    projects: {
      overline: "YOUR CREATIVE PIPELINE",
      label: "PROJECTS",
      heading: ["From idea to ", "impact."],
      subtitle: "See where your next big thing is headed.",
      labels: ["Projects in flow", "Milestones", "Ready to share"],
      values: ["14", "36", "08"],
      activity: ["Polish onboarding flow", "Review product prototype", "Prepare release notes"],
      chart: "Project momentum",
      curve: "M0 185 C57 181 76 139 125 149 S197 156 245 110 S325 121 380 83 S469 114 520 68 S594 54 640 36",
      markerY: 36
    },
    signals: {
      overline: "THE BIGGER PICTURE",
      label: "SIGNALS",
      heading: ["Clarity, ", "on demand."],
      subtitle: "Stay connected to the work that matters most.",
      labels: ["Positive signals", "Insights captured", "Decisions made"],
      values: ["92%", "63", "21"],
      activity: ["Spot rising interest", "Align weekly priorities", "Share the next insight"],
      chart: "Signals in motion",
      curve: "M0 158 C58 115 74 177 126 132 S197 97 245 113 S326 154 381 100 S462 68 520 81 S579 49 640 17",
      markerY: 17
    }
  };

  const text = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  const buttons = Array.from(document.querySelectorAll("[data-scene]"));

  function renderScene(sceneName) {
    const scene = scenarios[sceneName];
    if (!scene) return;

    buttons.forEach(button => {
      const active = button.dataset.scene === sceneName;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const overline = document.getElementById("dash-overline");
    if (overline) {
      overline.replaceChildren(
        document.createTextNode(scene.overline + " "),
        Object.assign(document.createElement("span"), { textContent: "✦" }),
        document.createTextNode(" " + scene.label)
      );
    }
    const heading = document.getElementById("dash-title");
    if (heading) {
      heading.replaceChildren(
        document.createTextNode(scene.heading[0]),
        Object.assign(document.createElement("em"), { textContent: scene.heading[1] })
      );
    }
    text("dash-subtitle", scene.subtitle);
    scene.labels.forEach((label, index) => text("metric-" + (index + 1) + "-label", label));
    scene.values.forEach((value, index) => {
      const slot = document.getElementById("metric-" + (index + 1) + "-value");
      if (!slot) return;
      if (value.endsWith("%")) {
        slot.replaceChildren(document.createTextNode(value.slice(0, -1)), Object.assign(document.createElement("span"), {textContent: "%"}));
      } else {
        slot.textContent = value;
      }
    });
    scene.activity.forEach((label, index) => text("activity-" + (index + 1), label));
    text("chart-title", scene.chart);
    const line = document.getElementById("graph-line");
    const fill = document.getElementById("graph-fill");
    const marker = document.getElementById("graph-marker");
    if (line) line.setAttribute("d", scene.curve);
    if (fill) fill.setAttribute("d", scene.curve + " L640 210 L0 210 Z");
    if (marker) marker.setAttribute("cy", String(scene.markerY));
    const graph = document.querySelector(".graph");
    if (graph) graph.setAttribute("aria-label", "Illustrative " + scene.chart.toLowerCase() + " for " + sceneName + ". Fictional data.");
  }

  buttons.forEach(button => button.addEventListener("click", () => {
    renderScene(button.dataset.scene);
  }));

  const billingButtons = Array.from(document.querySelectorAll("[data-billing]"));
  billingButtons.forEach(button => button.addEventListener("click", () => {
    const period = button.dataset.billing;
    if (period !== "monthly" && period !== "yearly") return;
    billingButtons.forEach(option => {
      const selected = option === button;
      option.classList.toggle("is-current", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-month][data-year]").forEach(price => {
      const value = Number(price.dataset[period === "monthly" ? "month" : "year"]);
      price.textContent = Number.isFinite(value) ? value.toLocaleString("en-IN") : "—";
    });
  }));

  // Keyboard, reduced-motion, and non-JavaScript visitors get the same
  // complete content and working static demo; motion is purely decorative.
})();
