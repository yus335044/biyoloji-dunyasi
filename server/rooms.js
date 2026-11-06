// Sunucu oyun mantığı: odalar, oyuncular, hareket ve puan doğrulaması. Kaynak gerçeklik burasıdır.
import { randomBytes } from 'node:crypto';
import { GAME, MAIN_GAMES } from '../src/core/data.js';
import { buildGrid, height, SECRET } from '../src/world/height.js';
import { MAX_CAP, EMOTES, LEVELS, num, cleanName, cleanCode, makeCode, round } from './protocol.js';

buildGrid(150);
export const CFG = { TICK_MS: 66, GRACE_MS: 30000, MAX_SPEED: 13.5, SLACK: 3, MAX_ROOMS: 300, MIN_GAME_S: 8 };

const rooms = new Map();       // kod → oda
const sessions = new Map();    // gizli jeton → oyuncu
let nextId = 1;
const send = (p, m) => { if (p.ws && p.ws.readyState === 1) p.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
const toRoom = (r, m, except) => { const s = JSON.stringify(m); for (const p of r.players.values()) if (p !== except) send(p, s); };
const err = (p, code, msg) => send(p, { t: 'err', code, msg });
const event = (r, kind, text, extra) => toRoom(r, { t: 'ev', kind, text, ...extra });

const pub = r => ({ code: r.code, name: r.name, n: r.players.size, cap: r.cap, started: r.started });
const roomMsg = r => ({
  t: 'room', code: r.code, name: r.name, cap: r.cap, priv: r.priv, host: r.host, started: r.started, core: r.core,
  players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, ready: p.ready, online: !!p.ws, level: p.level, busy: p.busy, score: scoreOf(p), stars: starsOf(p), done: Object.keys(p.best).length })),
});
const scoreOf = p => Object.values(p.best).reduce((s, b) => s + b.score, 0);
const starsOf = p => Object.values(p.best).reduce((s, b) => s + b.stars, 0);
const pushRoom = r => toRoom(r, roomMsg(r));

const listeners = new Set();   // Oda listesini izleyen, odada olmayan oyuncular
let listDirty = false;
const pushList = () => { listDirty = true; };
const listMsg = () => ({ t: 'rooms', rooms: [...rooms.values()].filter(r => !r.priv && r.players.size < r.cap).map(pub).slice(0, 50) });

function spawnPos(r) {
  const i = r.players.size, a = i * 2.4, R = 8 + (i % 3) * 2;
  const x = Math.sin(a) * R, z = Math.cos(a) * R + 2;
  return { x: round(x), y: round(height(x, z)), z: round(z) };
}

/** Yeni bağlantı */
export function connect(ws) {
  const p = {
    id: nextId++, token: randomBytes(18).toString('hex'), ws, name: 'Kâşif', room: null, ready: false, level: 'world', busy: null,
    x: 0, y: 1.5, z: 0, yaw: 0, sp: 0, fl: 0, lastT: Date.now(), dirty: false, best: {}, have: 0, gameStart: 0, gameId: null,
    joinTries: 0, joinT: 0, emoteT: 0, createT: 0, strikes: 0, graceTimer: null,
  };
  ws.player = p; return p;
}

function resume(ws, token) {
  const p = sessions.get(token); if (!p) return null;
  if (p.ws && p.ws !== ws) { const old = p.ws; old.player = null; old.close(4001, 'replaced'); }
  clearTimeout(p.graceTimer); p.graceTimer = null; p.ws = ws; ws.player = p; p.lastT = Date.now();
  return p;
}

/** Bağlantı kapandı: oyuncuya geri dönmesi için süre tanınır */
export function disconnect(p, ws) {
  if (!p || p.ws !== ws) return;
  p.ws = null; listeners.delete(p);
  const r = p.room;
  if (!r) { sessions.delete(p.token); return; }
  pushRoom(r);
  p.graceTimer = setTimeout(() => leaveRoom(p, 'bağlantısı koptu'), CFG.GRACE_MS);
}

