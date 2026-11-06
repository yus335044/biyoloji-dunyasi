import * as THREE from 'three';
import { box, cyl, ball, cone } from './kit.js';
import { sfx } from '../core/audio.js';
import { clamp, lerp } from '../core/dom.js';

/** Klavye, dokunmatik joystick ve kamera sürüklemesi tek noktada toplanır. */
export class Input {
  constructor(canvas) {
    this.keys = {}; this.look = { x: 0, y: 0 }; this.joy = { x: 0, y: 0 }; this.jump = false; this.act = false; this.zoom = 0; this.onJoy = null;
    addEventListener('keydown', e => {
      if (e.target?.tagName === 'INPUT') return;
      this.keys[e.code] = true;
      if (e.code === 'Space') { this.jump = true; if (e.target === document.body) e.preventDefault(); }
      if (e.code === 'KeyE') this.act = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    const ptrs = new Map();
    const moveJoy = e => {
      let dx = e.clientX - this.joyO[0], dy = e.clientY - this.joyO[1]; const R = 54, l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      this.joy = { x: dx / R, y: dy / R }; this.onJoy?.('move', dx, dy);
    };
    canvas.addEventListener('pointerdown', e => {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* sentetik olay */ }
      // Dokunmatik: yalnızca köşedeki joystick yürütür; ekranın geri kalanı kamerayı çevirir.
      const c = e.pointerType !== 'mouse' && this.joyId == null ? this.joyCenter?.() : null;
      if (c && Math.hypot(e.clientX - c[0], e.clientY - c[1]) < 95) { this.joyId = e.pointerId; this.joyO = c; moveJoy(e); }
      else ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, k: e.pointerType === 'mouse' ? 1 : 1.6 });
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId === this.joyId) moveJoy(e);
      else if (ptrs.has(e.pointerId)) {
        const p = ptrs.get(e.pointerId); this.look.x += (e.clientX - p.x) * p.k; this.look.y += (e.clientY - p.y) * p.k; p.x = e.clientX; p.y = e.clientY;
      }
    });
    const up = e => { if (e.pointerId === this.joyId) { this.joyId = null; this.joy = { x: 0, y: 0 }; this.onJoy?.('end'); } ptrs.delete(e.pointerId); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { this.zoom += e.deltaY * .01; }, { passive: true });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  /** Hareket vektörü: klavye + joystick */
  move() {
    const k = this.keys; let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    x += this.joy.x; y += this.joy.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  takeJump() { const j = this.jump; this.jump = false; return j; }
  takeAct() { const a = this.act; this.act = false; return a; }
  clear() { this.jump = this.act = false; this.look.x = this.look.y = 0; this.zoom = 0; }
}

