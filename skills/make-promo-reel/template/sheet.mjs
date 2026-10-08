// Contact sheet: evenly spaced stills from the composition, tiled into one labeled PNG.
// One image to look at instead of scrubbing a video.
//   node sheet.mjs            → out/sheet.png, 12 frames
//   node sheet.mjs 20 0 180   → 20 frames between frame 0 and 180
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [count = 12, fromArg, toArg] = process.argv.slice(2).map(Number);
const out = path.resolve("out/sheet");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.CHROME || null; // playwright-docker: the image's Chromium
const composition = await selectComposition({ serveUrl, id: "Promo", browserExecutable });
const last = composition.durationInFrames - 1;

// Pacing floors: a scene below these can't be read. Warn loudly; the sheet still renders.
const warnings = [];
for (const [i, sc] of composition.props.scenes.entries()) {
  const label = `scene ${i + 1} (${sc.type}${sc.clip ? " " + sc.clip : ""})`;
  if (sc.type === "intro" && sc.duration < 2.0) warnings.push(`${label}: intro is ${sc.duration}s; the headline needs it to be at least 2.0s`);
  if (sc.type === "end" && sc.duration < 2.0) warnings.push(`${label}: end card is ${sc.duration}s; give it at least 2.0s`);
  if (sc.type === "shot") {
    const lead = sc.leadIn ?? (sc.caption ? 1.0 : 0.3);
    if (sc.caption && lead < 0.8) warnings.push(`${label}: leadIn ${lead}s is under 0.8s, so the caption can't be read before the action`);
    if ((sc.speed ?? 1) > 1.2) warnings.push(`${label}: speed ${sc.speed} is over 1.2 and will look fast-forwarded`);
  }
}
const total = composition.durationInFrames / composition.fps;
const cap = composition.props.maxSeconds;
if (cap && total > cap + 0.25) warnings.push(`the cut runs ${total.toFixed(1)}s, over the ${cap}s cap: cut a moment rather than speeding shots up`);
for (const w of warnings) console.warn(`PACING WARNING  ${w}`);

// Beat report: with a music bpm, how far apart the cuts are in beats. Whole numbers mean the
// cuts keep the music's rhythm. Only the bpm is known, not where the downbeat falls, so this
// checks spacing, not phase. Information, not a warning: beat-matching is optional.
const bpm = composition.props.music?.bpm;
const cuts = composition.props.cuts ?? [];
if (bpm && cuts.length > 1) {
  const beat = (60 / bpm) * composition.fps;
  const gaps = cuts.slice(1).map((c, i) => (c - cuts[i]) / beat);
  const off = gaps.map((g, i) => [i, g]).filter(([, g]) => Math.abs(g - Math.round(g)) > 0.15);
  console.log(`beats  ${bpm} bpm (one beat ${(60 / bpm).toFixed(2)}s); cuts at ${cuts.map((c) => (c / composition.fps).toFixed(2) + "s").join(", ")}`);
  console.log(`beats  spacing between cuts: ${gaps.map((g) => g.toFixed(2)).join(", ")} beats${off.length ? `; off the grid: ${off.map(([i, g]) => `cuts ${i + 1}–${i + 2} (${g.toFixed(2)}; nearest whole is ${Math.round(g)})`).join(", ")}` : "; all on the grid"}`);
}
const from = fromArg ?? 0;
const to = Math.min(toArg ?? last, last);
const frames = [...new Set(Array.from({ length: count }, (_, i) => Math.round(from + ((to - from) * i) / Math.max(1, count - 1))))];

for (const frame of frames) {
  await renderStill({ composition, serveUrl, frame, output: path.join(out, `${frame}.jpeg`), imageFormat: "jpeg", scale: 0.3, browserExecutable });
}

const cols = composition.width >= composition.height ? 4 : 6;
const tiles = frames
  .map((f) => `<figure><img src="${pathToFileURL(path.join(out, `${f}.jpeg`)).href}"><figcaption>f${f} · ${(f / composition.fps).toFixed(2)}s</figcaption></figure>`)
  .join("");
const html = `<html><body style="margin:0;background:#222;font:14px system-ui;color:#ddd"><div style="display:grid;grid-template-columns:repeat(${cols},auto);gap:8px;padding:8px;width:max-content">${tiles}</div>
<style>figure{margin:0}img{display:block;width:${composition.width >= composition.height ? 420 : 200}px}figcaption{padding:3px 0}</style></body></html>`;
fs.writeFileSync(path.join(out, "sheet.html"), html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(out, "sheet.html")).href);
await page.locator("div").first().screenshot({ path: path.resolve("out/sheet.png") });
await browser.close();
console.log(`out/sheet.png — ${frames.length} frames of ${composition.durationInFrames} (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);
