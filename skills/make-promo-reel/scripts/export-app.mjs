// Export one commit of the user's checkout into a folder, without cloning it: for when a sandbox
// refuses `git clone --local` (it writes .git/config and hooks). It only reads the checkout.
//   node <skill>/scripts/export-app.mjs --src <checkout> --commit <sha|branch> --to <ws>/app
// Writes <ws>/app.commit next to the folder, which slim.mjs reads later. The tar that
// `git archive` writes is unpacked here in Node, not by a tar program: on Windows, the GNU tar
// that Git Bash puts first on PATH reads "C:\..." as a remote host and fails.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Unpack a tar archive (ustar with pax headers, as `git archive` writes) into `dest`. */
export function untar(buf, dest) {
  const root = path.resolve(dest);
  let pax = {};
  for (let off = 0; off + 512 <= buf.length; ) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a, b) => h.subarray(a, b).toString("utf8").replace(/\0.*$/s, "");
    const size = parseInt(str(124, 136).trim() || "0", 8);
    const type = String.fromCharCode(h[156] || 48);
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "x" || type === "g") {
      // pax records: "<len> key=value\n"
      if (type === "x") for (const m of body.toString("utf8").matchAll(/\d+ ([^=]+)=([^\n]*)\n/g)) pax[m[1]] = m[2];
      continue;
    }
    const prefix = str(345, 500);
    const name = pax.path ?? (prefix ? `${prefix}/${str(0, 100)}` : str(0, 100));
    const link = pax.linkpath ?? str(157, 257);
    pax = {};
    const out = path.resolve(root, name);
    if (out !== root && !out.startsWith(root + path.sep)) throw new Error(`untar: ${name} escapes ${root}`);
    if (type === "5") fs.mkdirSync(out, { recursive: true });
    else if (type === "0" || type === "7") {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, body, { mode: parseInt(str(100, 108).trim() || "644", 8) & 0o777 });
    } else if (type === "2") {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      try {
        fs.symlinkSync(link, out);
      } catch {
        // Windows without symlink rights: keep the link's target path as a file, as git does.
        fs.writeFileSync(out, link);
      }
    }
  }
}

/** `git archive` one commit of `src` into `to`; returns the full commit hash. */
export function exportApp({ src, commit, to }) {
  const sha = execFileSync("git", ["-C", src, "rev-parse", `${commit}^{commit}`], { encoding: "utf8" }).trim();
  const tar = execFileSync("git", ["-C", src, "archive", "--format=tar", sha], { maxBuffer: 2 ** 31 - 1 });
  fs.mkdirSync(to, { recursive: true });
  untar(tar, to);
  return sha;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const arg = (k) => {
    const i = process.argv.indexOf(`--${k}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const [src, commit = "HEAD", to] = [arg("src"), arg("commit"), arg("to")];
  if (!src || !to) {
    console.error("usage: node export-app.mjs --src <checkout> [--commit <sha|branch>] --to <ws>/app");
    process.exit(1);
  }
  if (fs.existsSync(to) && fs.readdirSync(to).length) {
    console.error(`export-app: ${to} isn't empty`);
    process.exit(1);
  }
  const sha = exportApp({ src, commit, to });
  fs.writeFileSync(path.join(path.dirname(path.resolve(to)), "app.commit"), sha + "\n");
  console.log(`exported ${sha.slice(0, 7)} into ${to}; wrote app.commit`);
}