export class Player {
  constructor() {
    this.obj = new THREE.Group(); this.pos = this.obj.position; this.vy = 0; this.grounded = true; this.yaw = 0; this.phase = 0; this.speed = 0; this.coyote = 0;
    const b = new THREE.Group(); this.body = b; this.obj.add(b);
    const skin = '#f6c9a0', suit = '#2fa58b', dark = '#1d6b63';
    b.add(ball(.42, suit, 0, .95, 0, 1), ball(.3, '#f5f4ea', 0, 1, .2, 0)); // gövde
    this.head = new THREE.Group(); this.head.position.y = 1.55; b.add(this.head);
    this.head.add(ball(.42, skin, 0, 0, 0, 1), ball(.07, '#233', -.15, .03, .37, 0), ball(.07, '#233', .15, .03, .37, 0), box(.14, .04, .04, '#c96a58', 0, -.13, .39));
    const hat = cyl(.3, .42, .22, '#ffc93c', 0, .34, 0, 8), brim = cyl(.62, .62, .05, '#ffb02e', 0, .24, 0, 10); this.head.add(hat, brim);
    const leaf = ball(.2, '#57d94a', .1, .58, 0, 0); leaf.scale.set(.6, 1.2, .25); leaf.rotation.z = -.4; this.leaf = leaf; this.head.add(leaf);
    const pack = box(.46, .56, .24, '#ff8a5c', 0, 1.03, -.4); b.add(pack, ball(.1, '#8ff5e6', 0, 1.34, -.42, 0, { emissive: '#38d6c0', emissiveIntensity: 1 }));
    const limb = (x, y, h, c) => { const g = new THREE.Group(); g.position.set(x, y, 0); g.add(cone(.13, h, c, 0, -h / 2, 0, 6)); g.children[0].rotation.x = Math.PI; return g; };
    this.la = limb(-.46, 1.23, .62, suit); this.ra = limb(.46, 1.23, .62, suit); this.ll = limb(-.18, .62, .62, dark); this.rl = limb(.18, .62, .62, dark);
    b.add(this.la, this.ra, this.ll, this.rl);
    this.obj.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  }
  teleport(x, y, z) { this.pos.set(x, y, z); this.vy = 0; this.grounded = true; }
  update(dt, input, camYaw, level, frozen) {
    const mv = frozen ? { x: 0, y: 0 } : input.move();
    const run = input.keys.ShiftLeft || input.keys.ShiftRight || Math.hypot(input.joy.x, input.joy.y) > .85;
    const mag = Math.hypot(mv.x, mv.y), target = (run ? 10 : 6.6) * mag;
    this.speed = lerp(this.speed, target, 1 - Math.exp(-dt * 12));
    const prev = { x: this.pos.x, z: this.pos.z };
    if (mag > .02) {
      const s = Math.sin(camYaw), c = Math.cos(camYaw), wx = mv.x * c + mv.y * s, wz = -mv.x * s + mv.y * c;
      const wy = Math.atan2(wx, wz); let d = wy - this.yaw; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832;
      this.yaw += d * (1 - Math.exp(-dt * 13));
      const l = Math.hypot(wx, wz) || 1; this.pos.x += wx / l * this.speed * dt; this.pos.z += wz / l * this.speed * dt;
    }
    this.obj.rotation.y = this.yaw;
    level.solve(this.pos, .5, prev);
    if (!frozen && input.takeJump() && (this.grounded || this.coyote > 0)) { this.vy = 9; this.grounded = false; this.coyote = 0; sfx('jump'); }
    this.vy -= 24 * dt; this.pos.y += this.vy * dt;
    const g = level.groundAt(this.pos.x, this.pos.z, this.pos.y + .5);
    const wasAir = !this.grounded;
    if (this.pos.y <= g) {
      if (wasAir && this.vy < -9) this.squash = 1;
      this.pos.y = g; this.vy = 0; this.grounded = true; this.coyote = .12;
    } else if (this.grounded && this.pos.y - g < .45 && this.vy <= 0) { this.pos.y = g; this.vy = 0; }  // Yokuş aşağı yapışma
    else { this.grounded = false; this.coyote -= dt; }
    this.anim(dt);
  }
  /** Yürüme, koşma, zıplama animasyonu: uzak oyuncular da aynı kodu kullanır */
  anim(dt) {
    this.phase += this.speed * dt * 1.65;
    const sw = Math.sin(this.phase) * Math.min(1, this.speed / 5) * .85;
    if (this.grounded) { this.la.rotation.x = sw; this.ra.rotation.x = -sw; this.ll.rotation.x = -sw; this.rl.rotation.x = sw; }
    else { this.la.rotation.x = this.ra.rotation.x = -2.2; this.ll.rotation.x = .5; this.rl.rotation.x = -.5; }
    this.body.position.y = this.grounded ? Math.abs(Math.cos(this.phase)) * .08 * Math.min(1, this.speed / 5) : 0;
    this.squash = Math.max(0, (this.squash || 0) - dt * 5);
    const q = this.squash; this.body.scale.set(1 + q * .22, 1 - q * .28, 1 + q * .22);
    this.leaf.rotation.x = Math.sin(this.phase * 1.3) * .35;
    this.head.rotation.y = Math.sin(performance.now() * .0007) * .12;
  }
}

/** Üçüncü şahıs kamera */
export class FollowCam {
  constructor(camera, dist = 9.5) { this.camera = camera; this.yaw = 0; this.pitch = .38; this.dist = dist; this.t = new THREE.Vector3(); this.first = true; }
  update(dt, input, player, level, minPitch = -.1) {
    this.yaw -= input.look.x * .0052; this.pitch = clamp(this.pitch + input.look.y * .004, minPitch, 1.25);
    this.dist = clamp(this.dist + input.zoom, 4.5, 16);
    input.look.x = input.look.y = 0; input.zoom = 0;
    const f = this.first ? 1 : 1 - Math.exp(-dt * 11); this.first = false;
    this.t.x = lerp(this.t.x, player.pos.x, f); this.t.z = lerp(this.t.z, player.pos.z, f); this.t.y = lerp(this.t.y, player.pos.y + 1.5, 1 - Math.exp(-dt * (this.first ? 99 : 7)));
    const cp = Math.cos(this.pitch), c = this.camera;
    const want = level.cameraLimit ? level.cameraLimit(this.t, Math.sin(this.yaw), Math.cos(this.yaw), this.dist, this.pitch) : this.dist;
    this.cur = this.cur === undefined ? want : lerp(this.cur, want, 1 - Math.exp(-dt * (want < this.cur ? 12 : 2.5)));
    c.position.set(this.t.x + Math.sin(this.yaw) * cp * this.cur, this.t.y + Math.sin(this.pitch) * this.cur, this.t.z + Math.cos(this.yaw) * cp * this.cur);
    level.cameraFix?.(c.position);
    c.lookAt(this.t);
  }
}
