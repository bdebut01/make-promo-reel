// The bundled music library: pick a bed by mood and energy, fetch it once into a shared cache,
// copy it into the studio, and print the promo.json "music" block. No account, no hunting for files.
//
//   node <skill>/scripts/music.mjs list
//   node <skill>/scripts/music.mjs pick --mood clean --energy calm --seconds 20 --seed weekly --out public
//   node <skill>/scripts/music.mjs pick --track 440 --out public        # a specific track
//   node <skill>/scripts/music.mjs fetch                                # cache the whole library
//
// The cache ($PROMO_MUSIC_CACHE, else <$PROMO_REELS or ~/promo-reels>/_music) holds every track
// once, with a README, so the user can audition the library and every reel reuses the same file.
// Downloads go through curl, which honors the sandbox's network proxy.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = JSON.parse(fs.readFileSync(path.join(here, "..", "library", "music.json"), "utf8"));
const cache = process.env.PROMO_MUSIC_CACHE || path.join(process.env.PROMO_REELS || path.join(os.homedir(), "promo-reels"), "_music");
const BED = 0.55; // default level of a bed under the picture, before per-track leveling
const TARGET_RMS = 0.15;

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i > 0 ? args[i + 1] : d;
};
const file = (t) => path.join(cache, `${t.id}-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}.mp3`);

function fetchTrack(t) {
  const dest = file(t);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100_000) return dest;
  fs.mkdirSync(cache, { recursive: true });
  const tmp = `${dest}.part`;
  execFileSync("curl", ["-sSfL", "-m", "120", "-o", tmp, t.url], { stdio: ["ignore", "ignore", "inherit"] });
  if (fs.statSync(tmp).size < 100_000) throw new Error(`music: ${t.url} came back too small; not saving it`);
  fs.renameSync(tmp, dest);
  writeReadme();
  return dest;
}

function writeReadme() {
  const rows = lib.tracks.map((t) => `| ${fs.existsSync(file(t)) ? path.basename(file(t)) : "(not fetched)"} | ${t.title} | ${t.artist} | ${t.genre} | ${t.moods.join(", ")} | ${t.energy} | ~${t.bpm} | ${t.seconds}s |`);
  fs.writeFileSync(
    path.join(cache, "README.md"),
    `# Promo reel music library\n\nBeds the make-promo-reel skill picks from. All from Mixkit under the [${lib.license.name}](${lib.license.url}): free for commercial use, no attribution required; don't redistribute the files as-is.\n\n| File | Title | Artist | Genre | Moods | Energy | BPM | Length |\n|---|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`,
  );
}

const level = (t) => Math.round(Math.min(1, BED * Math.min(2, TARGET_RMS / t.rms)) * 100) / 100;
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

if (cmd === "list") {
  for (const t of lib.tracks) console.log(`${t.id.padStart(5)}  ${t.title.padEnd(20)} ${t.genre.padEnd(11)} ${t.moods.join("/").padEnd(18)} ${t.energy.padEnd(7)} ~${t.bpm} bpm  ${t.seconds}s`);
} else if (cmd === "fetch") {
  for (const t of lib.tracks) console.log(`${fetchTrack(t)}`);
  console.log(`library cached in ${cache}`);
} else if (cmd === "pick") {
  const out = opt("out");
  if (!out) throw new Error("music: --out <studio>/public is required");
  let t = lib.tracks.find((x) => x.id === opt("track"));
  if (!t) {
    const mood = opt("mood", "clean");
    const energy = opt("energy");
    const seconds = Number(opt("seconds", 20));
    let pool = lib.tracks.filter((x) => x.moods.includes(mood) && x.seconds - x.startAt >= seconds + 2);
    if (energy && pool.some((x) => x.energy === energy)) pool = pool.filter((x) => x.energy === energy);
    if (!pool.length) throw new Error(`music: no track for mood ${mood}`);
    // the seed (the app's name) varies the pick between apps but keeps re-renders stable
    t = pool[hash(opt("seed", mood)) % pool.length];
  }
  const src = fetchTrack(t);
  fs.mkdirSync(path.join(out, "music"), { recursive: true });
  fs.copyFileSync(src, path.join(out, "music", `${t.id}.mp3`));
  const block = { src: `music/${t.id}.mp3`, track: `${t.title} by ${t.artist} (Mixkit, ${lib.license.name})`, volume: level(t), startAt: t.startAt, bpm: t.bpm };
  console.log(JSON.stringify({ music: block }, null, 2));
  console.error(`picked ${t.title} (${t.genre}, ${t.energy}, ~${t.bpm} bpm). One beat is ${(60 / t.bpm).toFixed(2)}s.`);
} else {
  console.error("usage: music.mjs list | fetch | pick --mood <clean|playful|bold-dark> [--energy calm|medium|lively] [--seconds N] [--seed app] --out <studio>/public | pick --track <id> --out …");
  process.exit(1);
}
