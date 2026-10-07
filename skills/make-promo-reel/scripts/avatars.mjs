// Profile pictures for demo people: initials on a soft two-tone gradient, 512px PNG.
// Real apps show avatars everywhere; an empty gray circle makes a demo world feel abandoned.
// Run from the studio folder (for playwright):
//   node avatars.mjs <outDir> "Maya Chen" "Sam Ortiz" ...
// Writes <outDir>/maya-chen.png etc. and prints the paths.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [outDir, ...names] = process.argv.slice(2);
if (!outDir || !names.length) {
  console.error('usage: node avatars.mjs <outDir> "Full Name" ...');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const palettes = [
  ["#f97316", "#facc15"], ["#6366f1", "#a855f7"], ["#0ea5e9", "#22d3ee"], ["#10b981", "#84cc16"],
  ["#ec4899", "#f43f5e"], ["#8b5cf6", "#ec4899"], ["#14b8a6", "#0ea5e9"], ["#f59e0b", "#ef4444"],
  ["#22c55e", "#14b8a6"], ["#f43f5e", "#fb923c"],
];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
for (const name of names) {
  const [a, b] = palettes[hash(name) % palettes.length];
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join("");
  const angle = hash(name + "a") % 360;
  await page.setContent(`<body style="margin:0"><div style="width:512px;height:512px;display:flex;align-items:center;justify-content:center;background:linear-gradient(${angle}deg,${a},${b});font:600 200px/1 -apple-system,'Segoe UI',Inter,sans-serif;color:rgba(255,255,255,0.95);letter-spacing:-6px">${initials}</div></body>`);
  const file = path.join(outDir, `${slug(name)}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();
