// Gerçek sunucuya gerçek WebSocket istemcileriyle bağlanan protokol testi. Kendi sunucusunu ayrı süreçte başlatır.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
const PORT = 8123, URL = `ws://localhost:${PORT}/ws`;
let srv; const startSrv = () => new Promise(res => { srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'inherit'] }); srv.stdout.once('data', () => res()); });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? '✓' : '✗ HATA'} ${n}`); };
function bot(name, token) {
  return new Promise(res => {
    const ws = new WebSocket(URL), b = { ws, msgs: [], room: null, name, last: {} };
    b.send = m => ws.send(JSON.stringify(m)); b.raw = s => ws.send(s);
    b.next = (t, ms = 1500) => new Promise((r, j) => { const f = b.msgs.findIndex(m => m.t === t); if (f >= 0) return r(b.msgs.splice(f, 1)[0]); const s = Date.now(); const iv = setInterval(() => { const i = b.msgs.findIndex(m => m.t === t); if (i >= 0) { clearInterval(iv); r(b.msgs.splice(i, 1)[0]); } else if (Date.now() - s > ms) { clearInterval(iv); j(new Error('zaman aşımı: ' + t)); } }, 10); });
    ws.on('message', d => { const m = JSON.parse(d); b.msgs.push(m); b.last[m.t] = m; if (m.t === 'room') b.room = m; if (m.t === 'welcome') { b.id = m.id; b.token = m.token; res(b); } });
    ws.on('open', () => b.send({ t: 'hello', name, token, have: 0 }));
    ws.on('error', () => {});
  });
}
const closed = ws => new Promise(r => ws.readyState === 3 ? r() : ws.once('close', r));

await startSrv();
const a = await bot('Ayşe'), b = await bot('Burak');
ok(a.id !== b.id, 'Oyuncuların benzersiz kimliği var');

// Oda sistemi
a.send({ t: 'create', cap: 99 }); ok((await a.next('err')).code === 'cap', 'Geçersiz kapasite reddedildi');
await new Promise(r => setTimeout(r, 2100));
a.send({ t: 'create', name: 'Biyoloji 10-A', cap: 3, priv: false }); const j = await a.next('joined'); const code = j.code;
ok(/^[A-Z2-9]{5}$/.test(code), `Oda kodu üretildi (${code})`);
await a.next('room'); ok(a.room.host === a.id, 'Kuran kişi oda sahibi');
b.send({ t: 'list' }); const l = await b.next('rooms'); ok(l.rooms.some(r => r.code === code), 'Açık oda listede görünüyor');
const v = await bot('Veli'); v.send({ t: 'create', name: 'Gizli', cap: 2, priv: true }); const vj = await v.next('joined');
b.send({ t: 'list' }); ok(!(await b.next('rooms')).rooms.some(r => r.code === vj.code), 'Özel oda listede görünmüyor');
b.send({ t: 'join', code: 'ZZZZZ' }); ok((await b.next('err')).code === 'nocode', 'Yanlış kod reddedildi');
b.send({ t: 'join', code: code.toLowerCase() }); const bj = await b.next('joined'); ok(bj.code === code, 'Kodla katılım çalışıyor');
await wait(50); ok(a.room.players.length === 2, 'Oda sahibi yeni oyuncuyu görüyor');
b.send({ t: 'start' }); ok((await b.next('err')).code === 'host', 'Oda sahibi olmayan başlatamaz');
a.send({ t: 'start' }); ok((await a.next('err')).code === 'notready', 'Hazır olmayan varken başlamaz');
b.send({ t: 'ready', v: true }); await wait(50); ok(a.room.players.find(p => p.id === b.id).ready, 'Hazır durumu herkese yansıyor');
a.send({ t: 'start' }); await a.next('started'); const st = await b.next('started'); ok(!!st.spawn, 'Oda sahibi oyunu başlattı, herkes başladı');

// Kapasite
const c = await bot('Can'); c.send({ t: 'join', code }); await c.next('joined'); const d = await bot('Deniz'); d.send({ t: 'join', code }); ok((await d.next('err')).code === 'full', 'Dolu odaya girilemiyor');

// Hareket senkronu ve doğrulama
let s = st.spawn; let sa = (await a.msgs.find(m => m.t === 'joined'))?.spawn || j.spawn;
await wait(200); b.msgs.length = 0; a.msgs.length = 0;
b.send({ t: 's', v: [s.x + 1, s.y, s.z, 1.2, 6, 1] });
const snap = await a.next('snap'); const e = snap.p.find(q => q[0] === b.id);
ok(e && Math.abs(e[1] - (s.x + 1)) < .02 && e[4] === 1.2 && e[5] === 6, 'Konum, rotasyon ve hız diğer oyuncuya ulaştı');
b.send({ t: 's', v: [s.x + 200, s.y, s.z, 0, 6, 1] }); ok((await b.next('corr')).x === s.x + 1, 'Işınlanma hilesi reddedildi, konum düzeltildi');
await wait(30); b.send({ t: 's', v: [s.x + 1, 2000, s.z, 0, 6, 1] });
await wait(1000); b.msgs.length = 0; b.send({ t: 's', v: [s.x + 8, -1.5, s.z - 8, 0, 6, 1] }); await wait(50);
a.msgs.length = 0; b.send({ t: 's', v: [200, 0, 200, 0, 6, 1] }); ok((await b.next('corr')).x !== 200, 'Harita dışına çıkış reddedildi');
b.send({ t: 'lvl', l: 'yusuf', x: 0, y: 0, z: 3 }); ok(!!(await b.next('corr')), 'Girişten uzakta gizli odaya girilemiyor');

// Bozuk paketler
b.raw('bu json değil'); b.raw('{"t":"__proto__"}'); b.raw('{"t":"constructor"}'); b.send({ t: 's', v: ['x', null, {}, 0, 0, 0] }); b.send({ t: 'emote', i: 99 }); b.send({ t: 'name', name: '<' });
ok((await b.next('err')).code === 'name', 'Geçersiz isim reddedildi; bozuk paketler sunucuyu düşürmedi');
const big = new WebSocket(URL); await new Promise(r => big.on('open', r)); big.send('x'.repeat(5000)); await closed(big); ok(true, 'Çok büyük paket bağlantıyı kapattı');
b.send({ t: 'ping', c: 5 }); ok((await b.next('pong')).c === 5, 'Sunucu paketlerden sonra çalışmaya devam ediyor');

// Puan doğrulama
b.send({ t: 'result', game: 'lab', score: 900, ok: true }); ok((await b.next('err')).code === 'result', 'Başlatılmamış oyunun puanı reddedildi');
b.send({ t: 'begin', game: 'final' }); ok((await b.next('err')).code === 'locked', 'Kilitli oyun başlatılamıyor');
b.send({ t: 'begin', game: 'lab' }); await wait(20); b.send({ t: 'result', game: 'lab', score: 900, ok: true }); ok((await b.next('err')).msg.includes('kısa'), 'İmkânsız kısa sürede puan reddedildi');
b.send({ t: 'begin', game: 'lab' }); await wait(8200); b.send({ t: 'result', game: 'lab', score: 99999, ok: true }); await wait(60);
ok((a.room.players.find(p => p.id === b.id).score === 0), 'Aralık dışı puan reddedildi');
b.send({ t: 'begin', game: 'lab' }); await wait(8200); a.msgs.length = 0; b.send({ t: 'result', game: 'lab', score: 900, ok: true }); const ev = await a.next('ev');
ok(ev.kind === 'game' && ev.text.includes('Burak'), 'Oyun sonucu diğer oyunculara duyuruldu'); await wait(50);
ok(a.room.players.find(p => p.id === b.id).score === 900 && a.room.players.find(p => p.id === b.id).stars === 3, 'Puan ve yıldız sunucuda hesaplandı');

// İfade
a.msgs.length = 0; b.send({ t: 'emote', i: 0 }); ok((await a.next('emote')).id === b.id, 'İfade diğer oyuncuya ulaştı');

// Bağlantı kopması ve geri dönüş
const tok = b.token, bid = b.id; b.ws.terminate(); await wait(100);
ok(a.room.players.find(p => p.id === bid).online === false, 'Kopan oyuncu çevrimdışı gösteriliyor');
const b2 = await bot('Burak', tok); ok(b2.id === bid, 'Aynı kimlikle yeniden bağlandı'); await b2.next('started'); await wait(50);
ok(a.room.players.find(p => p.id === bid).online === true && a.room.players.find(p => p.id === bid).score === 900, 'Puan korundu, oyuncu yeniden çevrimiçi');

// Ayrılma ve oda sahibi devri
a.msgs.length = 0; c.send({ t: 'leave' }); ok((await a.next('gone')).id === c.id, 'Ayrılan oyuncu diğerlerinden kaldırıldı');
b2.msgs.length = 0; a.send({ t: 'leave' }); await wait(60); ok(b2.room.host === bid, 'Oda sahibi ayrılınca yeni sahip belirlendi');

// Sunucu yeniden başlatma
const t2 = b2.token; const cl = closed(b2.ws); srv.kill('SIGTERM'); await cl; ok(true, 'Sunucu kapanınca istemci haberdar oldu');
await wait(200); await startSrv(); const b3 = await bot('Burak', t2); ok(b3.last.welcome.lostRoom === true, 'Sunucu yeniden başladı: oda kaybı istemciye bildirildi');
for (const x of [b3, v, d]) x.ws.terminate(); srv.kill('SIGTERM');
console.log(`\n${pass} geçti, ${fail} hata`); process.exit(fail ? 1 : 0);
