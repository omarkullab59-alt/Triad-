#!/usr/bin/env node
// Tiny static server for dist/ (zero dependencies).  PORT=4321 node scripts/serve.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const PORT = Number(process.env.PORT) || 4321;
let BASE = process.env.BASE_PATH || '/';
if (!BASE.endsWith('/')) BASE += '/';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.yml': 'text/yaml',
};

export function serve() {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (!url.startsWith(BASE)) {
      res.writeHead(302, { Location: BASE });
      return res.end();
    }
    url = '/' + url.slice(BASE.length);
    let file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => console.log(`TRIAD ▲ http://localhost:${PORT}${BASE}`));
  return server;
}

if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serve();
