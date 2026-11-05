import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

(() => {
  "use strict";

  const stage = document.querySelector(".orbit-stage");
  const canvas = document.getElementById("orbit-canvas");
  const links = [...document.querySelectorAll(".orbit-node")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (!stage || !canvas || !links.length) return;

  const nodeConfig = [
    { id: "work", angle: -Math.PI * .72, color: 0xd5e0ed, size: .24 },
    { id: "toolkit", angle: -Math.PI * .28, color: 0xaabbd0, size: .19 },
    { id: "journey", angle: Math.PI * .72, color: 0xc3cedc, size: .21 },
    { id: "contact", angle: Math.PI * .28, color: 0xe1e5e9, size: .18 }
  ];

  let renderer;
  let scene;
  let camera;
  let core;
  let ringGroup;
  let starField;
  let resizeObserver;
  let animationFrame = 0;
  let activeNode = null;
  const satelliteMeshes = new Map();
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function material(color, roughness = .3, metalness = .65, emissive = 0x000000) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive,
      emissiveIntensity: .18
    });
  }

  function makeCurve(points, opacity = .28) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 100, .008, 5, false);
    const line = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x8e9caf,
        transparent: true,
        opacity
      })
    );
    scene.add(line);
    return line;
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0d12, .025);

    camera = new THREE.PerspectiveCamera(42, 1, .1, 80);
    camera.position.set(0, 0, 11.5);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x9aa9bc, 1.15));

    const keyLight = new THREE.PointLight(0xdce7f4, 35, 28);
    keyLight.position.set(-3.5, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x7188a7, 26, 24);
    rimLight.position.set(4, -3, -2);
    scene.add(rimLight);

    const coreMaterial = material(0x222b37, .22, .82, 0x26384c);
    core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.12, 2), coreMaterial);
    scene.add(core);

    const innerCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(.72, 1),
      new THREE.MeshBasicMaterial({ color: 0x65758a, wireframe: true, transparent: true, opacity: .2 })
    );
    core.add(innerCore);

    ringGroup = new THREE.Group();
    scene.add(ringGroup);
    const ringSpecs = [
      { radius: 2.2, tube: .012, rotation: [1.05, .18, .15], opacity: .42 },
      { radius: 2.8, tube: .008, rotation: [.28, .9, .45], opacity: .24 },
      { radius: 3.45, tube: .006, rotation: [1.4, -.35, .8], opacity: .16 }
    ];

    ringSpecs.forEach((spec) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius, spec.tube, 5, 180),
        new THREE.MeshBasicMaterial({
          color: 0x9baabd,
          transparent: true,
          opacity: spec.opacity
        })
      );
      ring.rotation.set(...spec.rotation);
      ringGroup.add(ring);
    });

    // Fine orbital paths are offset in depth so the sculpture reads as a real object.
    makeCurve([
      new THREE.Vector3(-3.3, .6, -.8),
      new THREE.Vector3(-1.5, 1.4, .35),
      new THREE.Vector3(0, .15, .7),
      new THREE.Vector3(1.7, -1.2, -.25),
      new THREE.Vector3(3.2, -.4, -.8)
    ], .2);

    makeCurve([
      new THREE.Vector3(-2.9, -1.2, .2),
      new THREE.Vector3(-1.3, -.3, -.7),
      new THREE.Vector3(.2, 1.25, .5),
      new THREE.Vector3(1.9, .8, -.3),
      new THREE.Vector3(3.15, 1.1, .25)
    ], .13);

    nodeConfig.forEach((node, index) => {
      const satellite = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(node.size, 2),
        material(node.color, .2, .78, node.color)
      );
      satellite.add(sphere);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(node.size * 1.65, .008, 4, 48),
        new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: .5 })
      );
      halo.rotation.x = Math.PI / 2.7;
      satellite.add(halo);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf0f4fa })
      );
      dot.position.set(node.size * 2.2, 0, 0);
      satellite.add(dot);

      satellite.userData = { ...node, phase: index * .8 };
      scene.add(satellite);
      satelliteMeshes.set(node.id, satellite);
    });

    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      starPositions[i * 3] = (Math.random() - .5) * 17;
      starPositions[i * 3 + 1] = (Math.random() - .5) * 10;
      starPositions[i * 3 + 2] = (Math.random() - .5) * 8 - 1;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0x9eacbd,
        size: .018,
        transparent: true,
        opacity: .42,
        sizeAttenuation: true
      })
    );
    scene.add(starField);
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1 : 1.35);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateSatellites(time) {
    nodeConfig.forEach((node, index) => {
      const satellite = satelliteMeshes.get(node.id);
      if (!satellite) return;
      const phase = node.angle + time * .12 + index * .08;
      const radiusX = 3.1;
      const radiusY = 2.05;
      satellite.position.set(
        Math.cos(phase) * radiusX,
        Math.sin(phase) * radiusY,
        Math.sin(phase * 1.7) * .85
      );
      satellite.rotation.y = time * .2 + index;
      satellite.rotation.z = Math.sin(time * .3 + index) * .18;
    });
  }

  function render(time = 0) {
    if (!renderer) return;
    const seconds = time * .001;
    pointer.x += (pointer.targetX - pointer.x) * .035;
    pointer.y += (pointer.targetY - pointer.y) * .035;

    core.rotation.x = seconds * .08 + pointer.y * .08;
    core.rotation.y = seconds * .13 + pointer.x * .1;
    ringGroup.rotation.y = seconds * .045 + pointer.x * .045;
    ringGroup.rotation.x = pointer.y * .035;
    starField.rotation.z = seconds * .003;
    updateSatellites(seconds);

    renderer.render(scene, camera);
  }

  function animate(time) {
    animationFrame = requestAnimationFrame(animate);
    render(time);
  }

  function setActiveNode(id) {
    activeNode = id;
    links.forEach((link) => {
      const selected = link.dataset.node === id;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });

    satelliteMeshes.forEach((satellite, key) => {
      const sphere = satellite.children[0];
      const isSelected = key === id;
      sphere.scale.setScalar(isSelected ? 1.45 : 1);
      sphere.material.emissiveIntensity = isSelected ? .85 : .18;
    });
  }

  links.forEach((link) => {
    const id = link.dataset.node;
    link.addEventListener("pointerenter", () => setActiveNode(id));
    link.addEventListener("focus", () => setActiveNode(id));
    link.addEventListener("click", () => setActiveNode(id));
  });

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

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    buildScene();
    resize();

    if (!coarsePointer && !reduceMotion) {
      stage.addEventListener("pointermove", (event) => {
        const rect = stage.getBoundingClientRect();
        pointer.targetX = ((event.clientX - rect.left) / rect.width - .5) * 2;
        pointer.targetY = ((event.clientY - rect.top) / rect.height - .5) * 2;
      }, { passive: true });
      stage.addEventListener("pointerleave", () => {
        pointer.targetX = 0;
        pointer.targetY = 0;
      });
    }

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(stage);
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }

    if (coarsePointer || reduceMotion) {
      render(0);
    } else {
      animate(0);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else if (!document.hidden && !coarsePointer && !reduceMotion && !animationFrame) {
        animate(0);
      }
    });
  } catch (error) {
    console.warn("Orbital artwork unavailable; the portfolio navigation remains usable.", error);
    if (renderer) renderer.dispose();
  }

  window.addEventListener("pagehide", () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (resizeObserver) resizeObserver.disconnect();
    if (renderer) renderer.dispose();
    if (starField) starField.geometry.dispose();
  }, { once: true });
})();
