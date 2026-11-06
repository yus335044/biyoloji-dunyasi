// Yük testi ve test botu.
//   node server/test/load.mjs [odaSayısı] [odaBaşınaOyuncu] [saniye] [port]
//   node server/test/load.mjs --join KOD [port]   → tek bot odaya katılır, dolaşır, ardından dev bitkiye girer
import WebSocket from 'ws';
import { buildGrid, height, SECRET } from '../../src/world/height.js';
buildGrid(150);
const a = process.argv.slice(2), joinMode = a[0] === '--join';
const PORT = joinMode ? (a[2] || 8080) : (a[3] || 8080), URL = `ws://localhost:${PORT}/ws`;
const wait = ms => new Promise(r => setTimeout(r, ms));
const rtts = []; let snaps = 0, bytes = 0;
function bot(name) {
  return new Promise(res => {
    const ws = new WebSocket(URL), b = { ws, x: 0, z: 0, ang: Math.random() * 6.28, q: [] };
    b.send = m => ws.readyState === 1 && ws.send(JSON.stringify(m));
    ws.on('message', d => { bytes += d.length; const m = JSON.parse(d); if (m.t === 'snap') snaps++; if (m.t === 'pong') rtts.push(performance.now() - m.c); if (m.t === 'joined') { b.code = m.code; b.x = m.spawn.x; b.z = m.spawn.z; b.onJoin?.(); } if (m.t === 'started') b.started = true; if (m.t === 'welcome') res(b); });
    ws.on('open', () => b.send({ t: 'hello', name, have: 15 }));
    ws.on('error', () => {});
  });
}
const walk = (b, sp = 7) => { b.ang += (Math.random() - .5) * .25; const nx = b.x + Math.sin(b.ang) * sp * .066, nz = b.z + Math.cos(b.ang) * sp * .066; if (Math.hypot(nx, nz) > 14) { b.ang += 3; return; } b.x = nx; b.z = nz; b.send({ t: 's', v: [+b.x.toFixed(2), +height(b.x, b.z).toFixed(2), +b.z.toFixed(2), +b.ang.toFixed(2) % 3.14, sp, 3] }); };

if (joinMode) {
  const b = await bot('Test Botu'); const ok = new Promise(r => { b.onJoin = r; }); b.send({ t: 'join', code: a[1] }); await ok; b.send({ t: 'ready', v: true });
  while (!b.started) await wait(100);
  console.log('Bot oyunda'); const t0 = Date.now(); const iv = setInterval(() => walk(b), 66); await wait(6000); clearInterval(iv);
  const [px, pz] = SECRET.plant; for (let k = 0; k < 40; k++) { const dx = px + 3 - b.x, dz = pz + 3 - b.z, d = Math.hypot(dx, dz); if (d < 2) break; const s = Math.min(d, 2.5); b.x += dx / d * s; b.z += dz / d * s; b.send({ t: 's', v: [+b.x.toFixed(2), +height(b.x, b.z).toFixed(2), +b.z.toFixed(2), 0, 8, 3] }); await wait(300); }
  b.send({ t: 'lvl', l: 'plant', x: 0, y: 0, z: 4 }); console.log('Bot dev bitkide'); await wait(4000);
  b.send({ t: 'lvl', l: 'world', x: px + 3, y: 0, z: pz + 3 }); console.log('Bot dünyaya döndü'); await wait(2000);
  b.send({ t: 'emote', i: 1 }); await wait(500); b.send({ t: 'leave' }); await wait(300); console.log('Bot ayrıldı'); process.exit(0);
}
const [R = 1, N = 30, S = 10] = a.map(Number);
const all = [];
for (let r = 0; r < R; r++) {
  const h = await bot('Kurucu'); const o = new Promise(x => { h.onJoin = x; }); h.send({ t: 'create', cap: Math.max(N, 2), name: 'Yük' }); await o; all.push(h);
  for (let i = 1; i < N; i++) { const b = await bot('Bot' + i); const q = new Promise(x => { b.onJoin = x; }); b.send({ t: 'join', code: h.code }); await q; b.send({ t: 'ready', v: true }); all.push(b); }
  await wait(50); h.send({ t: 'start' });
}
await wait(300); const iv = setInterval(() => all.forEach(b => walk(b)), 66), pv = setInterval(() => all.forEach(b => b.send({ t: 'ping', c: performance.now() })), 1000);
snaps = bytes = 0; const t0 = performance.now(); await wait(S * 1000); clearInterval(iv); clearInterval(pv);
const secs = (performance.now() - t0) / 1000; rtts.sort((x, y) => x - y);
console.log(`${R} oda × ${N} oyuncu: kişi başı ${(snaps / all.length / secs).toFixed(1)} güncelleme/sn, ${(bytes / all.length / secs / 1024).toFixed(1)} KB/sn; ping p50 ${rtts[rtts.length >> 1]?.toFixed(1)} ms, p95 ${rtts[Math.floor(rtts.length * .95)]?.toFixed(1)} ms`);
process.exit(0);
