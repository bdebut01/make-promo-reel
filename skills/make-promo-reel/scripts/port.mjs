// Ports for the app copy's servers, the same on macOS, Linux and Windows:
//   node <skill>/scripts/port.mjs free 8123            exit 0 if nothing listens on 8123, else 1
//   node <skill>/scripts/port.mjs wait 8123 [/path]    poll until it answers (any status under
//                                                      500, so a redirect to login counts), up to
//                                                      --timeout seconds (default 120)
//   node <skill>/scripts/port.mjs who 8123             print the PIDs listening on 8123
//   node <skill>/scripts/port.mjs stop 8123            stop them, and wait until the port is free
// Stop by port, not by the PID you started: `npm run`, `uv run` and `bundle exec` are wrappers,
// and killing the wrapper can leave the real server holding the port. Only stop ports you
// started for this reel and recorded in notes.md; the user's own servers are theirs.
import { execFileSync } from "node:child_process";
import net from "node:net";

const [cmd, portArg, pathArg = "/"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const port = Number(portArg);
const timeoutArg = process.argv.indexOf("--timeout");
const timeout = timeoutArg > 0 ? Number(process.argv[timeoutArg + 1]) : 120;
if (!cmd || !port) {
  console.error("usage: node port.mjs free|wait|who|stop <port> [path] [--timeout seconds]");
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const free = () =>
  new Promise((done) => {
    const s = net.createServer();
    s.once("error", () => done(false));
    s.listen(port, "127.0.0.1", () => s.close(() => done(true)));
  });

function who() {
  const run = (c, a) => {
    try {
      return execFileSync(c, a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return "";
    }
  };
  if (process.platform === "win32") {
    // netstat -ano: "  TCP    127.0.0.1:8123    0.0.0.0:0    LISTENING    4812"
    return [...new Set(run("netstat", ["-ano", "-p", "TCP"]).split(/\r?\n/).filter((l) => /LISTENING/.test(l) && new RegExp(`:${port}\\s`).test(l)).map((l) => l.trim().split(/\s+/).pop()))].filter((p) => p && p !== "0");
  }
  return run("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"]).split(/\s+/).filter(Boolean);
}

if (cmd === "free") {
  const ok = await free();
  console.log(ok ? `port ${port} is free` : `port ${port} is in use`);
  process.exit(ok ? 0 : 1);
} else if (cmd === "wait") {
  const end = Date.now() + timeout * 1000;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${pathArg}`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      if (res.status < 500) {
        console.log(`port ${port} answered ${res.status}`);
        process.exit(0);
      }
    } catch {}
    if (Date.now() > end) {
      console.error(`port ${port} didn't answer within ${timeout}s; check the server's log`);
      process.exit(1);
    }
    await sleep(1000);
  }
} else if (cmd === "who") {
  console.log(who().join("\n") || `nothing listens on ${port}`);
} else if (cmd === "stop") {
  const pids = who();
  if (!pids.length) {
    console.log(`nothing listens on ${port}`);
    process.exit(0);
  }
  for (const pid of pids) {
    try {
      if (process.platform === "win32") execFileSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
      else process.kill(Number(pid), "SIGTERM");
    } catch {}
  }
  for (let i = 0; i < 20 && !(await free()); i++) await sleep(250);
  if (!(await free())) for (const pid of who()) try { process.kill(Number(pid), "SIGKILL"); } catch {}
  const ok = await free();
  console.log(ok ? `stopped ${pids.join(", ")}; port ${port} is free` : `port ${port} is still in use`);
  process.exit(ok ? 0 : 1);
} else {
  console.error(`port: unknown command ${cmd}`);
  process.exit(2);
}