function leaveRoom(p, why = 'ayrıldı') {
  const r = p.room; if (!r) return;
  clearTimeout(p.graceTimer); p.graceTimer = null;
  r.players.delete(p.id); p.room = null; p.ready = false; p.busy = null; p.level = 'world'; p.best = {};
  sessions.delete(p.token);
  if (!r.players.size) { rooms.delete(r.code); pushList(); return; }
  toRoom(r, { t: 'gone', id: p.id });
  event(r, 'leave', `${p.name} ${why}.`);
  if (r.host === p.id) {
    const next = [...r.players.values()].find(q => q.ws) || r.players.values().next().value;
    r.host = next.id; next.ready = true;
    event(r, 'host', `${next.name} yeni oda sahibi oldu.`);
  }
  pushRoom(r); pushList();
}

function joinRoom(p, r) {
  p.room = r; p.ready = false; p.best = {}; p.level = 'world'; p.busy = null;
  Object.assign(p, spawnPos(r)); p.lastT = Date.now(); p.dirty = true;
  r.players.set(p.id, p); sessions.set(p.token, p); listeners.delete(p);
  send(p, { t: 'joined', code: r.code, spawn: { x: p.x, y: p.y, z: p.z } });
  if (r.started) send(p, { t: 'started', spawn: { x: p.x, y: p.y, z: p.z } });
  event(r, 'join', `${p.name} odaya katıldı.`);
  pushRoom(r); pushList();
}

