import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

(() => {
  "use strict";

  const canvas = document.getElementById("world-canvas");
  const stageLabel = document.getElementById("world-phase");
  const sections = [...document.querySelectorAll("main > section")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const hardwareCores = Number(navigator.hardwareConcurrency || 8);
  const deviceMemory = Number(navigator.deviceMemory || 8);
  const lowPowerDevice = coarsePointer || hardwareCores <= 4 || deviceMemory <= 4;

  // The camera travels through one continuous world. Each point corresponds to a page chapter.
  const cameraPoints = [
    new THREE.Vector3(0, 0, 22),      // 00 / Origin
    new THREE.Vector3(-5, 1, 12),     // 01 / About
    new THREE.Vector3(-11, 5, 2),     // 02 / Toolkit
    new THREE.Vector3(-4, 8, -9),     // 03 / Education
    new THREE.Vector3(6, 4, -19),     // 04 / Certifications
    new THREE.Vector3(12, -1, -28),  // 05 / Project gallery entrance
    new THREE.Vector3(10, 2, -33),   // 06 / Modulr
    new THREE.Vector3(5, 4, -38),    // 07 / Local Brain MCP
    new THREE.Vector3(-2, 2, -43),   // 08 / FocusFlow
    new THREE.Vector3(-9, -2, -48),  // 09 / E-Learning
    new THREE.Vector3(-6, -5, -53),  // 10 / Gullylabs
    new THREE.Vector3(2, -2, -58),   // 11 / Project gallery exit
    new THREE.Vector3(-8, -3, -66),  // 12 / Journey
    new THREE.Vector3(-1, 1, -75)    // 13 / Contact
  ];

  // The project chapter uses six camera segments so each project gets its own pass-through.
  const routeSegments = [1, 1, 1, 1, 1, 6, 1, 1];
  const chapterWaypointIndices = [0, 1, 2, 3, 4, 5, 11, 12, 13];
  const projectWaypointIndices = [6, 7, 8, 9, 10];

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
  const chapterLandmarks = [];
  const projectGalleryFrames = [];
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
  let isReadMode = false;

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

  function getScrollSegment(progress) {
    const value = clamp(progress, 0, 1);
    for (let i = 0; i < scrollStops.length - 1; i += 1) {
      if (value <= scrollStops[i + 1] || i === scrollStops.length - 2) {
        const start = scrollStops[i];
        const end = Math.max(start + 0.0001, scrollStops[i + 1]);
        return {
          index: i,
          local: clamp((value - start) / (end - start), 0, 1)
        };
      }
    }
    return { index: scrollStops.length - 2, local: 1 };
  }

  function mapScrollToPath(progress) {
    const { index, local } = getScrollSegment(progress);
    let routeIndex = 0;
    for (let i = 0; i < index; i += 1) routeIndex += routeSegments[i] || 1;
    routeIndex += local * (routeSegments[index] || 1);
    return routeIndex / (cameraPoints.length - 1);
  }

  function mapChapterToPath(chapterIndex) {
    return chapterWaypointIndices[chapterIndex] / (cameraPoints.length - 1);
  }

  function setChapter(progress) {
    if (!stageLabel) return;
    const segment = getScrollSegment(progress);
    const index = progress >= 1 ? chapterNames.length - 1 : segment.index;
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
      color: index % 2 ? 0xa6aab0 : 0xd8dbe0,
      transparent: true,
      opacity
    });
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x888d94,
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
      new THREE.LineBasicMaterial({ color: 0x8f949b, transparent: true, opacity: opacity * 0.72 })
    );
    frame.rotation.z = index % 2 ? Math.PI / 4 : 0;
    gateway.add(frame);

    const marker = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12 + (index % 3) * 0.035, 1),
      new THREE.MeshBasicMaterial({ color: 0xe1e3e6, transparent: true, opacity: 0.72 })
    );
    marker.position.set(0, 4.35, 0);
    gateway.add(marker);

    gateway.userData.gatewayRotation = index % 2 ? 0.012 : -0.01;
    floatingWorld.add(gateway);
    return gateway;
  }

  function addChapterLine(group, points, material, radius = 0.012) {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, radius, 5, false),
      material
    );
    group.add(mesh);
    return mesh;
  }

  function createChapterLandmark(chapterIndex, t) {
    const center = path.getPoint(t);
    const tangent = path.getTangent(t).normalize();
    let side = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
    if (side.lengthSq() < 0.01) side = new THREE.Vector3(1, 0, 0);

    const landmark = new THREE.Group();
    const sideSign = chapterIndex % 2 ? -1 : 1;
    landmark.position.copy(center).addScaledVector(side, sideSign * 3.65);
    landmark.position.y += [0, .8, -1.1, 1.25, -.8, .6, -1.15, .5, 0][chapterIndex] || 0;
    landmark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const metal = new THREE.MeshStandardMaterial({
      color: 0x9ca1a8,
      roughness: .3,
      metalness: .78,
      emissive: 0x1a1d22,
      emissiveIntensity: .32,
      flatShading: true
    });
    const pale = new THREE.MeshStandardMaterial({
      color: 0xd8dbe0,
      roughness: .28,
      metalness: .68,
      emissive: 0x24282e,
      emissiveIntensity: .2
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x363a40,
      roughness: .35,
      metalness: .76,
      emissive: 0x1b1e23,
      emissiveIntensity: .28
    });
    const line = new THREE.LineBasicMaterial({
      color: 0xa6aab0,
      transparent: true,
      opacity: .42
    });
    const faintLine = new THREE.LineBasicMaterial({
      color: 0x858a91,
      transparent: true,
      opacity: .2
    });

    const addBox = (width, height, depth, x, y, z, material, rz = 0) => {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rz;
      landmark.add(mesh);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), faintLine);
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      landmark.add(outline);
      return mesh;
    };
    const addNode = (x, y, z, radius = .11, material = pale) => {
      const node = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material);
      node.position.set(x, y, z);
      landmark.add(node);
      return node;
    };
    const addRing = (radius, tube, rotation, material = line) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 5, 84), material);
      ring.rotation.set(...rotation);
      landmark.add(ring);
      return ring;
    };

    switch (chapterIndex) {
      case 0: { // ORIGIN — an open frame around the starting point
        addBox(3.5, .08, .08, 0, 1.8, 0, metal);
        addBox(3.5, .08, .08, 0, -1.8, 0, metal);
        addBox(.08, 3.6, .08, -1.75, 0, 0, metal);
        addBox(.08, 3.6, .08, 1.75, 0, 0, metal);
        addRing(1.15, .018, [.25, .55, .1], pale);
        addNode(0, 0, .18, .2, pale);
        break;
      }
      case 1: { // ABOUT — a layered identity monolith
        addBox(.34, 3.2, .22, -.95, 0, 0, metal, -.08);
        addBox(.92, 2.55, .18, 0, 0, -.12, pale, .045);
        addBox(.28, 3.55, .2, 1.02, 0, -.2, metal, .08);
        addRing(1.55, .018, [.32, .55, .15], line);
        addNode(0, 2, .2, .17);
        addNode(0, -1.95, -.1, .12, metal);
        break;
      }
      case 2: { // TOOLKIT — connected constellation
        const coords = [
          [-1.65, .8, 0], [-.58, 1.48, .14], [.72, 1.1, -.12],
          [1.62, .25, .12], [.92, -.98, -.08], [-.5, -1.42, .1],
          [-1.58, -.48, -.14], [0, .02, .3]
        ];
        const points = coords.map(([x, y, z]) => new THREE.Vector3(x, y, z));
        [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0],[0,7],[2,7],[4,7]].forEach(([a,b]) => {
          addChapterLine(landmark, [points[a], points[b]], line, .009);
        });
        points.forEach((point, index) => addNode(point.x, point.y, point.z, index === 7 ? .2 : .105, index % 2 ? pale : metal));
        addRing(2.05, .012, [.8, .24, .15], faintLine);
        break;
      }
      case 3: { // EDUCATION — stepped architecture and two pillars
        addBox(3.2, .22, .75, 0, -1.25, -.1, dark);
        addBox(2.45, .22, .65, 0, -.78, -.12, metal);
        addBox(1.7, .22, .58, 0, -.31, -.14, pale);
        addBox(.28, 2.0, .34, -.75, .82, -.12, metal);
        addBox(.28, 2.0, .34, .75, .82, -.12, metal);
        addBox(2.0, .12, .44, 0, 1.88, -.12, pale);
        addRing(1.65, .014, [.1, .48, 0], faintLine);
        break;
      }
      case 4: { // CERTIFICATIONS — a geometric seal
        const badgeShape = new THREE.Shape();
        const sides = 8;
        const radius = 1.35;
        for (let i = 0; i < sides; i += 1) {
          const angle = (i / sides) * Math.PI * 2 + Math.PI / 8;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) badgeShape.moveTo(x, y);
          else badgeShape.lineTo(x, y);
        }
        badgeShape.closePath();
        const badge = new THREE.Mesh(
          new THREE.ExtrudeGeometry(badgeShape, { depth: .16, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .035 }),
          metal
        );
        badge.position.z = -.08;
        landmark.add(badge);
        addRing(1.68, .022, [.12, .42, .1], pale);
        addNode(0, 0, .35, .22, pale);
        addBox(1.4, .055, .08, 0, -.48, .22, dark);
        addBox(.95, .055, .08, 0, -.68, .22, dark);
        break;
      }
      case 5: { // PROJECTS — a gallery of floating product frames
        const positions = [
          [-1.35, .7, -.45], [0, .95, -.1], [1.35, .55, -.35],
          [-.78, -.75, .05], [.85, -.82, -.2]
        ];
        positions.forEach(([x, y, z], index) => {
          const width = index === 0 ? .9 : .72;
          const height = index === 0 ? 1.15 : .92;
          addBox(width, height, .08, x, y, z, index % 2 ? dark : metal, (index - 2) * .06);
          addBox(width * .72, .045, .035, x, y + height * .18, z + .065, pale);
          addBox(width * .52, .035, .035, x, y - height * .02, z + .065, metal);
          addBox(width * .62, .035, .035, x, y - height * .19, z + .065, dark);
        });
        addRing(2.2, .012, [.3, .8, .2], faintLine);
        break;
      }
      case 6: { // JOURNEY — a timeline that bends through space
        const milestones = [
          new THREE.Vector3(-1.55, -1.1, .05),
          new THREE.Vector3(-.72, -.35, .15),
          new THREE.Vector3(.18, .3, -.05),
          new THREE.Vector3(1.25, 1.05, .12)
        ];
        addChapterLine(landmark, milestones, line, .024);
        milestones.forEach((point, index) => {
          addNode(point.x, point.y, point.z, .16, index % 2 ? pale : metal);
          addRing(.27, .012, [.5, .2, index * .3], faintLine).position.copy(point);
        });
        break;
      }
      case 7: { // CONTACT — an open portal
        addRing(1.65, .035, [.08, .2, 0], pale);
        addRing(1.3, .012, [.08, .2, 0], line);
        addBox(2.6, .08, .12, 0, -1.82, 0, metal);
        addBox(.08, 3.6, .12, -1.3, 0, 0, metal);
        addBox(.08, 3.6, .12, 1.3, 0, 0, metal);
        addNode(0, 0, .2, .16);
        break;
      }
      default: { // BEYOND — a final expanding aperture
        addRing(2.0, .022, [.15, .42, .1], pale);
        addRing(1.35, .014, [.6, .1, .2], line);
        addRing(.7, .012, [.1, .8, .2], faintLine);
        addNode(0, 0, .1, .13);
      }
    }

    const materials = new Set();
    landmark.traverse((object) => {
      const assigned = Array.isArray(object.material)
        ? object.material
        : object.material ? [object.material] : [];
      assigned.forEach((material) => {
        if (materials.has(material)) return;
        materials.add(material);
        material.userData.scrollBaseOpacity = Number.isFinite(material.opacity) ? material.opacity : 1;
        material.transparent = true;
        material.depthWrite = false;
      });
    });

    chapterLandmarks.push({
      group: landmark,
      progress: t,
      materials: [...materials].map((material) => ({
        material,
        baseOpacity: material.userData.scrollBaseOpacity
      }))
    });

    floatingWorld.add(landmark);
    return landmark;
  }

  function updateChapterFocus(routeT) {
    chapterLandmarks.forEach(({ group, progress, materials }) => {
      const distance = Math.abs(routeT - progress);
      const proximity = 1 - clamp(distance / 0.2, 0, 1);
      const focus = proximity * proximity * (3 - 2 * proximity);
      const opacityScale = 0.24 + focus * 0.76;

      group.scale.setScalar(0.9 + focus * 0.1);
      materials.forEach(({ material, baseOpacity }) => {
        material.opacity = baseOpacity * opacityScale;
      });
    });
  }

  function createProjectGalleryFrame(projectIndex, t) {
    const center = path.getPoint(t);
    const tangent = path.getTangent(t).normalize();
    let side = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
    if (side.lengthSq() < 0.01) side = new THREE.Vector3(1, 0, 0);

    const frameGroup = new THREE.Group();
    const sideSign = projectIndex % 2 === 0 ? 1 : -1;
    frameGroup.position.copy(center)
      .addScaledVector(tangent, 2.1)
      .addScaledVector(side, sideSign * 4.5);
    frameGroup.position.y += projectIndex % 2 === 0 ? 1.15 : -1.15;
    frameGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const metal = new THREE.MeshBasicMaterial({
      color: 0xb8bdc4, transparent: true, opacity: .2, depthWrite: false
    });
    const faint = new THREE.MeshBasicMaterial({
      color: 0x8c929a, transparent: true, opacity: .12, depthWrite: false
    });
    const plateMaterial = new THREE.MeshBasicMaterial({
      color: 0x101216, transparent: true, opacity: .055,
      side: THREE.DoubleSide, depthWrite: false
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 3.65), plateMaterial);
    frameGroup.add(plate);

    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(5.85, 3.8, .08));
    frameGroup.add(new THREE.LineSegments(outlineGeometry, metal));

    const header = new THREE.Mesh(new THREE.BoxGeometry(5.85, .055, .09), faint);
    header.position.set(0, 1.9, .055);
    frameGroup.add(header);

    for (let line = 0; line < 3; line += 1) {
      const detail = new THREE.Mesh(new THREE.BoxGeometry(1.1 + line * .32, .025, .04), faint);
      detail.position.set(-1.95, -.92 - line * .22, .06);
      frameGroup.add(detail);
    }

    const indexMarker = new THREE.Mesh(new THREE.IcosahedronGeometry(.11, 1), metal);
    indexMarker.position.set(2.45, 1.55, .1);
    frameGroup.add(indexMarker);

    floatingWorld.add(frameGroup);
    projectGalleryFrames.push({
      group: frameGroup,
      progress: t,
      materials: [metal, faint, plateMaterial],
      baseOpacities: [.2, .12, .055]
    });
  }

  function updateProjectGalleryFocus(routeT) {
    projectGalleryFrames.forEach(({ group, progress, materials, baseOpacities }) => {
      const distance = Math.abs(routeT - progress);
      const proximity = 1 - clamp(distance / .11, 0, 1);
      const focus = proximity * proximity * (3 - 2 * proximity);
      group.scale.setScalar(.78 + focus * .22);
      materials.forEach((material, index) => {
        material.opacity = baseOpacities[index] * (.18 + focus * .82);
      });
    });
  }

  function buildFloatingGeometry() {
    floatingWorld = new THREE.Group();
    scene.add(floatingWorld);

    const gatewayCount = lowPowerDevice ? 7 : 11;
    for (let i = 0; i < gatewayCount; i += 1) {
      createGateway(0.055 + (i / gatewayCount) * 0.91, i);
    }

    chapterWaypointIndices.forEach((waypointIndex, chapterIndex) => {
      createChapterLandmark(chapterIndex, mapChapterToPath(chapterIndex));
    });

    projectWaypointIndices.forEach((waypointIndex, projectIndex) => {
      createProjectGalleryFrame(projectIndex, waypointIndex / (cameraPoints.length - 1));
    });

    makeLine(path.getPoints(420), 0xb3b7bd, 0.16, 0.018);
    makeLine(routeRail(-3.5), 0x878c93, 0.11, 0.012);
    makeLine(routeRail(3.5), 0x878c93, 0.11, 0.012);

    const shardCount = lowPowerDevice ? 28 : 72;
    const shardGeometry = new THREE.OctahedronGeometry(0.13, 0);
    const shardMaterial = new THREE.MeshStandardMaterial({
      color: 0x858a91,
      roughness: 0.34,
      metalness: 0.68,
      emissive: 0x1e2228,
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
    const count = lowPowerDevice ? 220 : 580;
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
        color: 0xb5bac1,
        size: lowPowerDevice ? 0.022 : 0.027,
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
    scene.fog = new THREE.FogExp2(0x090a0c, 0.009);

    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 180);
    camera.position.copy(cameraPoints[0]);

    scene.add(new THREE.AmbientLight(0x9a9da2, 1.15));
    const keyLight = new THREE.DirectionalLight(0xe1e3e6, 1.3);
    keyLight.position.set(-7, 10, 12);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x8c9199, 42, 48);
    rimLight.position.set(8, 5, -28);
    scene.add(rimLight);

    const farLight = new THREE.PointLight(0xc4c7cc, 28, 40);
    farLight.position.set(-8, -5, -50);
    scene.add(farLight);

    buildFloatingGeometry();
    buildStars();
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPowerDevice ? 1 : 1.25));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 700 ? 58 : 48;
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    if (!camera) return;
    const routeT = mapScrollToPath(scrollState.progress);
    setChapter(scrollState.progress);
    updateChapterFocus(routeT);
    updateProjectGalleryFocus(routeT);

    const lookT = clamp(routeT + (routeT > 0.97 ? -0.025 : 0.025), 0, 1);
    desiredPosition.copy(path.getPoint(routeT));
    desiredTarget.copy(path.getPoint(lookT));

    if (reduceMotion || isReadMode) {
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
    camera.rotateZ(Math.sin(routeT * Math.PI * 2) * 0.035);
  }

  function render(time) {
    if (!renderer) return;
    const seconds = time * 0.001;
    const delta = Math.min(0.05, Math.max(0, seconds - lastTime));
    lastTime = seconds;

    updateCamera();

    if (!reduceMotion && floatingWorld) {
      floatingWorld.children.forEach((object) => {
        if (object.userData && object.userData.gatewayRotation) {
          object.rotation.z += delta * object.userData.gatewayRotation;
        }
      });
      if (starField) starField.rotation.z = Math.sin(seconds * 0.08) * 0.003;
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
    } else {
      const readScroll = () => {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrollState.progress = clamp(window.scrollY / maxScroll, 0, 1);
        if (reduceMotion) {
          refreshScrollStops();
          updateCamera();
          if (renderer && scene && camera) renderer.render(scene, camera);
        }
      };
      window.addEventListener("scroll", readScroll, { passive: true });
      window.addEventListener("resize", () => {
        refreshScrollStops();
        readScroll();
      }, { passive: true });
      window.addEventListener("load", () => {
        refreshScrollStops();
        readScroll();
      }, { once: true });
      readScroll();
    }
  }

  function setupReadModeSync() {
    window.addEventListener("portfolio:readmodechange", (event) => {
      isReadMode = Boolean(event.detail && event.detail.enabled);
      pointer.targetX = 0;
      pointer.targetY = 0;

      if (isReadMode) {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        return;
      }

      if (reduceMotion) {
        updateCamera();
        if (renderer && scene && camera) renderer.render(scene, camera);
      } else if (!document.hidden && !animationFrame) {
        lastTime = 0;
        animate(0);
      }
    });
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

  if (!canvas || !sections.length || sections.length + 1 !== chapterWaypointIndices.length
      || routeSegments.length !== sections.length
      || routeSegments.reduce((sum, value) => sum + value, 0) !== cameraPoints.length - 1) {
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

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      canvas.dataset.contextState = "lost";
    }, false);
    canvas.addEventListener("webglcontextrestored", () => {
      delete canvas.dataset.contextState;
      resize();
      if (reduceMotion) {
        updateCamera();
        renderer.render(scene, camera);
      } else if (!document.hidden && !animationFrame) {
        lastTime = 0;
        animate(0);
      }
    }, false);

    buildScene();
    resize();
    setupScrollControl();
    setupReadModeSync();
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
    if (scene) {
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
    if (renderer) renderer.dispose();
  }, { once: true });
})();