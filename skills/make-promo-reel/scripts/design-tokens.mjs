// Pulls the look out of a design source: CSS, HTML (inline <style>, linked local stylesheets,
// Google Fonts links), a folder of either, or a design-tokens JSON file. Prints JSON:
//
//   suggest     brand fields for promo.json (hex colors, font families, radius), guessed from
//               variable names and usage. A starting point to check, not an answer.
//   vars        custom properties per selector (":root", "[data-theme=dark]", "@media dark", …),
//               with var() references resolved and colors normalized to hex
//   fontFaces   @font-face rules, with src resolved to files on disk where they exist
//   googleFonts families requested from fonts.googleapis.com
//   families    font-family values by how often they're used, and which selectors use them
//   colors      the most-used literal colors, as hex
//   tokens      flattened entries from any .json token file ({ "color.primary": "#..." })
//
//   node design-tokens.mjs <file|folder> [more…] > tokens.json
//
// Plain Node, no dependencies, no browser.

import fs from "node:fs";
import path from "node:path";

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error("usage: node design-tokens.mjs <file|folder> [more…]");
  process.exit(1);
}

// ---- color normalization -------------------------------------------------------------------

const hex2 = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
const toHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const num = (s, scale = 1) => (s.endsWith("%") ? (parseFloat(s) / 100) * scale : parseFloat(s));
const linToSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function oklabToHex(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex(
    linToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
}

function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

const NAMED = { white: "#ffffff", black: "#000000", transparent: null };

export function normColor(raw) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v in NAMED) return NAMED[v];
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return `#${h.slice(0, 3).split("").map((c) => c + c).join("")}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  m = v.match(/^(rgba?|hsla?|oklch|oklab)\(([^)]*)\)$/);
  if (!m) {
    // Bare channel triples, as Tailwind/shadcn store them: "222.2 47.4% 11.2%" (hsl) or "0.21 0.03 264" (oklch).
    const parts = v.split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3 && parts.slice(0, 3).every((p) => /^-?[\d.]+%?(deg)?$/.test(p))) {
      if (parts[1].endsWith("%") && parts[2].endsWith("%")) return hslToHex(parseFloat(parts[0]), num(parts[1]), num(parts[2]));
    }
    return null;
  }
  const p = m[2].split(/[\s,/]+/).filter(Boolean);
  if (p.length < 3) return null;
  if (m[1].startsWith("rgb")) return toHex(num(p[0], 255), num(p[1], 255), num(p[2], 255));
  if (m[1].startsWith("hsl")) return hslToHex(parseFloat(p[0]), num(p[1]), num(p[2]));
  if (m[1] === "oklch") {
    const L = num(p[0]);
    const C = num(p[1], 0.4);
    const H = (parseFloat(p[2]) * Math.PI) / 180;
    return oklabToHex(L, C * Math.cos(H), C * Math.sin(H));
  }
  return oklabToHex(num(p[0]), num(p[1], 0.4), num(p[2], 0.4));
}

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\([^)]*\)/g;

// ---- gather sources ------------------------------------------------------------------------

const css = []; // { text, file }
const jsonTokens = {};
const googleFonts = new Set();
const seen = new Set();

function addGoogle(url) {
  for (const m of url.matchAll(/family=([^&:;"')]+)/g)) googleFonts.add(decodeURIComponent(m[1]).replace(/\+/g, " "));
}

function flatten(obj, prefix, out) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    if ("$value" in obj || "value" in obj) {
      const v = obj.$value ?? obj.value;
      if (typeof v !== "object") out[prefix] = String(v);
      return;
    }
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith("$")) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (typeof obj === "string" || typeof obj === "number") out[prefix] = String(obj);
}

// A claude.ai Design System's project/tokens.json: families of { name, value, usage } lists,
// colors valued per theme ({ light, dark }) or as one string for the first theme.
const ds = { themes: [], colors: [], other: [], families: {}, fonts: [] };
function readDesignSystem(j) {
  ds.themes = (j.color.themes || []).map((t) => t.id);
  for (const t of j.color.tokens) {
    const per = typeof t.value === "object" ? t.value : { [ds.themes[0] || "default"]: t.value };
    const hex = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, normColor(String(v)) ?? String(v)]));
    ds.colors.push({ name: t.name, value: hex, usage: t.usage || "" });
  }
  for (const [fam, block] of Object.entries(j)) {
    if (["color", "type", "name", "version", "meta"].includes(fam) || !Array.isArray(block?.tokens)) continue;
    for (const t of block.tokens) ds.other.push({ family: fam, name: t.name, value: String(t.value), usage: t.usage || "" });
  }
  for (const [k, v] of Object.entries(j.type?.families || {})) ds.families[k] = v.split(",")[0].replace(/["']/g, "").trim();
  ds.fonts = j.type?.fonts || [];
  ds.styles = (j.type?.groups || []).flatMap((g) => (g.styles || []).map((s) => ({ ...s, family: ds.families[s.family || g.family] })));
}

function readCss(file, text) {
  if (seen.has(file)) return;
  seen.add(file);
  for (const m of text.matchAll(/@import\s+(?:url\()?\s*(?:["']([^"']+)["']|([^"')\s;]+))/g)) {
    const href = m[1] ?? m[2];
    if (href.includes("fonts.googleapis.com")) addGoogle(href);
    else if (!/^https?:/.test(href)) addFile(path.resolve(path.dirname(file.split("#")[0]), href));
  }
  css.push({ text, file });
}

function readHtml(file, text) {
  if (seen.has(file)) return;
  seen.add(file);
  for (const m of text.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const href = m[1];
    if (href.includes("fonts.googleapis.com")) addGoogle(href.replace(/&amp;/g, "&"));
    else if (/stylesheet/i.test(m[0]) && !/^(https?:)?\/\//.test(href)) addFile(path.resolve(path.dirname(file), href.split("?")[0]));
  }
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) readCss(`${file}#style`, m[1]);
  // Inline style="--x: …" on <html>/<body> often carries the theme.
  for (const m of text.matchAll(/<(html|body)[^>]*style=["']([^"']*)["']/gi)) readCss(`${file}#${m[1]}`, `${m[1]}{${m[2]}}`);
}