const H = {
  hello(p, m, ws) {
    if (m.token && typeof m.token === 'string') {
      const q = resume(ws, m.token);
      if (q) {
        send(q, { t: 'welcome', id: q.id, token: q.token, resumed: true, you: { x: q.x, y: q.y, z: q.z, level: q.level } });
        send(q, { t: 'joined', code: q.room.code, spawn: { x: q.x, y: q.y, z: q.z } });
        if (q.room.started) send(q, { t: 'started', spawn: { x: q.x, y: q.y, z: q.z }, resumed: true });
        pushRoom(q.room); fullSnap(q);
        return;
      }
    }
    p.name = cleanName(m.name, p.name);
    if (num(m.have, 0, MAIN_GAMES.length)) p.have = Math.floor(m.have);
    send(p, { t: 'welcome', id: p.id, token: p.token, resumed: false, lostRoom: !!m.token });
  },
  name(p, m) { const n = cleanName(m.name); if (!n) return err(p, 'name', 'İsim 2-16 karakter olmalı.'); p.name = n; if (p.room) pushRoom(p.room); },
  list(p) { listeners.add(p); send(p, listMsg()); },
  create(p, m) {
    if (p.room) return err(p, 'state', 'Zaten bir odadasın.');
    const now = Date.now(); if (now - p.createT < 2000) return err(p, 'rate', 'Biraz bekleyip tekrar dene.'); p.createT = now;
    if (rooms.size >= CFG.MAX_ROOMS) return err(p, 'full', 'Sunucu dolu, biraz sonra dene.');
    if (!num(m.cap, 2, MAX_CAP)) return err(p, 'cap', 'Oyuncu kapasitesi 2-30 arasında olmalı.');
    const code = makeCode(rooms);
    const r = { code, name: cleanName(m.name, `${p.name} odası`), cap: Math.floor(m.cap), priv: m.priv === true, host: p.id, started: false, core: false, players: new Map(), tick: 0 };
    rooms.set(code, r); joinRoom(p, r); p.ready = true; pushRoom(r);
  },
  join(p, m) {
    if (p.room) return err(p, 'state', 'Zaten bir odadasın.');
    const now = Date.now(); if (now - p.joinT > 60000) { p.joinT = now; p.joinTries = 0; }
    if (++p.joinTries > 15) return err(p, 'rate', 'Çok fazla deneme yaptın, bir dakika bekle.');
    const r = rooms.get(cleanCode(m.code));
    if (!r) return err(p, 'nocode', 'Bu kodla bir oda bulunamadı.');
    if (r.players.size >= r.cap) return err(p, 'full', 'Bu oda dolu.');
    joinRoom(p, r);
  },
  leave(p) { if (p.room) { leaveRoom(p); send(p, { t: 'left' }); listeners.add(p); send(p, listMsg()); } },
  ready(p, m) { if (!p.room || p.room.started) return; p.ready = m.v === true; pushRoom(p.room); },
  start(p) {
    const r = p.room; if (!r) return;
    if (r.host !== p.id) return err(p, 'host', 'Oyunu yalnızca oda sahibi başlatabilir.');
    if (r.started) return;
    const waiting = [...r.players.values()].filter(q => q.id !== p.id && !q.ready);
    if (waiting.length) return err(p, 'notready', `Hazır olmayan oyuncular var: ${waiting.map(q => q.name).join(', ')}`);
    r.started = true;
    for (const q of r.players.values()) send(q, { t: 'started', spawn: { x: q.x, y: q.y, z: q.z } });
    pushRoom(r); pushList();
  },
  // Hareket: [x,y,z,yaw,hız,bayrak]. Hız, sınır ve arazi burada doğrulanır.
  s(p, m) {
    const r = p.room; if (!r || !r.started || !Array.isArray(m.v) || m.v.length !== 6) return;
    const [x, y, z, yaw, sp, fl] = m.v;
    if (!num(x, -320, 320) || !num(y, -30, 60) || !num(z, -320, 320) || !num(yaw, -1e4, 1e4) || !num(sp, 0, 30) || !num(fl, 0, 3)) return strike(p);
    const now = Date.now(), dt = Math.min(now - p.lastT, 3000) / 1000; p.lastT = now;
    const d = Math.hypot(x - p.x, z - p.z);
    let ok = d <= CFG.MAX_SPEED * dt + CFG.SLACK;
    if (ok) {
      if (p.level === 'world') {
        const g = height(x, z), dock = x > 37 && x < 61 && z > -10 && z < -6;
        if (!dock && g < -1.1) ok = false;           // Derin su veya açık deniz
        if (y > g + 28 || (y < g - 3 && !dock)) ok = false;
      } else if (Math.abs(x) > 16 || Math.abs(z) > 16 || y < -1 || y > 12) ok = false;
    }
    if (!ok) { p.rej = (p.rej || 0) + 1; send(p, { t: 'corr', x: p.x, y: p.y, z: p.z }); return; }
    p.x = x; p.y = y; p.z = z; p.yaw = yaw; p.sp = Math.min(sp, 11); p.fl = fl; p.dirty = true;
  },
  // Harita ışınlanması: yalnızca gerçek istasyonlara
  tp(p, m) {
    const g = GAME[m.game]; if (!p.room?.started || !g || !g.r) return strike(p);
    if (!num(m.x, -320, 320) || !num(m.z, -320, 320) || Math.hypot(m.x - g.pos[0], m.z - g.pos[1]) > g.r + 6) return strike(p);
    p.x = m.x; p.z = m.z; p.y = height(m.x, m.z); p.level = 'world'; p.lastT = Date.now(); p.dirty = true; pushPst(p);
  },
  // İç mekân geçişi: yalnızca girişin yanındayken
  lvl(p, m) {
    if (!p.room?.started || !LEVELS.includes(m.l) || !num(m.x, -320, 320) || !num(m.z, -320, 320)) return strike(p);
    const near = key => Math.hypot((key === 'world' ? m.x : p.x) - SECRET[p.enter ?? key][0], (key === 'world' ? m.z : p.z) - SECRET[p.enter ?? key][1]) < 14;
    if (m.l === 'world') {
      if (p.level === 'world') return;
      if (!near('world')) return strike(p);
      p.enter = null; p.y = height(m.x, m.z);
    } else {
      if (p.level !== 'world' || !near(m.l)) { send(p, { t: 'corr', x: p.x, y: p.y, z: p.z }); return; }
      p.enter = m.l; p.y = 0;
    }
    p.level = m.l; p.x = m.x; p.z = m.z; p.lastT = Date.now(); p.dirty = true; pushPst(p);
  },
  // Mini oyun başlangıcı: kilit ve süre doğrulaması için kaydedilir
  begin(p, m) {
    const g = GAME[m.game]; if (!p.room?.started || !g) return strike(p);
    const done = p.have + Object.keys(p.best).length;   // Cihazdaki ilerleme + bu odada bitirilenler
    if (m.game !== 'magara' && done < g.need) return err(p, 'locked', 'Bu oyun henüz kilitli.');
    if (m.game === 'magara' && p.level !== 'cave') return strike(p);
    p.gameId = m.game; p.gameStart = Date.now();
  },
  busy(p, m) {
    if (!p.room) return;
    const b = m.game === null ? null : GAME[m.game] ? m.game : undefined; if (b === undefined) return strike(p);
    p.busy = b; pushPst(p);
  },
  // Sonuç: sunucu aralığı, oyun oturumunu ve en kısa süreyi denetler; yıldızı kendisi hesaplar
  result(p, m) {
    const r = p.room; if (!r || !GAME[m.game]) return strike(p);
    if (!num(m.score, 0, 1000) || typeof m.ok !== 'boolean') return strike(p);
    if (p.gameId !== m.game) return err(p, 'result', 'Sonuç, başlatılan oyunla eşleşmiyor.');
    const secs = (Date.now() - p.gameStart) / 1000; p.gameId = null;
    if (secs < CFG.MIN_GAME_S && !m.offlineGrace) return err(p, 'result', 'Sonuç çok kısa sürede geldi, kabul edilmedi.');
    if (!m.ok) { send(p, { t: 'resultOk', game: m.game, accepted: true }); return; }
    const score = Math.round(m.score), stars = score >= 900 ? 3 : score >= 650 ? 2 : 1, prev = p.best[m.game];
    if (m.game !== 'magara' && (!prev || score > prev.score)) p.best[m.game] = { score, stars: Math.max(stars, prev?.stars || 0) };
    send(p, { t: 'resultOk', game: m.game, accepted: true });
    if (m.game !== 'magara') event(r, 'game', `${p.name}: ${GAME[m.game].title} (${'★'.repeat(stars)})`);
    if (m.game === 'final' && !r.core) { r.core = true; event(r, 'core', `${p.name} Enerji Çekirdeği’ni yeniden yaktı!`); }
    pushRoom(r);
  },
  emote(p, m) {
    if (!p.room?.started || !num(m.i, 0, EMOTES.length - 1) || !Number.isInteger(m.i)) return strike(p);
    const now = Date.now(); if (now - p.emoteT < 1000) return; p.emoteT = now;
    toRoom(p.room, { t: 'emote', id: p.id, e: EMOTES[m.i] });
  },
  ping(p, m) { if (num(m.c, 0, 1e15)) send(p, { t: 'pong', c: m.c, n: p.room?.players.size ?? 0 }); },
};
const pushPst = p => toRoom(p.room, { t: 'pst', id: p.id, level: p.level, busy: p.busy });

