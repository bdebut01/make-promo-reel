// A static file server for filming a design (an HTML file, an exported artifact) in place of an
// app. Plain Node, no install, the same on every OS. Loading the page over http rather than
// file:// keeps relative fetches and web fonts working.
//   node <skill>/scripts/serve.mjs <folder> <port>
// Run it as a background task, like an app server, and stop it the same way.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const [dir, port] = process.argv.slice(2);
if (!dir || !port || !fs.existsSync(dir)) {
  console.error("usage: node serve.mjs <folder> <port>");
  process.exit(1);
}
const root = path.resolve(dir);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain",
};
http
  .createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (file !== root && !file.startsWith(root + path.sep)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`serving ${root} at http://127.0.0.1:${port}/`));