function addFile(file) {
  if (!fs.existsSync(file)) return;
  const st = fs.statSync(file);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(file)) {
      if (["node_modules", ".git", "dist", "build", ".next"].includes(e)) continue;
      addFile(path.join(file, e));
    }
    return;
  }
  const ext = path.extname(file).toLowerCase();
  if (st.size > 3_000_000) return;
  const text = fs.readFileSync(file, "utf8");
  if (ext === ".css" || ext === ".scss") readCss(file, text);
  else if (ext === ".html" || ext === ".htm") readHtml(file, text);
  else if (ext === ".json" && /token|theme|design|color/i.test(path.basename(file))) {
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j?.color?.tokens)) readDesignSystem(j);
      else flatten(j, "", jsonTokens);
    } catch {}
  }
}

for (const i of inputs) addFile(path.resolve(i));

// ---- parse ---------------------------------------------------------------------------------

const vars = {}; // scope -> name -> raw
const fontFaces = [];
const families = {}; // family -> { count, selectors:Set }
const colorCount = {};
const radii = {};

function scopeName(sel, media) {
  const s = sel.replace(/\s+/g, " ").trim();
  const dark = /dark/i.test(s) || /prefers-color-scheme:\s*dark/i.test(media);
  if (/^(:root|html|body|:host)(,|$)/.test(s) || s === ":root, :host") return dark ? `${s} (dark)` : ":root";
  return media ? `${s} @${media.trim()}` : s;
}