/** Bozuk paket gönderen bağlantıyı önce sayar, sonra kapatır */
function strike(p) { if (++p.strikes > 20 && p.ws) p.ws.close(4002, 'invalid packets'); }

export function handle(ws, raw) {
  const p = ws.player; if (!p) return;
  const now = Date.now();
  if (now - (ws.rateT || 0) > 1000) { ws.rateT = now; ws.rateN = 0; }
  if (++ws.rateN > 90) { if (ws.rateN > 400) ws.close(4003, 'flood'); return; }
  let m; try { m = JSON.parse(raw); } catch { return strike(p); }
  if (!m || typeof m !== 'object' || typeof m.t !== 'string' || !Object.hasOwn(H, m.t)) return strike(p);
  H[m.t](ws.player, m, ws);
}

const encode = p => [p.id, round(p.x), round(p.y), round(p.z), round(p.yaw), round(p.sp), p.fl];
function fullSnap(p) {
  const r = p.room; if (!r) return;
  send(p, { t: 'snap', all: true, p: [...r.players.values()].filter(q => q !== p).map(encode) });
}

// Sunucu saati: yalnızca değişen oyuncular ve yalnızca aynı bölümdekilere gönderilir
export const stats = { sent: 0, bytes: 0, tickMs: 0 };
setInterval(() => {
  const t0 = performance.now();
  for (const r of rooms.values()) {
    if (!r.started) continue; r.tick++;
    const changed = {};
    let any = false;
    for (const p of r.players.values()) if (p.dirty) { p.dirty = false; (changed[p.level] ||= []).push(p); any = true; }
    if (!any) continue;
    for (const level in changed) {
      const list = changed[level], arr = list.map(encode);
      for (const q of r.players.values()) {
        if (q.level !== level || !q.ws) continue;
        const items = list.includes(q) ? arr.filter(e => e[0] !== q.id) : arr;
        if (!items.length) continue;
        const s = JSON.stringify({ t: 'snap', p: items }); q.ws.send(s); stats.sent++; stats.bytes += s.length;
      }
    }
  }
  stats.tickMs = performance.now() - t0;
}, CFG.TICK_MS).unref?.();
setInterval(() => { if (!listDirty) return; listDirty = false; const s = JSON.stringify(listMsg()); for (const p of listeners) send(p, s); }, 500).unref?.();
export const counts = () => ({ rooms: rooms.size, players: [...rooms.values()].reduce((s, r) => s + r.players.size, 0) });
