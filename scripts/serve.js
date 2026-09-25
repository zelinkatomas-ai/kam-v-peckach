// Jednoduchý lokální server pro vývoj: node scripts/serve.js  ->  http://localhost:5173
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "docs");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";                       // /obchody/ -> /obchody/index.html, jako na Cloudflare
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(5173, () => console.log("http://localhost:5173"));
