// Local stand-in for the Cloudflare Worker (Darkroom + Finder routes) — for testing on your own machine.
//   node scripts/dev-worker.mjs   → http://localhost:8787   (admin key: local-admin-key-123456)
//   AI_ENDPOINT=http://localhost:8787 npm run build && npm run serve
import http from 'node:http';
import worker from '../worker/finder-ai/src/index.js';
import { d1 } from '../tests/lib/d1-sqlite.mjs';

const env = { DB: d1(process.env.DB_FILE || ':memory:'), ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'local-admin-key-123456', HASH_SALT: 'dev', ALLOWED_ORIGINS: 'http://localhost:4321' };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = { ...req.headers, 'cf-connecting-ip': req.headers['x-test-ip'] || req.socket.remoteAddress };
  const r = await worker.fetch(new Request(`http://localhost:8787${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8787, () => console.log('dev worker on http://localhost:8787'));
