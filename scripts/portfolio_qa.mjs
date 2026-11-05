#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const failures = [];
let passed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("PASS  " + name);
  } else {
    failures.push({ name, detail });
    console.error("FAIL  " + name + (detail ? " — " + detail : ""));
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function numericArray(source, declaration) {
  const match = source.match(new RegExp("const\\s+" + declaration + "\\s*=\\s*\\[([^\\]]*)\\]"));
  if (!match) return null;
  return [...match[1].matchAll(/-?\d+(?:\.\d+)?/g)].map((item) => Number(item[0]));
}

function localFileExists(reference, fromFile = "") {
  const clean = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  if (!clean || /^[a-z]+:/i.test(clean) || clean.startsWith("//") || clean.startsWith("#")) return true;
  const base = path.dirname(path.join(root, fromFile));
  const target = path.resolve(clean.startsWith("/") ? root : base, clean.replace(/^\//, ""));
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  return fs.existsSync(target);
}

const html = read("index.html");
const script = read("script.js");
const immersive = read("immersive.js");
const assistant = read("assistant.js");
const baseCss = read("style.css");
const immersiveCss = read("immersive.css");
const profileText = read("profile.json");

check("Node.js 20 or newer", Number(process.versions.node.split(".")[0]) >= 20, process.versions.node);

for (const [filename, source] of [
  ["script.js", script],
  ["assistant.js", assistant],
  ["immersive.js", immersive.replace(/^\s*import\s+\*\s+as\s+THREE\s+from\s+["'][^"']+["'];\s*/, "")]
]) {
  try {
    new vm.Script(source, { filename });
    check(filename + " parses", true);
  } catch (error) {
    check(filename + " parses", false, error.message);
  }
}

try {
  JSON.parse(profileText);
  check("profile.json is valid JSON", true);
} catch (error) {
  check("profile.json is valid JSON", false, error.message);
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((item) => item[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
check("HTML IDs are unique", duplicates.length === 0, duplicates.join(", "));

const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [null, ""])[1];
const sectionIds = [...main.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/gi)].map((item) => item[1]);
check("Eight primary portfolio chapters exist", sectionIds.length === 8, "Found " + sectionIds.length);

const rail = (html.match(/<nav\b[^>]*class=["'][^"']*chapter-rail[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i) || [null, ""])[1];
const railTargets = [...rail.matchAll(/href=["']#([^"']+)["']/g)].map((item) => item[1]);
const orphanTargets = railTargets.filter((target) => !sectionIds.includes(target));
check("Chapter rail targets all resolve", railTargets.length === sectionIds.length && orphanTargets.length === 0, orphanTargets.join(", "));

const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((item) => item[0]);
const missingAlt = imageTags.filter((tag) => !/\balt=["'][^"']*["']/i.test(tag));
check("All images define alt text", missingAlt.length === 0, missingAlt.length + " image(s) without alt");

const contactForm = (html.match(/<form\b[^>]*id=["']portfolio-contact-form["'][^>]*>([\s\S]*?)<\/form>/i) || [null, ""])[1];
const contactControls = [...contactForm.matchAll(/<(?:input|textarea)\b[^>]*>/gi)].map((item) => item[0]);
const contactLabels = [...contactForm.matchAll(/<label\b[^>]*for=["']([^"']+)["']/gi)].map((item) => item[1]);
const unlabelledControls = contactControls.filter((tag) => {
  const id = (tag.match(/\bid=["']([^"']+)["']/i) || [null, ""])[1];
  return !id || !contactLabels.includes(id);
});
check("Contact form controls have associated labels", contactControls.length > 0 && unlabelledControls.length === 0, unlabelledControls.length + " unlabelled control(s)");

const markupTags = [...html.matchAll(/<(?:script|img|link|iframe|source|a)\b[^>]*>/gi)].map((item) => item[0]);
const markupRefs = markupTags.flatMap((tag) => {
  const match = tag.match(/\b(?:src|href)=["']([^"']+)["']/i);
  return match ? [{ reference: match[1], source: "index.html" }] : [];
});
const cssRefs = [...(baseCss + "\n" + immersiveCss).matchAll(/url\(\s*["']?([^)'" ]+)["']?\s*\)/gi)]
  .map((item) => ({ reference: item[1].trim(), source: "style.css" }));
const dynamicAssets = [...new Set([...((script + "\n" + immersive + "\n" + assistant).matchAll(/["'](assets\/[^"'?#]+)(?:\?[^"']*)?["']/g))])]
  .map((item) => ({ reference: item[1], source: "index.html" }));
const brokenRefs = [...markupRefs, ...cssRefs, ...dynamicAssets]
  .filter((item) => !localFileExists(item.reference, item.source));
check("Referenced local files exist", brokenRefs.length === 0, brokenRefs.map((item) => item.reference).join(", "));

const cameraBlock = (immersive.match(/const cameraPoints\s*=\s*\[([\s\S]*?)\];/) || [null, ""])[1];
const cameraPointCount = (cameraBlock.match(/new THREE\.Vector3\s*\(/g) || []).length;
const routeSegments = numericArray(immersive, "routeSegments");
const chapterWaypoints = numericArray(immersive, "chapterWaypointIndices");
const projectWaypoints = numericArray(immersive, "projectWaypointIndices");
const chapterNamesBlock = (immersive.match(/const chapterNames\s*=\s*\[([\s\S]*?)\];/) || [null, ""])[1];
const chapterNameCount = (chapterNamesBlock.match(/["'][^"']+["']/g) || []).length;
const projectCardCount = (main.match(/<article\b[^>]*class=["'][^"']*project-card[^"']*["']/gi) || []).length;

check("Camera route covers every scroll segment", Boolean(routeSegments) && routeSegments.length === sectionIds.length && routeSegments.reduce((sum, value) => sum + value, 0) === cameraPointCount - 1,
  "segments=" + (routeSegments || []).length + ", points=" + cameraPointCount);
check("Chapter landmarks map to all sections plus final frame", Boolean(chapterWaypoints) && chapterWaypoints.length === sectionIds.length + 1 && chapterNameCount === chapterWaypoints.length,
  "sections=" + sectionIds.length + ", waypoints=" + (chapterWaypoints || []).length + ", labels=" + chapterNameCount);
check("All camera waypoints are in range", Boolean(chapterWaypoints) && Boolean(projectWaypoints)
  && [...chapterWaypoints, ...projectWaypoints].every((value) => Number.isInteger(value) && value >= 0 && value < cameraPointCount));
check("Project cards and 3D gallery frames match", Boolean(projectWaypoints) && projectWaypoints.length === projectCardCount,
  "cards=" + projectCardCount + ", frames=" + (projectWaypoints || []).length);

check("GSAP has a native-scroll fallback", /if\s*\(!reduceMotion\s*&&\s*window\.gsap\s*&&\s*window\.ScrollTrigger\)/.test(immersive)
  && /window\.addEventListener\(["']scroll["']/.test(immersive));
check("WebGL context loss and restoration are handled", immersive.includes("webglcontextlost") && immersive.includes("webglcontextrestored"));
check("3D render loop pauses when the page is hidden", immersive.includes("visibilitychange") && immersive.includes("document.hidden"));
check("Read Mode remains paused after tab resume and WebGL restore", (immersive.match(/!document\.hidden && !animationFrame && !isReadMode/g) || []).length >= 2);
check("Reduced-motion mode is respected", immersive.includes("prefers-reduced-motion: reduce") && immersiveCss.includes("prefers-reduced-motion"));
check("Low-power devices receive a capped render pixel ratio", immersive.includes("hardwareCores <= 4") && immersive.includes("deviceMemory <= 4") && immersive.includes("lowPowerDevice ? 1 : 1.25"));
check("Low-power devices use lighter particle and shard counts", immersive.includes("lowPowerDevice ? 220 : 580") && immersive.includes("lowPowerDevice ? 28 : 72"));
check("Primary navigation exposes keyboard focus indicators", immersiveCss.includes(".chapter-rail a:focus-visible") && immersiveCss.includes(".read-mode-toggle:focus-visible"));
check("Read Mode control starts disabled and has a handler", /id=["']read-mode-toggle["'][^>]*aria-pressed=["']false["']/.test(html)
  && script.includes("read-mode-toggle") && immersive.includes("portfolio:readmodechange"));
check("Contact pullback holds focus on the Contact landmark", immersive.includes("desiredTarget.lerp(path.getPoint(journeyT), contactProgress);"));
check("Pointer steering uses horizontal movement only", /const pointer = \{ x: 0, targetX: 0 \}/.test(immersive)
  && immersive.includes("pointer.targetX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;")
  && !/pointer\.(?:y|targetY)/.test(immersive));
check("Horizontal pointer movement changes camera heading without shifting its path position", immersive.includes("camera.position.lerp(desiredPosition, 0.2);")
  && immersive.includes("cameraTarget.addScaledVector(lateral, pointer.x * 3.2)"));
check("Native page scrolling is not hijacked", !/addEventListener\(["'](?:wheel|touchmove)["'][\s\S]{0,300}?preventDefault\(/.test(immersive + script));

let cssDepth = 0;
let cssBalanced = true;
const cssSource = (baseCss + "\n" + immersiveCss).replace(/\/\*[\s\S]*?\*\//g, "");
for (const character of cssSource) {
  if (character === "{") cssDepth += 1;
  if (character === "}") cssDepth -= 1;
  if (cssDepth < 0) cssBalanced = false;
}
check("CSS blocks are balanced", cssBalanced && cssDepth === 0, "final brace depth=" + cssDepth);
const breakpoints = [...immersiveCss.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((item) => Number(item[1]));
check("Responsive breakpoints are defined", breakpoints.length >= 3, breakpoints.join(", ") + "px");

console.log("\n" + passed + " checks passed; " + failures.length + " failed.");
if (failures.length) process.exitCode = 1;