function walk(text, file, media = "") {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  while (i < clean.length) {
    const open = clean.indexOf("{", i);
    if (open < 0) break;
    const head = clean.slice(i, open).trim();
    // find matching brace
    let depth = 1;
    let j = open + 1;
    while (j < clean.length && depth) {
      if (clean[j] === "{") depth++;
      else if (clean[j] === "}") depth--;
      j++;
    }
    const body = clean.slice(open + 1, j - 1);
    const sel = head.split(/[;}]/).pop().trim();
    if (/^@media|^@supports|^@layer/.test(sel)) walk(body, file, sel.startsWith("@media") ? sel.replace(/^@media/, "") : media);
    else if (/^@font-face/.test(sel)) {
      const get = (k) => (body.match(new RegExp(`${k}\\s*:\\s*([^;]+)`, "i")) || [])[1]?.trim();
      const srcs = [...(get("src") || "").matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
      const local = srcs
        .filter((s) => !/^(https?:|data:)/.test(s))
        .map((s) => path.resolve(path.dirname(file.split("#")[0]), s.split("?")[0]))
        .find((p) => fs.existsSync(p));
      fontFaces.push({
        family: (get("font-family") || "").replace(/["']/g, ""),
        weight: get("font-weight") || "400",
        style: get("font-style") || "normal",
        file: local || null,
        src: local ? undefined : srcs[0],
      });
    } else if (!sel.startsWith("@")) {
      const scope = scopeName(sel, media);
      for (const d of body.split(";")) {
        const k = d.indexOf(":");
        if (k < 0) continue;
        const prop = d.slice(0, k).trim();
        const val = d.slice(k + 1).trim().replace(/\s*!important$/, "");
        if (prop.startsWith("--")) (vars[scope] ??= {})[prop] = val;
        else if (prop === "font-family" || prop === "font") {
          const fam = (prop === "font" ? val.replace(/^.*?\d[\w%./]*\s+/, "") : val).split(",")[0].replace(/["']/g, "").trim();
          if (fam && !fam.startsWith("var(") && !/^(inherit|initial|unset)$/.test(fam)) {
            const f = (families[fam] ??= { count: 0, selectors: new Set() });
            f.count++;
            if (f.selectors.size < 8) f.selectors.add(sel.slice(0, 40));
          }
        } else if (prop === "border-radius" && /^\d/.test(val)) radii[val] = (radii[val] || 0) + 1;
        if (!prop.startsWith("--")) for (const c of val.match(COLOR_RE) || []) {
          const h = normColor(c);
          if (h) colorCount[h] = (colorCount[h] || 0) + 1;
        }
      }
    }
    i = j;
  }
}

for (const { text, file } of css) walk(text, file);

// Resolve var() chains against :root, then the scope itself.
function resolve(val, scope, depth = 0) {
  if (depth > 8) return val;
  return val.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fb) => {
    const v = vars[scope]?.[name] ?? vars[":root"]?.[name] ?? fb;
    return v == null ? `var(${name})` : resolve(v, scope, depth + 1);
  });
}

const outVars = {};
for (const [scope, entries] of Object.entries(vars)) {
  for (const [k, raw] of Object.entries(entries)) {
    const v = resolve(raw, scope);
    const hex = normColor(v);
    (outVars[scope] ??= {})[k] = hex && hex !== v.toLowerCase() ? `${hex}  (${v})` : v;
  }
}

// ---- suggest -------------------------------------------------------------------------------

// The light/default theme: :root plus every root-level theme scope that isn't dark
// (daisyUI's [data-theme=light], shadcn's :root, …), later scopes winning as in the cascade.
const isDark = (s) => /dark/i.test(s);
const isRootish = (s) => /:root|^html|^body|\[data-theme|\.theme-|^\.light\b/.test(s);
const root = Object.fromEntries(Object.entries(jsonTokens).map(([k, v]) => [`--${k.replace(/\./g, "-")}`, v]));
for (const [scope, entries] of Object.entries(vars)) if (isRootish(scope) && !isDark(scope)) Object.assign(root, entries);
vars[":root"] = root; // resolve() reads var() chains from here

const GENERIC = /^(ui-sans-serif|ui-serif|ui-monospace|system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|monospace|inherit|initial)$/i;
function pick(patterns, kind = "color") {
  for (const re of patterns) {
    for (const [k, raw] of Object.entries(root)) {
      if (!re.test(k)) continue;
      const v = resolve(raw, ":root");
      if (kind === "color") {
        const h = normColor(v);
        if (h) return { value: h, from: k };
      } else if (kind === "font") {
        const fam = v.split(",")[0].replace(/["']/g, "").trim();
        if (fam && !fam.startsWith("var(") && !GENERIC.test(fam)) return { value: fam, from: k };
      } else if (/^\d/.test(v)) return { value: v, from: k };
    }
  }
  return null;
}

const topFamilies = Object.entries(families).sort((a, b) => b[1].count - a[1].count);
const familyFor = (re) => topFamilies.find(([, f]) => [...f.selectors].some((s) => re.test(s)))?.[0];
const suggest = {
  primary: pick([/^--(color-)?(brand|primary)(-500|-600)?$/i, /^--(color-)?(brand|primary)\b(?!.*(fore|text|fg|on))/i, /accent$/i]),
  accent: pick([/^--(color-)?(accent|secondary|highlight)(-500)?$/i, /(accent|secondary|highlight)(?!.*(fore|text|fg))/i]),
  background: pick([/^--(color-)?(background|bg|canvas|surface|paper|page)(-default|-base|-primary)?$/i, /^--color-base-100$/, /(background|bg|surface|canvas)(?!.*(fore|text|muted|hover))/i]),
  text: pick([/^--(color-)?(foreground|fg|text|ink|body-text)(-default|-primary|-base)?$/i, /^--color-base-content$/, /(foreground|text|ink)(?!.*(muted|secondary|subtle|accent|on-))/i]),
  muted: pick([/(muted|subtle|secondary)-?(foreground|text|fg)|(text|fg|ink)-?(muted|subtle|secondary)/i]),
  font: pick([/^--(font-)?(sans|body|base|text|ui)(-family)?$/i, /font-(sans|body|base)/i], "font") ?? (familyFor(/^(body|html|:root)/) ? { value: familyFor(/^(body|html|:root)/), from: "body font-family" } : null),
  headlineFont: pick([/^--(font-)?(display|heading|headline|title|serif)(-family)?$/i, /font-(display|heading|headline)/i], "font") ?? (familyFor(/^h[1-3]|title|heading|display|hero/i) ? { value: familyFor(/^h[1-3]|title|heading|display|hero/i), from: "h1–h3 font-family" } : null),
  radius: pick([/^--(radius|rounded|border-radius)(-lg|-md|-card)?$/i, /radius/i], "size"),
};
// Design System tokens carry a usage note per token, which says more than the name does.
if (ds.colors.length) {
  const theme = ds.themes.find((t) => !/dark|night/i.test(t)) ?? ds.themes[0];
  const val = (t) => t.value[theme] ?? Object.values(t.value)[0];
  const find = (re, not) => {
    const t = ds.colors.find((c) => re.test(`${c.name} ${c.usage}`) && !(not && not.test(`${c.name} ${c.usage}`)) && normColor(val(c)));
    return t ? { value: val(t), from: `${t.name}: ${t.usage.slice(0, 60)}` } : null;
  };
  const dsSuggest = {
    background: find(/page (background|ground)|^(\S*-)?(background|bg|surface|ground)(-\S*)?\s|every screen starts/i, /raised|panel|card|hover/i),
    text: find(/primary text|body text|running copy|^(ink|text|foreground|fg)\s/i, /secondary|muted|on (magenta|cyan|yellow|pop|primary)|text on/i),
    muted: find(/secondary text|caption|muted|subtle/i),
    primary: find(/primary action|primary button|hero (hue|colou?r)|brand colou?r|^(\S*-)?(primary|brand)\s/i, /text on/i),
    accent: find(/secondary action|accent|highlight|links?\b/i, /text on/i),
  };
  const font = ds.styles?.find((s) => /body|text/i.test(s.name))?.family ?? ds.families.sans ?? ds.families.body;
  const head = ds.styles?.find((s) => /display|headline|title|h1/i.test(s.name))?.family ?? ds.families.display ?? ds.families.heading;
  if (font) dsSuggest.font = { value: font, from: "type: body style" };
  if (head) dsSuggest.headlineFont = { value: head, from: "type: display style" };
  const r = ds.other.find((t) => t.family === "radius" && /default|panel|card|container/i.test(t.usage)) ?? ds.other.find((t) => t.family === "radius");
  if (r) dsSuggest.radius = { value: r.value, from: `${r.name}: ${r.usage.slice(0, 60)}` };
  const sh = ds.other.find((t) => t.family === "shadow" && /card|panel|hero/i.test(t.usage));
  if (sh) dsSuggest.shadow = { value: sh.value, from: `${sh.name}: ${sh.usage.slice(0, 60)}` };
  for (const [k, v] of Object.entries(dsSuggest)) if (v) suggest[k] = v;
  suggest.themes = ds.themes;
  if (ds.themes.length === 1 && /dark|night/i.test(ds.themes[0] + (suggest.background?.value || ""))) suggest.note = "single dark theme: suits bold-dark";
  if (!ds.fonts.length && (font || head)) suggest.googleFontsHint = "no font files listed: these families are likely Google Fonts; load them with @remotion/google-fonts";
}

const faceFamily =fontFaces.find((f) => f.family && !/icon|symbol|emoji|awesome/i.test(f.family))?.family;
if (!suggest.font && faceFamily) suggest.font = { value: faceFamily, from: "@font-face" };
if (!suggest.headlineFont && topFamilies[0] && topFamilies[0][0] !== suggest.font?.value) suggest.headlineFont = { value: topFamilies[0][0], from: "most-used font-family" };
for (const k of Object.keys(suggest)) if (!suggest[k]) delete suggest[k];
const darkScopes = Object.keys(vars).filter((s) => /dark/i.test(s));
if (darkScopes.length) suggest.note = `has dark theme scopes: ${darkScopes.join(", ")}`;

console.log(
  JSON.stringify(
    {
      sources: [...seen],
      suggest,
      fontFaces,
      googleFonts: [...googleFonts],
      families: topFamilies.slice(0, 8).map(([family, f]) => ({ family, count: f.count, selectors: [...f.selectors] })),
      colors: Object.entries(colorCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([hex, count]) => ({ hex, count })),
      radii: Object.entries(radii).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v]) => v),
      vars: outVars,
      tokens: Object.keys(jsonTokens).length ? jsonTokens : undefined,
      designSystem: ds.colors.length ? { themes: ds.themes, colors: ds.colors, families: ds.families, fonts: ds.fonts, styles: ds.styles, other: ds.other } : undefined,
    },
    null,
    2,
  ),
);
