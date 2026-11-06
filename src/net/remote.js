// Diğer oyuncuların karakterleri: mevcut model ve animasyon kodu aynen kullanılır, konumlar yumuşatılır.
import { Player } from '../world/player.js';
import { billboard, bake } from '../world/kit.js';
import { lerp } from '../core/dom.js';

const DELAY = 130; // ms: ağ sarsıntısını gizleyen küçük gösterim gecikmesi
const shortYaw = (a, b, t) => { let d = (b - a) % 6.2832; if (d > Math.PI) d -= 6.2832; if (d < -Math.PI) d += 6.2832; return a + d * t; };

class Remote {
  constructor(id, highQuality) {
    this.id = id; this.p = new Player(); this.buf = []; this.level = 'world'; this.busy = null; this.online = true; this.name = '';
    // Görünüm aynı kalır; hareketsiz parçalar birleşir, kalabalıkta draw call sayısı düşer
    const P = this.p; [P.head, P.la, P.ra, P.ll, P.rl].forEach(g => { g.userData.live = true; }); P.leaf.userData.live = true;
    bake(P.body); bake(P.head);
    P.obj.traverse(o => { if (o.isMesh) o.castShadow = highQuality; });
    this.p.obj.visible = false; this.bubbleT = 0;
  }
  push(e) {
    const now = performance.now(), last = this.buf[this.buf.length - 1];
    // Oyuncu durup yeniden yürüdüyse eski noktadan sürünerek gelmesin
    if (last && now - last.t > 250) this.buf.push({ ...last, t: now - 70 });
    this.buf.push({ t: now, x: e[1], y: e[2], z: e[3], yaw: e[4], sp: e[5], fl: e[6] });
    if (this.buf.length > 24) this.buf.splice(0, this.buf.length - 24);
    if (this.buf.length <= 2) { const o = this.p.obj; o.position.set(e[1], e[2], e[3]); o.rotation.y = e[4]; }
  }
  label() {
    const key = `${this.name}|${this.busy ? 1 : 0}|${this.online}`; if (key === this.lkey) return; this.lkey = key;
    if (this.tag) { this.p.obj.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); }
    const txt = !this.online ? `${this.name} · bağlantı koptu` : this.busy ? `${this.name} · oynuyor` : this.name;
    this.tag = billboard(txt, !this.online ? '#ffb4a8' : this.busy ? '#ffe48a' : '#ffffff', 5); this.tag.position.y = 2.75; this.p.obj.add(this.tag);
  }
  bubble(e) {
    if (this.emo) { this.p.obj.remove(this.emo); this.emo.material.map.dispose(); this.emo.material.dispose(); }
    this.emo = billboard(e, '#fff', 4.2); this.emo.position.y = 3.4; this.p.obj.add(this.emo); this.bubbleT = 2.4;
  }
}

export class Remotes {
  constructor(app) { this.app = app; this.map = new Map(); this.me = null; this.ownEmo = null; this.ownT = 0; this.far = (app.Q.pr >= 2 ? 110 : 65) ** 2; }
  get(id) {
    let r = this.map.get(id);
    if (!r && id !== this.me) { r = new Remote(id, this.app.Q.shadowSize >= 2048); this.map.set(id, r); this.app.level?.scene.add(r.p.obj); r.p.obj.visible = false; }
    return r;
  }
  roster(players) {
    const alive = new Set();
    for (const q of players) {
      if (q.id === this.me) continue; alive.add(q.id);
      const r = this.get(q.id); r.name = q.name; r.level = q.level; r.busy = q.busy; r.online = q.online; r.label();
    }
    for (const id of this.map.keys()) if (!alive.has(id)) this.remove(id);
  }
  pst(id, level, busy) { const r = this.get(id); if (r) { if (r.level !== level) r.buf.length = 0; r.level = level; r.busy = busy; r.label(); } }
  remove(id) { const r = this.map.get(id); if (r) { r.p.obj.parent?.remove(r.p.obj); this.map.delete(id); } }
  clear() { for (const id of [...this.map.keys()]) this.remove(id); }
  apply(list) { for (const e of list) this.get(e[0])?.push(e); }
  onLevel(lv) { for (const r of this.map.values()) lv.scene.add(r.p.obj); }
  emote(id, e) {
    if (id === this.me) {
      const po = this.app.player.obj; if (this.ownEmo) po.remove(this.ownEmo);
      this.ownEmo = billboard(e, '#fff', 4.2); this.ownEmo.position.y = 3; po.add(this.ownEmo); this.ownT = 2.4; return;
    }
    this.map.get(id)?.bubble(e);
  }
  update(dt) {
    if (this.ownEmo && (this.ownT -= dt) <= 0) { this.app.player.obj.remove(this.ownEmo); this.ownEmo = null; }
    const now = performance.now(), rt = now - DELAY, here = this.app.level?.netName || 'world', pp = this.app.player.pos;
    for (const r of this.map.values()) {
      const o = r.p.obj, b = r.buf;
      if (r.level !== here || !b.length) { o.visible = false; continue; }
      let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
      const B = b[i], A = b[i - 1] || B, span = B.t - A.t, k = span > 0 ? Math.min(1, Math.max(0, (rt - A.t) / span)) : 1;
      o.position.set(lerp(A.x, B.x, k), lerp(A.y, B.y, k), lerp(A.z, B.z, k));
      r.p.yaw = o.rotation.y = shortYaw(A.yaw, B.yaw, k);
      const d2 = (o.position.x - pp.x) ** 2 + (o.position.z - pp.z) ** 2;
      o.visible = d2 < this.far; if (!o.visible) continue;
      const newest = b[b.length - 1], still = now - newest.t > 220;
      const sp = still && !(newest.fl & 2) ? 0 : (A.sp + (B.sp - A.sp) * k);
      r.p.speed = lerp(r.p.speed, sp, 1 - Math.exp(-dt * 10)); r.p.grounded = !!(B.fl & 1) || still;
      if (d2 < 55 * 55) r.p.anim(dt);
      if (r.emo && (r.bubbleT -= dt) <= 0) { o.remove(r.emo); r.emo = null; }
    }
  }
}
