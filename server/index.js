// Photosynthesis World: oyunu ve gerçek zamanlı WebSocket sunucusunu tek adreste verir.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { connect, disconnect, handle, counts, stats } from './rooms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const MAX_PER_IP = Number(process.env.MAX_PER_IP) || 200;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const cache = new Map();
const DEV = process.env.NODE_ENV !== 'production';

// Yalnızca oyun dosyaları sunulur; sunucu kodu, .git ve benzeri asla açılmaz.
const allowed = u => u === '/index.html' || (/^\/(src|vendor)\/[\w./-]+\.(js|css)$/.test(u) && !u.includes('..'));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, ...counts() })); }
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!allowed(file)) { res.writeHead(404); return res.end('Bulunamadı'); }
  try {
    let e = !DEV && cache.get(file);
    if (!e) { const raw = await readFile(path.join(ROOT, file)); e = { raw, gz: gzipSync(raw), type: TYPES[path.extname(file)] }; cache.set(file, e); }
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, { 'content-type': e.type, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
    res.end(req.method === 'HEAD' ? undefined : gz ? e.gz : e.raw);
  } catch { res.writeHead(404); res.end('Bulunamadı'); }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048, perMessageDeflate: false });
const ipCount = new Map();
wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
  const n = (ipCount.get(ip) || 0) + 1;
  if (n > MAX_PER_IP) return ws.close(4004, 'too many');
  ipCount.set(ip, n);
  connect(ws); ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (d, bin) => { if (!bin) handle(ws, d.toString()); });
  ws.on('error', () => {});
  ws.on('close', () => { const c = (ipCount.get(ip) || 1) - 1; c ? ipCount.set(ip, c) : ipCount.delete(ip); disconnect(ws.player, ws); });
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);

server.listen(PORT, () => console.log(`Photosynthesis World: http://localhost:${PORT}`));
if (process.env.STATS) setInterval(() => { console.log({ ...counts(), ...stats, rssMB: Math.round(process.memoryUsage().rss / 1e6) }); stats.sent = stats.bytes = 0; }, 2000);
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { for (const c of wss.clients) c.close(1012, 'restart'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 500); });
