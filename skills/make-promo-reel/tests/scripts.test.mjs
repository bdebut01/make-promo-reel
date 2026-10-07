// Tests for the skill's Node scripts, run on macOS, Linux and Windows in CI:
//   node --test skills/make-promo-reel/tests/
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { guard } from "../scripts/guard.mjs";

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "promo-test-")));
const node = (script, args, env = {}) => execFileSync(process.execPath, [path.join(scripts, script), ...args], { encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("guard passes workspace paths and refuses everything else", () => {
  const t = tmp();
  const ws = path.join(t, "ws");
  const src = path.join(t, "src");
  fs.mkdirSync(path.join(ws, "app"), { recursive: true });
  fs.mkdirSync(src);
  const env = { ws, src };
  const ok = (targets, o = {}) => assert.doesNotThrow(() => guard(targets, { ...env, ...o }));
  const no = (targets, o = {}) => assert.throws(() => guard(targets, { ...env, ...o }), { name: "Error" });

  ok([path.join(ws, "app", "db.sqlite3")]);
  ok([path.join(ws, "app", "media"), path.join(ws, "studio", "out")]);
  ok(["weekly_promo"], { db: true });
  no([path.join(src, "db.sqlite3")]);
  no([path.join(ws, "..", "src", "db.sqlite3")]);
  no([path.join(t, "elsewhere")]);
  no([ws]);
  no(["weekly"], { db: true });
  no(["weekly_promo_old"], { db: true });
  no([path.join(src, "inner", "x")], { ws: path.join(src, "inner") });
  no([path.join(ws, "x")], { ws: t });
  no([path.join(ws, "x")], { ws: "" });
  no([path.join(ws, "x")], { ws: os.homedir() });
  // Case differences don't get a path out of the checkout where the file system ignores case.
  if (process.platform !== "linux") no([path.join(src.toUpperCase(), "db.sqlite3")]);
  // A link inside the workspace that points into the checkout is followed, and refused.
  try {
    fs.symlinkSync(src, path.join(ws, "app", "link-to-src"), "junction");
    no([path.join(ws, "app", "link-to-src", "db.sqlite3")]);
  } catch (e) {
    if (e.code !== "EPERM") throw e; // Windows without symlink rights
  }
  fs.rmSync(t, { recursive: true, force: true });
});

test("guard CLI exits 1 with a reason", () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, "ws"));
  fs.mkdirSync(path.join(t, "src"));
  const flags = ["--ws", path.join(t, "ws"), "--src", path.join(t, "src")];
  assert.equal(node("guard.mjs", [...flags, path.join(t, "ws", "a")]), "");
  assert.throws(() => node("guard.mjs", [...flags, path.join(t, "src", "a")]), /REFUSED/);
  assert.throws(() => node("guard.mjs", [...flags, "--db", "weekly"]), /REFUSED/);
  fs.rmSync(t, { recursive: true, force: true });
});

function checkout(t) {
  const src = path.join(t, "src");
  fs.mkdirSync(src);
  git(src, "init", "-q");
  fs.writeFileSync(path.join(src, "app.txt"), "one\n");
  fs.writeFileSync(path.join(src, "gone.txt"), "bye\n");
  git(src, "add", ".");
  git(src, "commit", "-qm", "init");
  return src;
}

test("slim saves a clone's edits and rebuild-app.mjs restores them", () => {
  const t = tmp();
  const src = checkout(t);
  const ws = path.join(t, "work");
  fs.mkdirSync(path.join(ws, "studio", "out"), { recursive: true });
  git(t, "clone", "-q", "--local", src, path.join(ws, "app"));
  fs.writeFileSync(path.join(ws, "app", "app.txt"), "two\n");
  fs.writeFileSync(path.join(ws, "app", "new.txt"), "new\n");
  fs.writeFileSync(path.join(ws, "app", ".env"), "KEY=local\n");
  const flags = ["--ws", ws, "--src", src];
  assert.match(node("slim.mjs", [...flags, "--dry-run"]), /would remove: app/);
  assert.ok(fs.existsSync(path.join(ws, "app")), "dry run removed nothing");
  node("slim.mjs", flags);
  assert.ok(!fs.existsSync(path.join(ws, "app")) && !fs.existsSync(path.join(ws, "studio", "out")));
  execFileSync(process.execPath, [path.join(ws, "rebuild-app.mjs")], { stdio: "ignore" });
  assert.equal(fs.readFileSync(path.join(ws, "app", "app.txt"), "utf8").replace(/\r/g, ""), "two\n");
  assert.equal(fs.readFileSync(path.join(ws, "app", "new.txt"), "utf8").replace(/\r/g, ""), "new\n");
  assert.equal(fs.readFileSync(path.join(ws, "app", ".env"), "utf8"), "KEY=local\n");
  fs.rmSync(t, { recursive: true, force: true });
});

test("slim saves an exported copy's edits and rebuild-app.mjs restores them", () => {
  const t = tmp();
  const src = checkout(t);
  const ws = path.join(t, "work");
  const app = path.join(ws, "app");
  fs.mkdirSync(app, { recursive: true });
  const commit = git(src, "rev-parse", "HEAD").trim();
  fs.writeFileSync(path.join(ws, "app.commit"), commit + "\n");
  git(src, "archive", "--format=tar", "-o", path.join(t, "a.tar"), commit);
  execFileSync("tar", ["-xf", path.join(t, "a.tar"), "-C", app]);
  fs.writeFileSync(path.join(app, "app.txt"), "two\n");
  fs.rmSync(path.join(app, "gone.txt"));
  fs.mkdirSync(path.join(app, "node_modules"));
  fs.writeFileSync(path.join(app, "node_modules", "big.js"), "x");
  node("slim.mjs", [], { PROMO_WS: ws, PROMO_SRC: src }); // the environment works too
  assert.ok(!fs.existsSync(app));
  assert.ok(!fs.existsSync(path.join(ws, "app-changes", "node_modules")), "installs aren't saved");
  execFileSync(process.execPath, [path.join(ws, "rebuild-app.mjs")], { stdio: "ignore" });
  assert.equal(fs.readFileSync(path.join(app, "app.txt"), "utf8"), "two\n");
  assert.ok(!fs.existsSync(path.join(app, "gone.txt")));
  fs.rmSync(t, { recursive: true, force: true });
});

test("port and serve: free, wait, who, stop", async () => {
  const t = tmp();
  fs.writeFileSync(path.join(t, "index.html"), "<h1>hi</h1>");
  const port = String(20000 + Math.floor(Math.random() * 20000));
  assert.match(node("port.mjs", ["free", port]), /is free/);
  const server = spawn(process.execPath, [path.join(scripts, "serve.mjs"), t, port], { stdio: "ignore" });
  try {
    assert.match(node("port.mjs", ["wait", port, "/", "--timeout", "20"]), /answered 200/);
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.equal(html, "<h1>hi</h1>");
    assert.equal((await fetch(`http://127.0.0.1:${port}/..%2f..%2fetc`)).status >= 400, true);
    assert.throws(() => node("port.mjs", ["free", port]));
    assert.match(node("port.mjs", ["who", port]), new RegExp(String(server.pid)));
    assert.match(node("port.mjs", ["stop", port]), /is free/);
  } finally {
    server.kill();
    fs.rmSync(t, { recursive: true, force: true });
  }
});
