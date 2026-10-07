// Shrink a finished reel's workspace to what spot fixes need, so the app copy and installs don't
// sit on disk for every reel. Everything removed can be rebuilt:
//
//   kept      studio source, promo.json, captures (frames + manifests), brand assets, seed,
//             reset and shot scripts, notes.md
//   saved     app.commit, the copy's edits (app.patch for a clone; app-changes/ and
//             app-deleted.txt for an exported copy), app-extra/ (a clone's untracked files),
//             app-env/ (its .env files), and rebuild-app.mjs, which recreates app/ from them
//   removed   app/, studio/node_modules, studio/out, logs/, saved login states
//
//   node <skill>/scripts/slim.mjs --ws <reel>/work --src <checkout> --dry-run   # show what would happen
//   node <skill>/scripts/slim.mjs --ws <reel>/work --src <checkout>
//
// Afterwards: copy or timing fixes need `npm ci` in studio/; re-filming needs
// `node rebuild-app.mjs`, then setup (notes.md). Plain Node and git, so it runs on macOS,
// Linux and Windows.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exportApp, untar } from "./export-app.mjs";
import { guard, Refused, takeFlags } from "./guard.mjs";

const dry = takeFlags(process.argv.slice(2)).includes("--dry-run");
const ws = process.env.PROMO_WS;
if (!ws || !fs.existsSync(ws)) {
  console.error("slim: --ws must be the reel's work/ folder");
  process.exit(1);
}
const at = (...p) => path.join(ws, ...p);
const app = at("app");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
const hasCommit = (src, c) => {
  try {
    git("-C", src, "cat-file", "-e", `${c}^{commit}`);
    return true;
  } catch {
    return false;
  }
};
function size(p) {
  const st = fs.lstatSync(p, { throwIfNoEntry: false });
  if (!st || st.isSymbolicLink()) return 0;
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((n, f) => n + size(path.join(p, f)), 0);
}
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const isEnv = (f) => /^\.env/.test(f) && !f.endsWith(".example");
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
};
const before = size(ws);

// What an exported copy's diff ignores: installs, builds, databases and media are rebuilt by
// setup and the seed.
const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "venv", "__pycache__", "media", "uploads", "build", "dist", ".next", "staticfiles"]);
const SKIP_FILE = (f) => /\.(pyc|sqlite3|db|log)$/.test(f) || isEnv(f);
function files(root, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...files(root, r));
    } else if (e.isFile() && !SKIP_FILE(e.name)) out.push(r);
  }
  return out;
}

function writeRebuild(body) {
  fs.writeFileSync(
    at("rebuild-app.mjs"),
    `// Recreates app/ as it was filmed: the filmed commit from the user's checkout, plus this
// reel's edits and local env. Then run setup (setup.sh or notes.md) to install and seed.
//   node rebuild-app.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const at = (...p) => path.join(here, ...p);
const run = (cmd, ...args) => execFileSync(cmd, args, { stdio: "inherit" });
const src = ${JSON.stringify(process.env.PROMO_SRC || "")};
const commit = fs.readFileSync(at("app.commit"), "utf8").trim();
if (fs.existsSync(at("app"))) throw new Error("app/ already exists");
${body}
if (fs.existsSync(at("app-env"))) fs.cpSync(at("app-env"), at("app"), { recursive: true });
console.log(\`app/ rebuilt at \${commit.slice(0, 7)}. Next: setup (setup.sh or notes.md)\`);
`,
  );
}

