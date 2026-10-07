// Refuses to let a destructive step touch anything outside the promo workspace.
//
//   node <skill>/scripts/guard.mjs --ws <reel>/work --src <checkout> <reel>/work/app/db.sqlite3 …
//   node <skill>/scripts/guard.mjs --ws <reel>/work --src <checkout> --db weekly_promo
//
// --ws is the reel's work/ folder; --src is the user's own checkout, never a target. It exits 1
// with the reason on a refusal, so a script stops there.
//
// Each path is resolved (symlinks and ..) before checking, and a path that doesn't exist yet is
// resolved through its nearest existing parent. It passes only when it is inside --ws and
// not inside --src. With --db NAME, it checks a database name instead: it must end in
// _promo, so a dropdb or flush can never hit the user's dev database. Plain Node, so it runs the
// same on macOS, Linux and Windows. Other scripts import guard() directly.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// macOS and Windows file systems ignore case by default, so compare paths the same way.
const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);

export function resolve(p) {
  let head = path.resolve(p.replace(/^~(?=$|[\\/])/, os.homedir()));
  const tail = [];
  while (!fs.existsSync(head)) {
    const parent = path.dirname(head);
    if (parent === head) break;
    tail.unshift(path.basename(head));
    head = parent;
  }
  return path.join(fs.realpathSync.native(head), ...tail);
}

const inside = (child, parent) => {
  const c = fold(child);
  const p = fold(parent);
  return c === p || c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
};

// --ws and --src set the workspace and checkout on the command line, in any shell; PROMO_WS and
// PROMO_SRC in the environment work too.
export function takeFlags(args) {
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ws") process.env.PROMO_WS = args[++i];
    else if (args[i] === "--src") process.env.PROMO_SRC = args[++i];
    else rest.push(args[i]);
  }
  return rest;
}

export class Refused extends Error {}

/** Throws Refused unless every target is safe to delete. `db: true` checks database names. */
export function guard(targets, { ws = process.env.PROMO_WS, src = process.env.PROMO_SRC, db = false } = {}) {
  const no = (msg) => {
    throw new Refused(msg);
  };
  if (!ws) no("--ws (the reel's work/ folder) is not set");
  if (!src) no("--src (the user's checkout) is not set");
  if (!targets.length) no("no paths given");
  const w = resolve(ws);
  const s = resolve(src);
  if (inside(w, s)) no(`PROMO_WS (${w}) is inside the user's checkout (${s})`);
  if (inside(s, w)) no(`PROMO_WS (${w}) contains the user's checkout (${s}): use a per-promo folder`);
  if (path.dirname(w) === w || fold(w) === fold(resolve(os.homedir()))) no(`PROMO_WS (${w}) is too broad`);
  if (db) {
    for (const name of targets) if (!/_promo$/.test(name)) no(`database '${name}' doesn't end in _promo`);
    return;
  }
  for (const t of targets) {
    const r = resolve(t);
    if (inside(r, s)) no(`${t} resolves into the user's checkout (${r})`);
    if (!inside(r, w)) no(`${t} resolves outside the workspace (${r})`);
    if (fold(r) === fold(w)) no(`${t} is the workspace itself`);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = takeFlags(process.argv.slice(2));
  const db = args[0] === "--db";
  try {
    guard(db ? args.slice(1) : args, { db });
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    console.error(`guard: REFUSED — ${e.message}`);
    process.exit(1);
  }
}
