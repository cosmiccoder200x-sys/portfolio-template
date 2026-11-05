import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

(() => {
  "use strict";

  const stage = document.querySelector(".hallway-stage");
  const canvas = document.getElementById("hallway-canvas");
  const links = [...document.querySelectorAll(".hallway-door-link")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!stage || !canvas || !links.length) return;

  const destinations = [
    { id: "projects", x: -1.65, z: -2.2, side: "left" },
    { id: "skills", x: 1.65, z: -6.8, side: "right" },
    { id: "journey", x: -1.65, z: -11.4, side: "left" },
    { id: "contact", x: 1.65, z: -16, side: "right" }
  ];

  let renderer;
  let scene;
  let camera;
  let frame = 0;
  let resizeObserver;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const pointer = { x: 0, y: 0 };
  const doorMeshes = [];

  const makeMaterial = (color, roughness = .78, metalness = .12) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  function addBox(parent, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function buildHallway() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080a0e);
    scene.fog = new THREE.Fog(0x080a0e, 13, 32);

    camera = new THREE.PerspectiveCamera(54, 1, .1, 60);
    camera.position.set(0, 2.05, 7.2);
    camera.lookAt(0, 1.55, -7);

    scene.add(new THREE.HemisphereLight(0xc8d5e5, 0x17191e, 1.25));
    const key = new THREE.DirectionalLight(0xe1e9f3, 2.1);
    key.position.set(-3, 7, 5);
    scene.add(key);

    const floor = makeMaterial(0x171b21, .42, .32);
    const wall = makeMaterial(0x242a32, .88, .08);
    const ceiling = makeMaterial(0x101319, .92, .04);
    const trim = makeMaterial(0x59616d, .4, .55);
    const doorFace = makeMaterial(0x303944, .54, .2);
    const doorInset = makeMaterial(0x20262e, .72, .18);
    const handle = makeMaterial(0xb2bac3, .28, .8);
    const glow = new THREE.MeshBasicMaterial({ color: 0x9eb5d2 });

    addBox(scene, [7.4, .18, 31], [0, -.12, -7], floor);
    addBox(scene, [7.4, .16, 31], [0, 4.25, -7], ceiling);
    addBox(scene, [.18, 4.4, 31], [-3.7, 2.05, -7], wall);
    addBox(scene, [.18, 4.4, 31], [3.7, 2.05, -7], wall);
    addBox(scene, [7.4, .12, .18], [0, .08, 8.4], trim);
    addBox(scene, [.035, .035, 30], [-3.58, 3.95, -7], glow);
    addBox(scene, [.035, .035, 30], [3.58, 3.95, -7], glow);

    // Architectural floor seams create depth without expensive textures.
    const seam = new THREE.LineBasicMaterial({ color: 0x414a56, transparent: true, opacity: .28 });
    for (let z = 5; z >= -22; z -= 2.4) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-3.55, -.018, z),
        new THREE.Vector3(3.55, -.018, z)
      ]);
      scene.add(new THREE.Line(geometry, seam));
    }
    for (let x = -3; x <= 3; x += 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, -.018, 8),
        new THREE.Vector3(x, -.018, -22)
      ]);
      scene.add(new THREE.Line(geometry, seam));
    }

    destinations.forEach((destination, index) => {
      const group = new THREE.Group();
      const side = destination.side === "left" ? -1 : 1;
      const z = destination.z;
      group.position.set(side * 3.58, 0, z);
      group.rotation.y = destination.side === "left" ? Math.PI / 2 : -Math.PI / 2;

      const frameMat = trim;
      addBox(group, [1.48, 2.72, .16], [0, 1.43, 0], frameMat);
      const pivot = new THREE.Group();
      pivot.position.set(-.63, .12, .1);
      group.add(pivot);
      addBox(pivot, [1.22, 2.55, .1], [.61, 1.25, 0], doorFace);
      addBox(pivot, [.82, 1.82, .035], [.61, 1.31, .07], doorInset);
      addBox(pivot, [.025, .22, .06], [1.03, 1.23, .15], handle);
      addBox(group, [1.55, .045, .24], [0, 2.83, .04], glow);

      // Door number marker: small illuminated plate beside the frame.
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(.42, .28, .035),
        new THREE.MeshBasicMaterial({ color: index === 0 ? 0xbac8d9 : 0x8795a5 })
      );
      marker.position.set(destination.side === "left" ? -.98 : .98, 2.55, .12);
      group.add(marker);

      scene.add(group);
      doorMeshes.push({ group, pivot, destination, open: false });
    });

    // A distant portal and light plane anchor the vanishing point.
    addBox(scene, [1.6, 2.7, .12], [0, 1.35, -22.3], trim);
    addBox(scene, [1.28, 2.35, .06], [0, 1.35, -22.2], doorInset);
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    frame = requestAnimationFrame(animate);
    camera.position.x += (pointer.x * .32 - camera.position.x) * .035;
    camera.position.y += (2.05 - pointer.y * .12 - camera.position.y) * .035;
    camera.lookAt(0, 1.55, -7);
    renderer.render(scene, camera);
  }

  function selectDoor(link, index) {
    links.forEach((item) => {
      const active = item === link;
      item.classList.toggle("is-selected", active);
      item.setAttribute("aria-current", active ? "location" : "false");
    });

    const door = doorMeshes[index];
    if (door && !door.open && !reduceMotion) {
      door.open = true;
      door.pivot.rotation.y = door.destination.side === "left" ? -.02 : .02;
      const target = door.destination.side === "left" ? -1.12 : 1.12;
      const start = door.pivot.rotation.y;
      const started = performance.now();
      const duration = 620;
      const animateDoor = (now) => {
        const t = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        door.pivot.rotation.y = start + (target - start) * eased;
        if (t < 1) requestAnimationFrame(animateDoor);
      };
      requestAnimationFrame(animateDoor);
    }

    const destination = document.getElementById(destinations[index].id);
    if (destination) {
      window.setTimeout(() => {
        destination.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }, reduceMotion ? 0 : 480);
    }
  }

  const journeyButtons = [...document.querySelectorAll(".journey-select")];
  const journeyTitle = document.getElementById("journey-detail-title");
  const journeyCopy = document.getElementById("journey-detail-copy");
  journeyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      journeyButtons.forEach((item) => {
        const selected = item === button;
        item.setAttribute("aria-pressed", String(selected));
        item.closest(".journey-item")?.classList.toggle("is-selected", selected);
      });
      if (journeyTitle) journeyTitle.textContent = button.dataset.title || "Milestone";
      if (journeyCopy) journeyCopy.textContent = button.dataset.detail || "";
    });
  });

  links.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      selectDoor(link, index);
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "low-power"
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    buildHallway();
    resize();
    stage.classList.add("is-rendered");
    stage.addEventListener("pointermove", (event) => {
      if (isCoarsePointer || reduceMotion) return;
      const rect = stage.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - .5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - .5) * 2;
    }, { passive: true });
    stage.addEventListener("pointerleave", () => { pointer.x = 0; pointer.y = 0; });

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(stage);
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }

    if (reduceMotion || isCoarsePointer) {
      renderer.render(scene, camera);
    } else {
      animate();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!document.hidden && !reduceMotion && renderer && !frame) {
        animate();
      }
    });
  } catch (error) {
    console.warn("Immersive hallway unavailable; using the static fallback.", error);
    stage.classList.remove("is-rendered");
  }

  window.addEventListener("pagehide", () => {
    if (frame) cancelAnimationFrame(frame);
    if (resizeObserver) resizeObserver.disconnect();
    if (renderer) renderer.dispose();
  }, { once: true });
})();
