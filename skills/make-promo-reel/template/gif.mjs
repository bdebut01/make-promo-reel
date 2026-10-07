// GIF from a rendered cut, for READMEs, docs and anywhere video doesn't autoplay. It uses a
// palette made from the whole clip, so UI colors and text stay clean, with Remotion's bundled
// ffmpeg (which has no fps filter, so the output rate is set with -r).
//   node gif.mjs out/weekly-reel-16x9.mp4 out/weekly-reel.gif            → 800px wide, 15 fps
//   node gif.mjs out/weekly-reel-16x9.mp4 out/weekly-reel.gif 640 12
// GitHub shows GIFs up to 10 MB inline; aim for under 5 MB. When a GIF is too big, shorten the
// cut first, then lower the width or the fps.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Remotion's bundled ffmpeg, run through its CLI with this Node, so no shell or npx is needed
// (Windows can't spawn npx.cmd directly).
const require = createRequire(import.meta.url);
const cliPkg = require.resolve("@remotion/cli/package.json");
const cli = path.join(path.dirname(cliPkg), JSON.parse(fs.readFileSync(cliPkg, "utf8")).bin.remotion);
const ffmpeg = (args) => spawnSync(process.execPath, [cli, "ffmpeg", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });

const [input, output, width = "800", fps = "15"] = process.argv.slice(2);
if (!input || !output || !fs.existsSync(input)) {
  console.error("usage: node gif.mjs <rendered.mp4> <out.gif> [width=800] [fps=15]");
  process.exit(1);
}
const graph = `[0:v]scale=${Number(width)}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
const run = ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-filter_complex", graph, "-r", String(Number(fps)), "-loop", "0", output]);
if (run.status !== 0 || !fs.existsSync(output)) {
  console.error(`gif: ffmpeg failed\n${run.stderr}`);
  process.exit(1);
}
const mb = fs.statSync(output).size / 1e6;
console.log(`${output}: ${width}px, ${fps} fps, ${mb.toFixed(1)} MB${mb > 10 ? " (over GitHub's 10 MB inline limit)" : mb > 5 ? " (over 5 MB: consider a shorter cut, a smaller width or a lower fps)" : ""}`);
