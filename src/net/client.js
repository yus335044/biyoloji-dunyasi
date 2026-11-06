// Sunucuyla konuşan istemci katmanı: bağlantı, yeniden bağlanma, oda durumu, konum gönderimi.
import { Remotes } from './remote.js';
import { doneCount, notify, unlock } from '../core/store.js';
import { sfx } from '../core/audio.js';
import { SECRET, height } from '../world/height.js';

const TOKEN = 'pw-net-token', SEND_MS = 66, GIVE_UP_MS = 40000;
const store = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* */ } } };

export class Net {
  constructor(app) {
    this.app = app; this.ws = null; this.status = 'off'; this.id = null; this.room = null; this.entered = false; this.rooms = [];
    this.latency = 0; this.remotes = new Remotes(app); this.sendT = 0; this.pingT = 0; this.last = ''; this.queue = []; this.lostAt = 0; this.retryN = 0; this.quitting = false;
  }
  get inRoom() { return !!this.room; }
  get ui() { return this.app.ui.online; }
  get canOnline() { return location.protocol.startsWith('http'); }

  /** Sayfa açılışı: oda davet linki ve sayfa yenileme sonrası odaya dönüş */
  boot() {
    const code = new URLSearchParams(location.search).get('oda');
    if (store.get(TOKEN)) this.connect();
    else if (code) this.ui.open(code);
  }
  connect() {
    if (!this.canOnline) { this.setStatus('fail'); return; }
    if (this.ws && this.ws.readyState <= 1) return;
    this.setStatus(this.room ? 'retry' : 'connecting');
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); this.ws = ws;
    ws.onopen = () => { this.send({ t: 'hello', name: this.ui.name(), token: store.get(TOKEN), have: doneCount() }); };
    ws.onmessage = e => { try { this.on(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = e => { if (this.ws === ws) this.closed(e.code); };
  }
  send(m) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
  setStatus(s) { this.status = s; this.ui.statusChanged(); this.app.ui.refresh?.(); }
  closed(code) {
    this.ws = null;
    if (this.quitting) return;
    if (code === 4001) { this.ui.lost('Bu oyuna başka bir sekmeden bağlandın.', false); this.setStatus('fail'); return; }
    if (code === 4002 || code === 4003) { this.reset(); this.ui.lost('Bağlantı, geçersiz veri gönderildiği için kapatıldı.', false); this.setStatus('fail'); return; }
    if (!this.room && !store.get(TOKEN)) { this.setStatus('fail'); return; }
    if (!this.lostAt) this.lostAt = performance.now();
    this.setStatus('retry');
    if (performance.now() - this.lostAt > GIVE_UP_MS) { this.setStatus('fail'); this.ui.lost('Sunucuya ulaşılamıyor. İnternet bağlantını kontrol et.', true); return; }
    clearTimeout(this.rt); this.rt = setTimeout(() => this.connect(), Math.min(1000 + 700 * this.retryN++, 4000));
  }
  retryNow() { this.lostAt = 0; this.retryN = 0; this.connect(); }

  on(m) {
    switch (m.t) {
      case 'welcome':
        this.id = this.remotes.me = m.id; this.lostAt = 0; this.retryN = 0; this.setStatus('online');
        if (!m.resumed && m.lostRoom) {
          store.set(TOKEN, null);
          if (this.room || this.entered) this.ui.lost('Oda artık yok; sunucu yeniden başlamış olabilir. İlerlemen bu cihazda duruyor.', false);
          this.room = null;
        }
        if (m.resumed) this.resumeInfo = m.you;
        if (this.ui.isOpen && !this.room) this.send({ t: 'list' });
        for (const q of this.queue.splice(0)) this.send(q);
        break;
      case 'rooms': this.rooms = m.rooms; this.ui.roomsChanged(); break;
      case 'joined': store.set(TOKEN, this.tokenValue); break;
      case 'room': {
        const wasCore = this.room?.core; this.room = m; store.set(TOKEN, this.tokenValue);
        this.remotes.roster(m.players);
        if (!this.entered) this.ui.showLobby();
        this.ui.roomChanged(); this.app.ui.refresh?.();
        if (m.core && !wasCore) this.app.world.refresh();
        break;
      }
      case 'started': {
        if (this.entered) break;
        this.entered = true; const you = this.resumeInfo, s = m.spawn;
        this.app.enterOnline(s.x, s.y, s.z); this.ui.close(true); this.app.ui.enterWorld(); this.app.world.refresh(); sfx('good');
        // Sayfa yenilenirken iç mekândaysa dünyaya, girişin yanına döner
        if (you && you.level !== 'world') { const q = SECRET[you.level], x = q[0] + 5, z = q[1] + 5; this.level('world', x, z); this.app.player.teleport(x, height(x, z), z); }
        this.resumeInfo = null;
        break;
      }
      case 'snap': if (this.entered) this.remotes.apply(m.p); break;
      case 'pst': this.remotes.pst(m.id, m.level, m.busy); { const q = this.room?.players.find(x => x.id === m.id); if (q) { q.level = m.level; q.busy = m.busy; } } break;
      case 'gone': this.remotes.remove(m.id); break;
      case 'corr': this.app.player.teleport(m.x, m.y, m.z); break;
      case 'emote': this.remotes.emote(m.id, m.e); break;
      case 'ev': if (this.entered || m.kind === 'host') this.app.ui.online.eventToast(m); break;
      case 'left': this.reset(); this.ui.showBrowse(); break;
      case 'err': this.ui.error(m); break;
      case 'pong': this.latency = Math.round(performance.now() - m.c); this.ui.refreshPill(); break;
    }
    if (m.t === 'welcome') { this.tokenValue = m.token; if (store.get(TOKEN) && !m.resumed) store.set(TOKEN, null); }
  }
  reset() { store.set(TOKEN, null); this.room = null; this.entered = false; this.remotes.clear(); this.app.ui.refresh?.(); }

  // --- Oda işlemleri ---
  create(o) { this.send({ t: 'name', name: this.ui.name() }); this.send({ t: 'create', ...o }); }
  join(code) { this.send({ t: 'name', name: this.ui.name() }); this.send({ t: 'join', code }); }
  leave() { this.send({ t: 'leave' }); }
  quit() { this.quitting = true; this.send({ t: 'leave' }); store.set(TOKEN, null); }
  ready(v) { this.send({ t: 'ready', v }); }
  start() { this.send({ t: 'start' }); }

  // --- Oyun içi ---
  tp(game, x, z) { if (this.entered) this.send({ t: 'tp', game, x, z }); }
  level(l, x, z) { if (this.entered) this.send({ t: 'lvl', l, x, z }); }
  onLevel(lv) { this.remotes.onLevel(lv); }
  busy(game) { if (this.room) this.send({ t: 'busy', game: game ?? null }); }
  begin(game) { if (this.entered) this.send({ t: 'begin', game }); }
  result(game, score, ok) { if (!this.entered) return; const m = { t: 'result', game, score, ok }; if (!this.send(m)) this.queue.push(m); }
  emote(i) { if (this.entered) this.send({ t: 'emote', i }); }

  tick(dt) {
    this.pingT -= dt;
    if (this.pingT <= 0 && this.ws?.readyState === 1) { this.pingT = 3; this.send({ t: 'ping', c: Math.round(performance.now()) }); }
    if (!this.entered) return;
    const a = this.app; this.remotes.update(dt);
    if (a.view || (a.shell.active && !a.mission) || a.ui.fading) return;   // Parkur ve mini oyunlarda konum gönderilmez
    this.sendT -= dt * 1000; if (this.sendT > 0) return; this.sendT = SEND_MS;
    const p = a.player, yaw = ((p.yaw + Math.PI) % 6.2832 + 6.2832) % 6.2832 - Math.PI, sp = Math.round(p.speed * 10) / 10;
    const v = [+p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2), +yaw.toFixed(2), Math.max(0, sp), (p.grounded ? 1 : 0) + (sp > .3 ? 2 : 0)];
    const key = v.join(); if (key === this.last) return; this.last = key;
    this.send({ t: 's', v });
  }
}
