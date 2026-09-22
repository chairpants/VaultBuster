// Tiny static server, no deps: serves VaultBuster itself, and /art/* out of
// art/ (the repo's own downscaled copy) unless VAULTVISION_ART points
// elsewhere, e.g. back at the full-res VaultVision library.
// node server.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = +(process.argv[2] ?? 8123);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART = path.resolve(process.env.VAULTVISION_ART ?? path.join(HERE, "art"));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".css": "text/css" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let file = p.startsWith("/art/")
    ? path.join(ART, p.slice(5))
    : path.join(HERE, p === "/" ? "index.html" : p);
  const inHere = file === HERE || file.startsWith(HERE + path.sep);
  const inArt = file === ART || file.startsWith(ART + path.sep);
  if (!inHere && !inArt) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`VaultBuster open → http://localhost:${PORT}`));