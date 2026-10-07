// Synthesizes the UI sound kits into public/sfx/<kit>/: no files to find, nothing to license.
// Runs on `npm install` (postinstall); run it again by hand after editing a kit.
//   node sfx.mjs
// Kits: soft (mood clean), round (playful), crisp (bold-dark). Each has click-1..3, key-1..6,
// whoosh, chime and pop-1..2, as 44.1 kHz mono WAVs. The studio places them from the capture's
// own events: clicks, keystrokes, transitions, the payoff and the end-card bubbles.
import fs from "node:fs";
import path from "node:path";

const SR = 44100;

// Deterministic noise, so a re-run produces identical files.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

// RBJ biquad, coefficients recomputed per sample so the filter can sweep.
function biquad() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, type, f, q) => {
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
    const a = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    let b0, b1, b2;
    if (type === "bp") [b0, b1, b2] = [a, 0, -a];
    else if (type === "hp") [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

const render = (seconds, fn) => Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => fn(i / SR, i));

function normalize(buf, peak) {
  const m = buf.reduce((a, v) => Math.max(a, Math.abs(v)), 1e-9);
  // A 0.5 ms fade in keeps the attack (the click is in the first milliseconds); a 3 ms fade
  // out avoids a pop where the file ends.
  const fin = Math.round(SR * 0.0005);
  const fout = Math.round(SR * 0.003);
  return buf.map((v, i) => (v / m) * peak * Math.min(1, i / fin, (buf.length - 1 - i) / fout));
}

const tone = (t, f) => Math.sin(2 * Math.PI * f * t);

const KITS = {
  // clean: muted, papery ticks and a warm two-note chime
  soft: { click: 1700, clickNoise: 3200, clickDecay: 0.007, body: 0, key: 1800, whoosh: [350, 2200], whooshDur: 0.42, chime: [880, 1318.5], chimeDecay: 0.85, pop: [700, 300] },
  // playful: rounder, woody ticks, a marimba-like chime, bouncier pops
  round: { click: 1150, clickNoise: 2400, clickDecay: 0.01, body: 190, key: 1400, whoosh: [260, 1600], whooshDur: 0.46, chime: [659.3, 987.8], chimeDecay: 0.5, pop: [620, 220] },
  // bold-dark: crisp, glassy, slightly brighter and faster
  crisp: { click: 2600, clickNoise: 5200, clickDecay: 0.005, body: 0, key: 2400, whoosh: [500, 3600], whooshDur: 0.34, chime: [1046.5, 1568], chimeDecay: 0.7, pop: [900, 380] },
};

function click(k, v) {
  const n = rng(11 + v);
  const bp = biquad();
  const pitch = [1, 1.07, 0.94][v];
  return normalize(
    render(0.07, (t) =>
      0.65 * tone(t, k.click * pitch) * Math.exp(-t / k.clickDecay) +
      0.55 * bp(n(), "bp", k.clickNoise * pitch, 1.3) * Math.exp(-t / 0.0028) +
      (k.body ? 0.35 * tone(t, k.body) * Math.exp(-t / 0.014) : 0),
    ),
    0.7,
  );
}

function key(k, v) {
  const n = rng(101 + v * 7);
  const hp = biquad();
  const f = k.key * (0.85 + 0.06 * v);
  const body = 380 + 55 * ((v * 3) % 6);
  return normalize(
    render(0.055, (t) => 0.8 * hp(n(), "hp", f, 0.8) * Math.exp(-t / (0.0035 + 0.0004 * v)) + 0.3 * tone(t, body) * Math.exp(-t / 0.006)),
    0.5 + 0.03 * (v % 3),
  );
}

function whoosh(k) {
  const n = rng(7);
  const bp = biquad();
  const lp = biquad();
  const [f0, f1] = k.whoosh;
  const d = k.whooshDur;
  return normalize(
    render(d, (t) => {
      const p = t / d;
      const f = f0 * Math.pow(f1 / f0, Math.sin((Math.PI / 2) * p));
      return lp(bp(n(), "bp", f, 0.9), "lp", f * 2.5, 0.7) * Math.pow(Math.sin(Math.PI * p), 1.6);
    }),
    0.6,
  );
}

function chime(k) {
  const [a, b] = k.chime;
  const d = k.chimeDecay;
  return normalize(
    render(d * 1.6, (t) => {
      const atk = Math.min(1, t / 0.004);
      const e = Math.exp(-t / (d * 0.45));
      const e2 = Math.exp(-t / (d * 0.18));
      // second note lands 70 ms later: a small "ta-da" rather than a beep
      const t2 = Math.max(0, t - 0.07);
      const e3 = t >= 0.07 ? Math.exp(-t2 / (d * 0.45)) : 0;
      return atk * (0.6 * tone(t, a) * e + 0.12 * tone(t, a * 2) * e2 + 0.55 * tone(t2, b) * e3 + 0.1 * tone(t2, b * 2) * e3 * e2);
    }),
    0.6,
  );
}

function pop(k, v) {
  const [f0, f1] = k.pop.map((f) => f * (v ? 1.12 : 1));
  let phase = 0;
  return normalize(
    render(0.09, (t) => {
      const f = f1 + (f0 - f1) * Math.exp(-t / 0.018);
      phase += (2 * Math.PI * f) / SR;
      return Math.sin(phase) * Math.min(1, t / 0.002) * Math.exp(-t / 0.028);
    }),
    0.5,
  );
}

function wav(buf) {
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

let count = 0;
for (const [name, k] of Object.entries(KITS)) {
  const dir = path.resolve("public/sfx", name);
  fs.mkdirSync(dir, { recursive: true });
  const out = { whoosh: whoosh(k), chime: chime(k) };
  for (let v = 0; v < 3; v++) out[`click-${v + 1}`] = click(k, v);
  for (let v = 0; v < 6; v++) out[`key-${v + 1}`] = key(k, v);
  for (let v = 0; v < 2; v++) out[`pop-${v + 1}`] = pop(k, v);
  for (const [f, buf] of Object.entries(out)) {
    fs.writeFileSync(path.join(dir, `${f}.wav`), wav(buf));
    count++;
  }
}
console.log(`sfx: wrote ${count} sounds to public/sfx/{${Object.keys(KITS).join(",")}}`);
