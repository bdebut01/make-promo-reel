// Contact sheet of one captured shot: 8 evenly spaced frames from public/captures/<shot>/,
// tiled into out/frames-<shot>.png, to check a take without rendering anything.
//   node frames.mjs lend        node frames.mjs lend 12
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [shot, n = 8] = [process.argv[2], Number(process.argv[3] ?? 8)];
if (!shot) {
  console.error("usage: node frames.mjs <shot> [count]");
  process.exit(1);
}
const dir = path.resolve("public/captures", shot);
const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const picks = Array.from({ length: Math.min(n, m.frames.length) }, (_, i) => m.frames[Math.round((i * (m.frames.length - 1)) / Math.max(1, n - 1))]);
// Inline the JPEGs as data URIs: a page set with setContent can't load file:// images.
const tiles = picks
  .map((f) => `<figure><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir, f.file)).toString("base64")}"><figcaption>${f.t.toFixed(2)}s</figcaption></figure>`)
  .join("");
const w = m.viewport.width < 600 ? 180 : 360;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<body style="margin:0;background:#222;font:13px system-ui;color:#ddd"><div style="display:grid;grid-template-columns:repeat(4,auto);gap:6px;padding:6px;width:max-content">${tiles}</div><style>figure{margin:0}img{display:block;width:${w}px}</style></body>`);
fs.mkdirSync("out", { recursive: true });
await page.locator("div").first().screenshot({ path: `out/frames-${shot}.png` });
await browser.close();
console.log(`out/frames-${shot}.png: ${picks.length} of ${m.frames.length} frames, ${m.duration.toFixed(1)}s, ${m.clicks.length} clicks`);
