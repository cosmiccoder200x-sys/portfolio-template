import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

(() => {
  "use strict";

  const canvas = document.getElementById("world-canvas");
  const stageLabel = document.getElementById("world-phase");
  const sections = [...document.querySelectorAll("main > section")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // The camera travels through one continuous world. Each point corresponds to a page chapter.
  const cameraPoints = [
    new THREE.Vector3(0, 0, 22),
    new THREE.Vector3(-5, 1, 12),
    new THREE.Vector3(-11, 5, 2),
    new THREE.Vector3(-4, 8, -9),
    new THREE.Vector3(6, 4, -19),
    new THREE.Vector3(12, -1, -28),
    new THREE.Vector3(4, -7, -38),
    new THREE.Vector3(-8, -3, -49),
    new THREE.Vector3(-1, 1, -61)
  ];

  const chapterNames = [
    "01 / ORIGIN",
    "02 / ABOUT",
    "03 / TOOLKIT",
    "04 / EDUCATION",
    "05 / CERTIFICATIONS",
    "06 / SELECTED WORK",
    "07 / JOURNEY",
    "08 / CONTACT",
    "09 / BEYOND"
  ];

  const path = new THREE.CatmullRomCurve3(cameraPoints, false, "centripetal", 0.45);
  const scrollState = { progress: 0 };
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);

  let renderer = null;
  let scene = null;
  let camera = null;
  let starField = null;
  let floatingWorld = null;
  let resizeObserver = null;
  let animationFrame = 0;
  let scrollStops = [0, .125, .25, .375, .5, .625, .75, .875, 1];
  let activeChapter = -1;
  let lastTime = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function refreshScrollStops() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const anchors = sections.map((section) => {
      const top = window.scrollY + section.getBoundingClientRect().top;
      return clamp(top / maxScroll, 0, 1);
    });

    // Keep the first and final camera marks attached to the absolute start and end of the page.
    scrollStops = [0, ...anchors.slice(1), 1];
    for (let i = 1; i < scrollStops.length; i += 1) {
      scrollStops[i] = Math.max(scrollStops[i], scrollStops[i - 1] + 0.0001);
    }
    scrollStops[scrollStops.length - 1] = 1;
  }

  function mapScrollToPath(progress) {
    const value = clamp(progress, 0, 1);
    for (let i = 0; i < scrollStops.length - 1; i += 1) {
      if (value <= scrollStops[i + 1] || i === scrollStops.length - 2) {
        const start = scrollStops[i];
        const end = Math.max(start + 0.0001, scrollStops[i + 1]);
        const local = clamp((value - start) / (end - start), 0, 1);
        return (i + local) / (scrollStops.length - 1);
      }
    }
    return 1;
  }

  function setChapter(routeT) {
    if (!stageLabel) return;
    const index = Math.min(chapterNames.length - 1, Math.floor(routeT * (chapterNames.length - 1) + 0.0001));
    if (index === activeChapter) return;
    activeChapter = index;
    stageLabel.textContent = chapterNames[index];
  }

  function makeLine(points, color, opacity, radius) {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(80, points.length * 8), radius, 5, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
    );
    scene.add(mesh);
    return mesh;
  }

  function routeRail(offset) {
    const points = [];
    for (let i = 0; i <= 260; i += 1) {
      const t = i / 260;
      const center = path.getPoint(t);
      const tangent = path.getTangent(t).normalize();
      let side = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
      if (side.lengthSq() < 0.01) side = new THREE.Vector3(1, 0, 0);
      center.addScaledVector(side, offset);
      points.push(center);
    }
    return points;
  }

  function createGateway(t, index) {
    const center = path.getPoint(t);
    const tangent = path.getTangent(t).normalize();
    const gateway = new THREE.Group();
    gateway.position.copy(center);
    gateway.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const opacity = 0.12 + (index % 3) * 0.035;
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: index % 2 ? 0x9eafc2 : 0xd0d8e2,
      transparent: true,
      opacity
    });
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x8296ae,
      transparent: true,
      opacity: opacity * 0.55
    });

    const outer = new THREE.Mesh(new THREE.TorusGeometry(3.9 + (index % 3) * 0.28, 0.018, 5, 100), ringMaterial);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.009, 4, 88), innerMaterial);
    inner.rotation.z = index * 0.27;
    gateway.add(outer, inner);

    const frameGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(7.8, 7.8, 0.1));
    const frame = new THREE.LineSegments(
      frameGeometry,
      new THREE.LineBasicMaterial({ color: 0x8796a8, transparent: true, opacity: opacity * 0.72 })
    );
    frame.rotation.z = index % 2 ? Math.PI / 4 : 0;
    gateway.add(frame);

    const marker = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12 + (index % 3) * 0.035, 1),
      new THREE.MeshBasicMaterial({ color: 0xe0e5eb, transparent: true, opacity: 0.72 })
    );
    marker.position.set(0, 4.35, 0);
    gateway.add(marker);

    floatingWorld.add(gateway);
    return gateway;
  }

  function createStation(t, index) {
    const center = path.getPoint(t);
    const tangent = path.getTangent(t).normalize();
    let side = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
    if (side.lengthSq() < 0.01) side = new THREE.Vector3(1, 0, 0);
    const station = new THREE.Group();
    station.position.copy(center).addScaledVector(side, index % 2 ? -5.8 : 5.8);
    station.position.y += index % 2 ? 1.7 : -1.4;

    const size = 0.34 + (index % 3) * 0.1;
    const crystal = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size, 1),
      new THREE.MeshStandardMaterial({
        color: index % 2 ? 0x72849b : 0xc0cbd7,
        roughness: 0.28,
        metalness: 0.72,
        emissive: 0x172332,
        emissiveIntensity: 0.45,
        flatShading: true
      })
    );
    crystal.rotation.set(index * 0.41, index * 0.27, index * 0.19);
    station.add(crystal);

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(size * 1.8, 0.012, 4, 56),
      new THREE.MeshBasicMaterial({ color: 0x9aaabd, transparent: true, opacity: 0.42 })
    );
    orbit.rotation.set(0.6 + index * 0.16, 0.25, index * 0.22);
    station.add(orbit);

    const tetherPoints = [center, station.position.clone()];
    makeLine(tetherPoints, 0x7d8da1, 0.2, 0.006);
    floatingWorld.add(station);
  }

  function buildFloatingGeometry() {
    floatingWorld = new THREE.Group();
    scene.add(floatingWorld);

    const gatewayCount = coarsePointer ? 8 : 12;
    for (let i = 0; i < gatewayCount; i += 1) {
      createGateway(0.055 + (i / gatewayCount) * 0.91, i);
    }

    for (let i = 0; i < cameraPoints.length - 1; i += 1) {
      createStation((i + 0.5) / (cameraPoints.length - 1), i);
    }

    makeLine(path.getPoints(420), 0xaab8c8, 0.16, 0.018);
    makeLine(routeRail(-3.5), 0x7f91a7, 0.11, 0.012);
    makeLine(routeRail(3.5), 0x7f91a7, 0.11, 0.012);

    const shardCount = coarsePointer ? 44 : 90;
    const shardGeometry = new THREE.OctahedronGeometry(0.13, 0);
    const shardMaterial = new THREE.MeshStandardMaterial({
      color: 0x71849b,
      roughness: 0.34,
      metalness: 0.68,
      emissive: 0x1a2736,
      emissiveIntensity: 0.28,
      flatShading: true
    });
    const shards = new THREE.InstancedMesh(shardGeometry, shardMaterial, shardCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < shardCount; i += 1) {
      const t = (i + 0.5) / shardCount;
      const center = path.getPoint(t);
      const tangent = path.getTangent(t).normalize();
      let side = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
      if (side.lengthSq() < 0.01) side = new THREE.Vector3(1, 0, 0);
      const sign = i % 2 ? 1 : -1;
      center.addScaledVector(side, sign * (4.7 + (i % 5) * 1.25));
      center.y += Math.sin(i * 1.7) * 3.3;
      dummy.position.copy(center);
      dummy.rotation.set(i * 0.21, i * 0.37, i * 0.13);
      dummy.scale.setScalar(0.45 + (i % 4) * 0.22);
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    floatingWorld.add(shards);
  }

  function buildStars() {
    const count = coarsePointer ? 360 : 760;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const t = Math.random();
      const point = path.getPoint(t);
      positions[i * 3] = point.x + (Math.random() - 0.5) * 38;
      positions[i * 3 + 1] = point.y + (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 26;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starField = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xa7b7c9,
        size: coarsePointer ? 0.022 : 0.027,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        depthWrite: false
      })
    );
    scene.add(starField);
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080a0e, 0.009);

    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 180);
    camera.position.copy(cameraPoints[0]);

    scene.add(new THREE.AmbientLight(0x8998aa, 1.15));
    const keyLight = new THREE.DirectionalLight(0xdce5ef, 1.3);
    keyLight.position.set(-7, 10, 12);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x6d819c, 42, 48);
    rimLight.position.set(8, 5, -28);
    scene.add(rimLight);

    const farLight = new THREE.PointLight(0xc3cfde, 28, 40);
    farLight.position.set(-8, -5, -50);
    scene.add(farLight);

    buildFloatingGeometry();
    buildStars();
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1 : 1.35));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 700 ? 58 : 48;
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    if (!camera) return;
    const routeT = mapScrollToPath(reduceMotion ? 0 : scrollState.progress);
    setChapter(routeT);

    const lookT = clamp(routeT + (routeT > 0.97 ? -0.025 : 0.025), 0, 1);
    desiredPosition.copy(path.getPoint(routeT));
    desiredTarget.copy(path.getPoint(lookT));

    if (reduceMotion) {
      camera.position.copy(desiredPosition);
      camera.lookAt(desiredTarget);
      return;
    }

    pointer.x += (pointer.targetX - pointer.x) * 0.055;
    pointer.y += (pointer.targetY - pointer.y) * 0.055;
    cameraPosition.copy(desiredPosition);
    cameraPosition.x += pointer.x * 0.24;
    cameraPosition.y -= pointer.y * 0.16;
    camera.position.lerp(cameraPosition, 0.2);

    cameraTarget.copy(desiredTarget);
    cameraTarget.x += pointer.x * 0.34;
    cameraTarget.y -= pointer.y * 0.22;
    const smoothTarget = camera.userData.smoothTarget || (camera.userData.smoothTarget = cameraTarget.clone());
    smoothTarget.lerp(cameraTarget, 0.2);
    camera.lookAt(smoothTarget);
    camera.rotateZ(Math.sin(routeT * Math.PI * 2) * 0.018);
  }

  function render(time) {
    if (!renderer) return;
    const seconds = time * 0.001;
    const delta = Math.min(0.05, Math.max(0, seconds - lastTime));
    lastTime = seconds;

    updateCamera();

    if (!reduceMotion && floatingWorld) {
      floatingWorld.children.forEach((object, index) => {
        if (object.isGroup && index % 3 === 0) {
          object.rotation.z += delta * (index % 2 ? 0.012 : -0.01);
        }
      });
      if (starField) starField.rotation.z = Math.sin(seconds * 0.08) * 0.004;
    }

    renderer.render(scene, camera);
  }

  function animate(time) {
    animationFrame = requestAnimationFrame(animate);
    render(time);
  }

  function setupScrollControl() {
    refreshScrollStops();

    if (!reduceMotion && window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.gsap.to(scrollState, {
        progress: 1,
        ease: "none",
        scrollTrigger: {
          trigger: document.body,
          start: "top top",
          end: () => "+=" + Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
          scrub: 0.8,
          invalidateOnRefresh: true,
          onRefreshInit: refreshScrollStops
        }
      });
      window.addEventListener("load", () => window.ScrollTrigger.refresh(), { once: true });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => window.ScrollTrigger.refresh()).catch(() => {});
      }
    } else if (!reduceMotion) {
      const readScroll = () => {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrollState.progress = clamp(window.scrollY / maxScroll, 0, 1);
        refreshScrollStops();
      };
      window.addEventListener("scroll", readScroll, { passive: true });
      window.addEventListener("resize", readScroll, { passive: true });
      readScroll();
    }
  }

  function setupPointer() {
    if (coarsePointer || reduceMotion) return;
    window.addEventListener("pointermove", (event) => {
      pointer.targetX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      pointer.targetY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    });
  }

  function setupJourney() {
    const buttons = [...document.querySelectorAll(".journey-select")];
    const title = document.getElementById("journey-detail-title");
    const copy = document.getElementById("journey-detail-copy");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => {
          const selected = item === button;
          item.setAttribute("aria-pressed", String(selected));
          item.closest(".journey-item")?.classList.toggle("is-selected", selected);
        });
        if (title) title.textContent = button.dataset.title || "Milestone";
        if (copy) copy.textContent = button.dataset.detail || "";
      });
    });
  }

  setupJourney();

  if (!canvas || !sections.length || sections.length + 1 !== cameraPoints.length) {
    console.warn("The 3D world could not map the portfolio sections. Content remains available.");
    return;
  }

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
    renderer.toneMappingExposure = 1.05;

    buildScene();
    resize();
    setupScrollControl();
    setupPointer();

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => {
        resize();
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      });
      resizeObserver.observe(document.querySelector("main"));
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }

    if (reduceMotion) {
      render(0);
    } else {
      animate(0);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        } else if (!document.hidden && !animationFrame) {
          lastTime = 0;
          animate(0);
        }
      });
    }
  } catch (error) {
    console.warn("The 3D world is unavailable; the portfolio remains fully usable.", error);
    if (renderer) renderer.dispose();
    canvas.hidden = true;
  }

  window.addEventListener("pagehide", () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (resizeObserver) resizeObserver.disconnect();
    if (window.ScrollTrigger) window.ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    if (renderer) renderer.dispose();
    if (starField) starField.geometry.dispose();
  }, { once: true });
})();