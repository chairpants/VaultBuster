// ponytail: node:http static server — replaces `npx serve`, no dependencies
const http = require("http"), fs = require("fs"), path = require("path");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm" };
const PORT = 5000;
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(__dirname, p);
  if (f !== __dirname && !f.startsWith(__dirname + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
}).listen(PORT, () => console.log(`VaultBuster running:  http://localhost:${PORT}  (Ctrl+C to stop)`));