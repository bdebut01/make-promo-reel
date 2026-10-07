// Loudness check for a rendered cut: integrated loudness (LUFS) and true peak, measured with
// the loudnorm filter in Remotion's bundled ffmpeg (a minimal build: no ebur128 filter, no
// null video encoder). Social platforms normalize to about -14 LUFS, so a quieter mix plays
// back thin next to other posts, and a louder one gets turned down and can clip.
//   node loudness.mjs out/weekly-reel-9x16.mp4
// Exits 1 when integrated loudness is outside -14 ±2 LUFS or true peak is above -1 dBTP, and
// prints the factor to scale `music.volume` and `sfx.volume` by. A cut with no audio passes.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const TARGET = -14;
const TOLERANCE = 2;
const PEAK_MAX = -1;

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("usage: node loudness.mjs <rendered.mp4>");
  process.exit(1);
}
const run = spawnSync("npx", ["--no-install", "remotion", "ffmpeg", "-hide_banner", "-nostats", "-i", file, "-vn", "-af", "loudnorm=I=-14:TP=-1:print_format=json", "-c:a", "pcm_s16le", "-f", "null", "-"], { encoding: "utf8" });
const log = `${run.stdout}\n${run.stderr}`;
if (!/Stream #.*Audio/.test(log)) {
  console.log(`${file}: no audio track (fine for a muted cut)`);
  process.exit(0);
}
// loudnorm prints its measurement as the last JSON object: { "input_i": "-15.3", "input_tp": "-2.1", … }.
const json = log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1);
let m = {};
try {
  m = JSON.parse(json);
} catch {}
const lufs = Number(m.input_i);
const peak = Number(m.input_tp);
if (!Number.isFinite(lufs)) {
  console.error(`loudness: couldn't read a measurement from ffmpeg:\n${log.slice(-800)}`);
  process.exit(1);
}
const problems = [];
if (Math.abs(lufs - TARGET) > TOLERANCE) problems.push(`integrated ${lufs} LUFS is outside ${TARGET} ±${TOLERANCE}`);
if (Number.isFinite(peak) && peak > PEAK_MAX) problems.push(`true peak ${peak} dBTP is above ${PEAK_MAX}`);
console.log(`${file}: ${lufs} LUFS integrated, ${Number.isFinite(peak) ? peak : "?"} dBTP true peak`);
if (problems.length) {
  // Aim for the target, but never past the peak ceiling.
  let gain = TARGET - lufs;
  if (Number.isFinite(peak)) gain = Math.min(gain, PEAK_MAX - 0.5 - peak);
  const factor = Math.round(10 ** (gain / 20) * 100) / 100;
  for (const p of problems) console.warn(`LOUDNESS WARNING  ${p}`);
  console.warn(`scale music.volume and sfx.volume by about ${factor}, then render again`);
  process.exit(1);
}