if (fs.existsSync(path.join(app, ".git"))) {
  const commit = git("-C", app, "rev-parse", "HEAD").trim();
  // Rebuild from the user's checkout: the clone's origin can be a path that has since moved.
  let src = process.env.PROMO_SRC;
  if (!src) src = git("-C", app, "remote", "get-url", "origin").trim();
  if (!hasCommit(src, commit)) console.warn(`slim: warning: ${src} doesn't have ${commit}; rebuild-app.mjs will need a source that does`);
  const untracked = git("-C", app, "ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean);
  const tracked = new Set(git("-C", app, "ls-files", "-z").split("\0"));
  const envs = fs.readdirSync(app).filter((f) => isEnv(f) && !tracked.has(f));
  process.env.PROMO_SRC ||= src;
  if (dry) {
    console.log(`would save: app.commit (${commit}), app.patch (${git("-C", app, "diff", "--stat").trim().split("\n").pop() || "no edits"})`);
    for (const f of untracked) console.log(`would save untracked: ${f}`);
    for (const f of envs) console.log(`would save env: ${f}`);
  } else {
    fs.writeFileSync(at("app.commit"), commit + "\n");
    fs.writeFileSync(at("app.patch"), git("-C", app, "diff", "--binary"));
    for (const d of ["app-extra", "app-env"]) fs.rmSync(at(d), { recursive: true, force: true });
    for (const f of untracked) copy(path.join(app, f), at("app-extra", f));
    for (const f of envs) copy(path.join(app, f), at("app-env", f));
    writeRebuild(`run("git", "clone", "--local", "--no-checkout", src, at("app"));
run("git", "-C", at("app"), "checkout", "-q", commit);
if (fs.statSync(at("app.patch")).size) run("git", "-C", at("app"), "apply", at("app.patch"));
if (fs.existsSync(at("app-extra"))) fs.cpSync(at("app-extra"), at("app"), { recursive: true });`);
    console.log("saved app.commit, app.patch, app-extra/, app-env/, rebuild-app.mjs");
  }
} else if (fs.existsSync(app) && fs.existsSync(at("app.commit"))) {
  // A copy exported with `git archive` (a sandbox can refuse a clone): no .git, so its edits
  // are found by comparing it with a fresh export of the same commit.
  const commit = fs.readFileSync(at("app.commit"), "utf8").trim();
  const src = process.env.PROMO_SRC;
  if (!src || !hasCommit(src, commit)) {
    console.error(`slim: --src must be a checkout that has ${commit}`);
    process.exit(1);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "slim-"));
  const fresh = path.join(tmp, "a");
  exportApp({ src, commit, to: fresh });
  const now = files(app);
  const then = new Set(files(fresh));
  const changed = now.filter((f) => !then.has(f) || !fs.readFileSync(path.join(app, f)).equals(fs.readFileSync(path.join(fresh, f))));
  const deleted = [...then].filter((f) => !fs.existsSync(path.join(app, f)));
  const envs = fs.readdirSync(app).filter(isEnv);
  if (dry) {
    console.log(`would save: app.commit (${commit}, exported copy), ${changed.length} changed or new files, ${deleted.length} deleted`);
    for (const f of envs) console.log(`would save env: ${f}`);
  } else {
    for (const d of ["app-changes", "app-env"]) fs.rmSync(at(d), { recursive: true, force: true });
    for (const f of changed) copy(path.join(app, f), at("app-changes", f));
    fs.writeFileSync(at("app-deleted.txt"), deleted.map((f) => f.split(path.sep).join("/")).join("\n"));
    for (const f of envs) copy(path.join(app, f), at("app-env", f));
    // The unpacker goes into the script itself, so rebuild-app.mjs doesn't depend on where the
    // skill is installed (and never on a tar program; see export-app.mjs).
    writeRebuild(`${untar.toString()}
fs.mkdirSync(at("app"));
untar(execFileSync("git", ["-C", src, "archive", "--format=tar", commit], { maxBuffer: 2 ** 31 - 1 }), at("app"));
if (fs.existsSync(at("app-changes"))) fs.cpSync(at("app-changes"), at("app"), { recursive: true });
for (const f of fs.readFileSync(at("app-deleted.txt"), "utf8").split("\\n").filter(Boolean)) fs.rmSync(at("app", f), { force: true });`);
    console.log(`saved app.commit, app-changes/ (${changed.length} files), app-deleted.txt, app-env/, rebuild-app.mjs`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

const studio = at("studio");
const logins = fs.existsSync(studio) ? fs.readdirSync(studio).filter((f) => /^auth.*\.json$|\.auth\.json$/.test(f)).map((f) => path.join(studio, f)) : [];
const targets = [app, path.join(studio, "node_modules"), path.join(studio, "out"), at("logs"), ...logins].filter((t) => fs.existsSync(t));
if (!targets.length) {
  console.log("nothing to remove");
  process.exit(0);
}
try {
  guard(targets);
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  console.error(`guard: REFUSED — ${e.message}`);
  process.exit(1);
}
if (dry) {
  for (const t of targets) console.log(`would remove: ${path.relative(ws, t)} (${mb(size(t))})`);
  console.log(`now ${mb(before)}`);
} else {
  for (const t of targets) fs.rmSync(t, { recursive: true, force: true });
  console.log(`slimmed ${mb(before)} -> ${mb(size(ws))}`);
}
