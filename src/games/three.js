import * as THREE from 'three';
import { h, clamp, rnd, shuffle } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';
import { ball, box, cyl, cone, ring, glow, billboard } from '../world/kit.js';
import { FollowCam } from '../world/player.js';
import { height } from '../world/terrain.js';
import { GAMES } from '../core/data.js';
import { steps } from './shell.js';

const persp = () => new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 400);

// 2) KLOROPLAST KEŞFİ — 3D sahne içinde tarama
export function kloroplast(ctx) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d3d2a'); scene.fog = new THREE.FogExp2('#0d3d2a', .007);
  scene.add(new THREE.HemisphereLight('#efffcf', '#1b5a3a', 2.2)); const d = new THREE.DirectionalLight('#fff', 1.6); d.position.set(5, 10, 8); scene.add(d);
  const cam = persp(); const root = new THREE.Group(); scene.add(root); const targets = [];
  const reg = (part, ...objs) => objs.forEach(o => { o.userData.part = part; targets.push(o); });
  const proxy = (r, x, y, z, part) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); root.add(m); reg(part, m); };
  // Stroma: ortamda süzülen hafif sarı bloklar (enzim kümeleri)
  const shell = (rx, rt, c, op) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: op, side: THREE.BackSide, roughness: .6, depthWrite: false })); m.scale.set(rx, rt, rt); root.add(m); return m; };
  shell(34, 21, '#79d95a', .28); shell(32.4, 19.4, '#b9e85a', .3);
  // Kalın membran bantları tıklanabilir
  const band = (rx, rt, c, part) => { for (const a of [0, 1.05, 2.1]) { const curve = new THREE.EllipseCurve(0, 0, rx, rt, 0, 6.2832), pts = curve.getPoints(70).map(p => new THREE.Vector3(p.x, p.y, 0)); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 90, .32, 6, true), new THREE.MeshStandardMaterial({ color: c, roughness: .4, emissive: c, emissiveIntensity: .35 })); m.rotation.x = a; root.add(m); reg(part, m); } };
  band(34, 21, '#ffe48a', 'dis'); band(32, 19, '#58e0a4', 'ic');
  const lm = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .5, ...o });
  const grana = [[-13, -3, 1], [-5, 2, -3], [6, -3, 1], [14, 3, -2], [-1, -7, -4], [8, 6, -2]];
  grana.forEach(([x, y, z], gi) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = gi % 2 ? .25 : -.2;
    for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, .4, 16), lm(i % 2 ? '#2e8f3c' : '#49b44b')); t.position.y = i * .55 - 1.4; g.add(t); }
    root.add(g); proxy(3, x, y, z, 'granum');
    if (gi < grana.length - 1) { const [nx, ny, nz] = grana[gi + 1]; const dv = new THREE.Vector3(nx - x, ny - y, nz - z), l = new THREE.Mesh(new THREE.BoxGeometry(.16, dv.length(), .55), lm('#68c24f')); l.position.set(x + dv.x / 2, y + dv.y / 2, z + dv.z / 2); l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize()); root.add(l); }
  });
  // Büyük tek tilakoit: dış zar parlak yeşil
  const thy = new THREE.Group(); thy.position.set(-6, 7, 0); thy.rotation.x = .4;
  const tm = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, .7, 22, 1, true), lm('#7ef25a', { side: 2 })); const tTop = new THREE.Mesh(new THREE.RingGeometry(1.9, 3.3, 22), lm('#7ef25a', { side: 2 })); tTop.rotation.x = -1.57; tTop.position.y = .35; thy.add(tm, tTop);
  const lumen = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, .55, 18), lm('#b8f58a', glow('#7ef25a', .4))); thy.add(lumen); root.add(thy); reg('tilakoit', tm, tTop, lumen);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.09), new THREE.MeshBasicMaterial({ color: '#fff' })); m.position.set(Math.cos(i) * 1.2, .35, Math.sin(i) * 1.2); thy.add(m); }
  // DNA, nişasta, stroma kümeleri
  const dna = new THREE.Mesh(new THREE.TorusKnotGeometry(1.4, .22, 70, 8, 2, 3), lm('#ffb02e', glow('#ff8a00', .55))); dna.position.set(15, -6, 1); root.add(dna); reg('dna', dna); proxy(2.6, 15, -6, 1, 'dna');
  const starch = new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 2), lm('#f6f3e4')); starch.scale.set(1.3, .85, 1); starch.position.set(-17, 4, -2); root.add(starch); reg('nisasta', starch);
  const blobs = [[2, 8, 2], [-9, -8, 2], [20, 2, 2], [-21, -2, 1], [4, -9, 3]].map(([x, y, z], i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: '#d7ff6b', transparent: true, opacity: .55, emissive: '#b8e83c', emissiveIntensity: .5, flatShading: true })); m.position.set(x, y, z); root.add(m); reg('stroma', m); proxy(2, x, y, z, 'stroma'); return m; });

  const Q = [
    ['dis', 'Etrafına bak: kloroplastı saran en dıştaki parlak sarı zar bandını bul.', 'Dış zar: Kloroplast çift zarlıdır; bu zar dışarıyla sınırdır.'],
    ['ic', 'Sarı bandın hemen içindeki, stromayı çevreleyen turkuaz zarı bul.', 'İç zar: Stromayı çevreleyen ikinci zardır.'],
    ['stroma', 'Işığın kullanılmadığı tepkimelerin gerçekleştiği sıvı kısmı bul (parlak sarı-yeşil kümeler).', 'Stroma: Calvin döngüsü burada gerçekleşir.'],
    ['granum', 'Para yığını gibi üst üste dizili keseleri bul.', 'Granum: Üst üste dizilmiş tilakoitler.'],
    ['tilakoit', 'Büyütülmüş tek yassı keseyi (klorofil taşıyan tilakoit) bul.', 'Tilakoit zarı: Klorofil burada bulunur, ışığın kullanıldığı tepkimeler burada olur.'],
    ['dna', 'Kloroplastın kendi genetik materyalini bul.', 'Kloroplast DNA’sı: Kloroplastın kendine ait DNA’sı vardır.'],
    ['nisasta', 'Fazla glikozun depolandığı beyaz tanecik nerede?', 'Nişasta: Glikozun depo biçimi.'],
  ];
  const FULL = Math.ceil(1000 / Q.length); let i = 0, miss = 0, pts = FULL, intro = 1;
  ctx.dbg = { targets, cam, want: () => Q[i]?.[0] };
  const panel = h('div.kl-clue', h('div.chip', 'Tarayıcı Görevi'), h('p', ''), steps(Q.length, 0)); ctx.passthrough();
  const hud = h('div.kl-hud', panel); ctx.root.append(hud);
  const show = () => { panel.querySelector('p').textContent = Q[i][1]; panel.querySelector('.steps').replaceWith(steps(Q.length, i)); };
  show();
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); const hits = [];
  let yaw = 0, pit = 0, dragging = null, moved = 0;
  const cv = ctx.app.canvas;
  const onDown = e => { dragging = [e.clientX, e.clientY]; moved = 0; };
  const onMove = e => { if (!dragging) return; const dx = e.clientX - dragging[0], dy = e.clientY - dragging[1]; yaw += dx * .0045; pit = clamp(pit + dy * .0045, -1.35, 1.35); moved += Math.abs(dx) + Math.abs(dy); dragging = [e.clientX, e.clientY]; };
  const onUp = e => {
    if (!dragging) return; dragging = null; if (moved > 10) return;
    ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, cam);
    const h0 = ray.intersectObjects(targets, false)[0]; if (!h0) return;
    const p = h0.object.userData.part, pos = h0.point;
    if (p === Q[i][0]) {
      ctx.add(pts); pts = FULL; ctx.good(Q[i][2]);
      const lb = billboard(names[p], '#fff', 7); lb.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0)); root.add(lb); hits.push(lb);
      i++; if (i >= Q.length) return ctx.after(900, () => ctx.finish({ success: true, score: ctx.score, note: `${miss} yanlış tarama ile kloroplastın haritasını çıkardın.` }));
      show();
    } else { miss++; pts = Math.max(40, pts - 25); ctx.bad(`Bu ${names[p]}. ${miss < 5 ? 'İpucunu yeniden oku.' : ''}`); if (miss >= 5) ctx.finish({ success: false, score: ctx.score, note: 'Tarayıcının enerjisi bitti. Yapıların yerlerine dikkat et.' }); }
  };
  const names = { dis: 'Dış zar', ic: 'İç zar', stroma: 'Stroma', granum: 'Granum', tilakoit: 'Tilakoit zarı', dna: 'Kloroplast DNA’sı', nisasta: 'Nişasta' };
  ctx.on(cv, 'pointerdown', onDown); ctx.on(window, 'pointermove', onMove); ctx.on(window, 'pointerup', onUp);
  ctx.use3D({ scene, camera: cam, update(dt, t) {
    intro = Math.max(0, intro - dt * .5);
    // Dışarıdan zarın içine süzül, sonra içeride serbestçe etrafına bak
    cam.position.set(Math.sin(t * .25) * .8, Math.sin(t * .4) * .5, 16 + intro * intro * 50);
    const cp = Math.cos(pit); cam.lookAt(cam.position.x + Math.sin(yaw) * cp, cam.position.y + Math.sin(pit), cam.position.z - Math.cos(yaw) * cp);
    dna.rotation.y = t * .5; blobs.forEach((b, k) => { b.position.y += Math.sin(t + k) * .005; b.rotation.y = t * .4; });
  } });
}

// 9) BİTKİYİ KURTAR — 3D sera; belirtiye göre müdahale
export function kurtar(ctx) {
  const scene = new THREE.Scene(); const bg = new THREE.Color('#9fdccb'); scene.background = bg;
  const hemi = new THREE.HemisphereLight('#ffffff', '#6d9a55', 1.5), sun = new THREE.DirectionalLight('#fff0cf', 2.4); sun.position.set(5, 10, 6); scene.add(hemi, sun);
  const cam = persp(); cam.position.set(0, 3.2, innerWidth < innerHeight ? 8.2 : 6.2); cam.lookAt(0, 1.2, 0);
  const G = new THREE.Group(); scene.add(G);
  G.add(box(8, .2, 5, '#c9c6b4', 0, -.6, 0), cyl(.8, .55, 1, '#c76b42', 0, 0, 0), cyl(.72, .72, .1, '#5b3f25', 0, .47, 0));
  for (const x of [-3.6, 3.6]) G.add(box(.12, 5, .12, '#f5f4ea', x, 2, -2.2));
  G.add(box(7.4, .12, .12, '#f5f4ea', 0, 4.5, -2.2));
  const stem = cyl(.07, .1, 2.4, '#3d9a4c', 0, 1.6, 0); G.add(stem);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#57c04a', flatShading: true, roughness: .7 });
  const leaves = Array.from({ length: 8 }, (_, i) => { const p = new THREE.Group(), l = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 1), leafMat); l.scale.set(1.5, .12, .7); l.position.x = .78; p.add(l); p.position.y = .9 + i * .24; p.rotation.y = i * 2.4; G.add(p); return p; });
  const lamp = new THREE.SpotLight('#fff3b0', 0, 12, .7, .5); lamp.position.set(0, 4.5, 2); lamp.target.position.set(0, 1, 0); scene.add(lamp, lamp.target);
  const co2 = Array.from({ length: 10 }, () => { const m = ball(.09, '#9aa8ff', rnd(-2.5, 2.5), rnd(.5, 3.5), rnd(-1, 1), 0); m.visible = false; scene.add(m); return m; });
  const TOOLS = [['lamp', 'Lamba', 'lamp'], ['water', 'Sulama', 'drop'], ['co2', 'CO₂ Vanası', 'co2'], ['cool', 'Soğutma', 'fan'], ['mg', 'Mineral Gübre', 'leaf']];
  const SY = {
    lamp: { s: 'Sera karardı; hiç O₂ kabarcığı çıkmıyor.', fx: { dark: 1 }, why: 'Işık olmadan klorofil enerji soğuramaz.' },
    water: { s: 'Yapraklar sarkıyor, toprak kupkuru.', fx: { wilt: 1 }, why: 'Su eksikliğinde stomalar kapanır ve fotosentez yavaşlar.' },
    co2: { s: 'Işık ve su yeterli, ama kapalı serada CO₂ azaldı.', fx: { co2: 1 }, why: 'Bitki, glikoz yapımında karbon kaynağı olarak CO₂ kullanır.' },
    cool: { s: 'Sera 42 °C oldu. Fotosentez hızı düşüyor!', fx: { hot: 1 }, why: 'Aşırı sıcakta enzimler iyi çalışamaz.' },
    mg: { s: 'Su ve ışık yeterli, ama yapraklar sararıyor: toprakta mineral az.', fx: { yellow: 1 }, why: 'Mineral eksikliğinde klorofil üretimi azalır.' },
  };
  let health = 100, cur = null, fixed = 0, waitT = 1, t0 = 0, st = { dark: 0, wilt: 0, co2: 0, hot: 0, yellow: 0 }, last = '';
  const GOAL = 10; ctx.dbg = { cur: () => cur, use: id => use(id) };
  const sym = h('div.pl-sym', h('div.chip', 'Bitki Durumu'), h('p', 'Şimdilik iyi görünüyor… izlemede kal.')), hpBar = h('i');
  const tools = h('div.pl-tools', ...TOOLS.map(([id, n, ic]) => h('button.pl-tool', { html: icon(ic, 26) + `<span>${n}</span>`, onclick: () => use(id) })));
  ctx.root.append(h('div.pl', h('div.pl-top', h('div.meter', h('label', `Bitki sağlığı · ${'Çözülen'} `), h('div.bar.green', hpBar)), sym), tools));
  function use(id) {
    if (!cur) { sfx('tick'); ctx.toast('Şu an bir sorun yok; gereksiz müdahale etme.', 'info'); health = Math.max(0, health - 2); return; }
    if (id === cur) {
      fixed++; ctx.add(70 + Math.max(0, 8 - (performance.now() - t0) / 1000) * 3); ctx.good(SY[id].why);
      for (const k in SY[id].fx) st[k] = 0; cur = null; waitT = rnd(1, 2.2); sym.querySelector('p').textContent = `Bitki rahatladı (${fixed}/${GOAL}). Yeni belirtileri izle.`; sym.classList.remove('alert');
      if (fixed >= GOAL) ctx.after(500, () => ctx.finish({ success: true, score: ctx.score + health * 2.5, note: `Bitki %${Math.round(health)} sağlıkla iyileşti.` }));
    } else { health -= 9; ctx.bad('Bu belirtiye uymuyor; bitki strese girdi.'); }
  }
  ctx.loop((dt, t) => {
    if (!cur && fixed < GOAL) { waitT -= dt; if (waitT <= 0) { const opts = Object.keys(SY).filter(k => k !== last); cur = opts[Math.floor(rnd(opts.length))]; last = cur; Object.assign(st, SY[cur].fx); t0 = performance.now(); sym.querySelector('p').textContent = SY[cur].s; sym.classList.add('alert'); sfx('bad'); } }
    if (cur) { health -= dt * (2.6 + fixed * .22); if (health <= 0) return ctx.finish({ success: false, score: ctx.score, note: `Bitki dayanamadı. ${SY[cur].why}` }); }
    hpBar.style.width = clamp(health, 0, 100) + '%';
    const k = 1 - Math.exp(-dt * 4);
    hemi.intensity += ((st.dark ? .35 : 1.5) - hemi.intensity) * k; sun.intensity += ((st.dark ? .1 : 2.4) - sun.intensity) * k; lamp.intensity += ((st.dark ? 0 : 0) - lamp.intensity) * k;
    bg.lerp(new THREE.Color(st.dark ? '#22332f' : st.hot ? '#e8a06b' : '#9fdccb'), k);
    leafMat.color.lerp(new THREE.Color(st.yellow ? '#d9d04a' : st.wilt ? '#8aa54a' : '#57c04a'), k);
    leaves.forEach((p, i) => { const tg = st.wilt ? .95 : -.1 + Math.sin(t * 1.4 + i) * .05; p.rotation.z += (tg - p.rotation.z) * k; });
    co2.forEach((m, i) => { m.visible = !st.co2; m.position.y = (m.position.y + dt * .3) % 4; m.position.x += Math.sin(t + i) * .002; });
  });
  ctx.use3D({ scene, camera: cam, update() {} });
}

// 11) GÜNEŞ PARKURU — gerçek 3D platform
export function parkur(ctx) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#8fd7f0'); scene.fog = new THREE.Fog('#8fd7f0', 50, 170);
  scene.add(new THREE.HemisphereLight('#fff7dc', '#6ca8a0', 1.8)); const sun = new THREE.DirectionalLight('#fff0cf', 2.6); sun.position.set(20, 50, 10); sun.castShadow = ctx.app.Q.shadow; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 160 }); scene.add(sun, sun.target);
  const sg = new THREE.Mesh(new THREE.IcosahedronGeometry(6, 2), new THREE.MeshBasicMaterial({ color: '#ffe066' })); sg.position.set(0, 42, -62); scene.add(sg);
  const cam = persp();
  const P = []; // Platformlar: x z y r renk hareket
  const add = (x, z, y, r, c = '#6fd14c', mv) => { const g = new THREE.Group(); const top = cyl(r, r * .7, .5, c, 0, -.25, 0, 10); g.add(top); if (r > 2) { const l = ball(r * .3, '#3f9f50', r * .4, -.9, 0, 0); g.add(l); } g.position.set(x, y, z); scene.add(g); const p = { g, x, z, y, r, mv, bx: x, bz: z, by: y }; P.push(p); return p; };
  const course = [[0, 0, 0, 6], [0, -9, .8, 2.6], [4, -15, 1.8, 2.3], [10, -19, 3, 2.3], [15, -14, 4.2, 2.2], [20, -9, 5.4, 2.3, '#ffb02e'],
    [14, -3, 6.6, 2, '#6fd14c', { x: 5, s: 1 }], [5, -2, 7.6, 2.3], [-3, -5, 8.6, 2], [-10, -9, 9.8, 2.2, '#ffb02e'], [-14, -16, 11, 2, '#6fd14c', { z: 4, s: 1.2 }], [-13, -26, 12.4, 2.4],
    [-6, -30, 13.4, 2], [1, -33, 14.6, 2, '#6fd14c', { y: 2.2, s: 1 }], [8, -36, 17, 2.3, '#ffb02e'], [14, -41, 18.2, 2, '#6fd14c', { x: 4, s: 1.4 }], [6, -48, 19.4, 2.2], [0, -54, 20.6, 4.5, '#ffd24c']];
  course.forEach(c => add(c[0], c[1], c[2], c[3], c[4], c[5]));
  const altar = cyl(1.4, 2, 1, '#fff27a', 0, 21.1, -54, 8, glow('#ffb300', .8)); scene.add(altar); const crown = ring(2.3, .14, '#ffe48a', 0, 22.7, -54, glow('#ffb300', 1.3)); scene.add(crown);
  for (let i = 0; i < 18; i++) { const cl = ball(rnd(2, 5), '#ffffff', rnd(-55, 55), rnd(-12, 32), rnd(-75, 12), 0, { emissive: '#ddd', emissiveIntensity: .45 }); cl.scale.y = .45; cl.castShadow = false; scene.add(cl); }
  // Işık kristalleri
  const ph = []; course.slice(1, -1).forEach(([x, z, y], i) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.42), new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb300', emissiveIntensity: 1.3 })); m.position.set(x, y + 1.35, z); scene.add(m); ph.push({ m, on: true, i }); });
  const CP = [0, 5, 9, 12, 14].map(i => P[i]);
  const pl = ctx.app.player; const prevScene = pl.obj.parent; scene.add(pl.obj);
  const savePos = pl.pos.clone(); pl.teleport(0, .1, 0); pl.yaw = Math.PI; const fc = new FollowCam(cam, 10); fc.yaw = 0; fc.pitch = .42; fc.first = true;
  let checkpoint = P[0], got = 0, finished = false, falls = 0;
  const NEED = 10; ctx.dbg = { ph, end: () => P[P.length - 1].g.position };
  const lv = {
    groundAt(x, z, y) { let g = -60; for (const p of P) if (Math.hypot(x - p.g.position.x, z - p.g.position.z) < p.r + .2 && y >= p.g.position.y - .2) g = Math.max(g, p.g.position.y); return g; },
    solve() {},
  };
  ctx.passthrough(); ctx.app.setTouchControls(true, true);
  const finishNow = ok => { if (finished) return; finished = true; const c = ctx; c.finish({ success: ok, score: ok ? clamp(got * 40 + timer.left * 7 - falls * 12 + 150, 0, 1000) : got * 30, note: ok ? `${got} ışık kristali topladın, ${falls} kez düştün.` : `Süre doldu. ${got} ışık kristali topladın.` }); };
  const timer = ctx.countdown(110, () => finishNow(false));
  const FACT = ['Işık enerjisi pigmentlerce yakalandı!', 'Elektronlar elektron taşıma sisteminde ilerliyor…', 'ATP üretildi!', 'NADPH hazır, Calvin döngüsü seni bekler.'];
  ctx.__prev = { prevScene, savePos };
  ctx.loop(() => {});
  const clean = ctx.app.shell.cur; clean.onStop = () => { prevScene.add(pl.obj); pl.pos.copy(savePos); ctx.app.setTouchControls(false); };
  ctx.use3D({ scene, camera: cam, update(dt, t) {
    P.forEach(p => { if (p.mv) { const q = Math.sin(t * p.mv.s), o = p.g.position.clone(); p.g.position.set(p.bx + (p.mv.x || 0) * q, p.by + (p.mv.y || 0) * q, p.bz + (p.mv.z || 0) * q);
      if (pl.grounded && Math.hypot(pl.pos.x - o.x, pl.pos.z - o.z) < p.r && Math.abs(pl.pos.y - o.y) < .1) { pl.pos.x += p.g.position.x - o.x; pl.pos.z += p.g.position.z - o.z; pl.pos.y = p.g.position.y; } } });
    pl.update(dt, ctx.input, fc.yaw, lv, false); fc.update(dt, ctx.input, pl, lv, .05);
    sun.target.position.copy(pl.pos); sun.position.copy(pl.pos).add(new THREE.Vector3(20, 45, 10));
        crown.rotation.y = t; crown.rotation.x = Math.sin(t) * .5;
    for (const k of ph) { if (!k.on) continue; k.m.rotation.y = t * 3; k.m.position.y += Math.sin(t * 3 + k.i) * .004; if (k.m.position.distanceTo(pl.pos.clone().setY(pl.pos.y + .9)) < 1.7) { k.on = false; k.m.visible = false; got++; ctx.add(25); sfx('collect'); if (got % 4 === 0) ctx.toast(FACT[got / 4 - 1] || 'Enerji artıyor!', 'good'); else ctx.toast(`Işık kristali ${got}/${NEED}`, 'info', 700); } }
    for (const cp of CP) if (pl.grounded && cp.by > checkpoint.by && Math.hypot(pl.pos.x - cp.g.position.x, pl.pos.z - cp.g.position.z) < cp.r && Math.abs(pl.pos.y - cp.g.position.y) < .3) { checkpoint = cp; ctx.toast('Kontrol noktası', 'info', 800); sfx('good'); }
    if (pl.pos.y < -14) { falls++; const q = checkpoint.g.position; pl.teleport(q.x, q.y + .1, q.z); fc.first = true; ctx.bad(); }
    const end = P[P.length - 1].g.position;
    if (pl.grounded && Math.hypot(pl.pos.x - end.x, pl.pos.z - end.z) < 4.5 && Math.abs(pl.pos.y - end.y) < .5) {
      if (got >= NEED) { sfx('win'); finishNow(true); } else if (!ctx.__warn) { ctx.__warn = 1; ctx.toast(`Sunak için ${NEED} ışık kristali gerekli (${got}). Düşmekten korkma!`, 'bad', 3200); ctx.after(4000, () => { ctx.__warn = 0; }); }
    }
  } });
}

// 14) BİLGİ KAŞİFİ — gerçek dünyada kristal avı
export function kasif(ctx) {
  const SPOTS = [
    { p: [-5, 34], c: 'Yolların laboratuvara kavuştuğu yerin yakınında.', f: 'Klorofil en çok mavi-mor ve kırmızı ışığı soğurur.' },
    { p: [34, -16], c: 'Göle giden yolda; su kokusu alıyorsan yaklaştın.', f: 'Fotolizde su parçalanır; O₂ sudan gelir.' },
    { p: [14, -56], c: 'Devler arasında, kuzeyde.', f: 'Calvin döngüsü stromada gerçekleşir, ATP ve NADPH harcar.' },
    { p: [-48, -2], c: 'Batı ormanının içinde bir yol kenarında.', f: 'CO₂ yaprağa stomalardan girer.' },
    { p: [-52, 38], c: 'Ormanın güneyinde küçük bir göletin yanında.', f: 'Yapraktaki palizat hücreleri kloroplastça zengindir.' },
    { p: [52, 22], c: 'Doğudaki büyük gölün güney kıyısında.', f: 'Fotosentez hızı ışık, CO₂ ve sıcaklığa bağlıdır.' },
  ];
  const app = ctx.app; let found = 0, idx = 0;
  ctx.passthrough(); ctx.root.classList.add('world-mission');
  const clue = h('div.kl-clue.mission', h('div.chip', { html: icon('compass', 14) + ' Bilgi Kaşifi' }), h('p'), h('div.radar', h('i')), h('small.rad-t'));
  ctx.root.append(clue);
  const crystals = SPOTS.map((s, i) => {
    const y = height(s.p[0], s.p[1]);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(.8), new THREE.MeshStandardMaterial({ color: '#ffd76b', emissive: '#ffb300', emissiveIntensity: 1.3 }));
    m.position.set(s.p[0], y + 1.6, s.p[1]); m.visible = false; app.world.scene.add(m);
    return { m, s, pos: new THREE.Vector3(s.p[0], y, s.p[1]) };
  });
  const order = shuffle([...crystals]); const facts = [];
  const show = () => { const c = order[idx]; c.m.visible = true; clue.querySelector('p').textContent = `Kristal ${idx + 1}/6: ${c.s.c}`; };
  show();
  app.setMission({
    interact: () => { const c = order[idx]; if (!c) return []; return [{ id: 'crystal', pos: c.pos, r: 3.4, label: () => 'Bilgi kristalini al', icon: 'compass', act: grab }]; },
  });
  function grab() {
    const c = order[idx]; app.world.scene.remove(c.m); facts.push(c.s.f); idx++; ctx.add(90); sfx('collect'); ctx.toast(c.s.f, 'good', 4200);
    if (idx >= order.length) { quiz(); return; } show();
  }
  ctx.dbg = { next: () => order[idx] };
  const bar = clue.querySelector('.radar i'), rt = clue.querySelector('.rad-t');
  const pp = app.player.pos;
  const timer = ctx.countdown(240, () => ctx.finish({ success: false, score: ctx.score, note: `${idx}/6 kristal buldun. Radar kırmızıya yaklaştıkça sıcak demektir.` }));
  ctx.loop((dt, t) => {
    const c = order[idx]; if (!c) return;
    c.m.rotation.y = t * 2; c.m.position.y = c.pos.y + 1.6 + Math.sin(t * 2.5) * .25;
    const d = Math.hypot(pp.x - c.pos.x, pp.z - c.pos.z), q = clamp(1 - d / 110);
    bar.style.width = q * 100 + '%'; bar.style.background = `hsl(${200 - q * 200},85%,58%)`;
    rt.textContent = d < 12 ? 'Çok sıcak! Etrafına bak.' : d < 30 ? 'Sıcak' : d < 60 ? 'Ilık' : 'Soğuk';
  });
  // Sonda bilgi kilidi
  const Qs = [
    { q: 'Calvin döngüsü kloroplastın neresinde gerçekleşir?', a: 'Stromada', o: ['Stromada', 'Dış zarda', 'Hücre zarında'] },
    { q: 'Açığa çıkan O₂’nin kaynağı nedir?', a: 'Su', o: ['Su', 'CO₂', 'Glikoz'] },
    { q: 'CO₂ yaprağa nereden girer?', a: 'Stomalardan', o: ['Stomalardan', 'Köklerden', 'Floemden'] },
  ];
  ctx.app.shell.cur.onStop = () => { app.setMission(null); crystals.forEach(c => app.world.scene.remove(c.m)); };
  function quiz() {
    timer.stop = true; app.setMission(null); ctx.root.classList.remove('world-mission'); clue.remove();
    const el = ctx.root.closest('.gm'); el.classList.remove('pass');
    let i = 0, ok = 0; const box = h('div.gm-intro'); ctx.root.append(box);
    const next = () => {
      if (i >= Qs.length) return ctx.finish({ success: true, score: ctx.score + timer.left * .7 + ok * 45, note: `Kristallerden gelen bilgiyle ${ok}/3 kilit açıldı.` });
      const q = Qs[i]; box.innerHTML = '';
      box.append(h('div.gm-card.pop', h('div.chip', `Bilgi Kilidi ${i + 1}/3`), h('h3', q.q), ...shuffle([...q.o]).map(o => h('button.tile', { onclick: () => { if (o === q.a) { ok++; ctx.good(); } else ctx.bad(`Doğrusu: ${q.a}`); i++; next(); } }, o))));
    };
    next();
  }
}

// 15) BÜYÜK FOTOSENTEZ GÖREVİ — üç aşamalı final
export function final(ctx) {
  const R = h('div.fn'); ctx.root.append(R); let errs = 0; const MAX = 5;
  const lifeEl = h('div.fn-lives');
  const lives = () => { lifeEl.innerHTML = Array.from({ length: MAX }, (_, i) => `<span class="${i < MAX - errs ? 'on' : ''}">${icon('core', 18)}</span>`).join(''); };
  const oops = t => { errs++; ctx.add(-30); ctx.bad(t); lives(); if (errs >= MAX) { ctx.finish({ success: false, score: ctx.score, note: 'Çekirdek yeniden kapandı. Işık → ATP/NADPH → Calvin → ekosistem sırasını düşün.' }); return true; } return false; };
  const head = (i, t, p) => { R.innerHTML = ''; lives(); R.append(h('div.fn-head', steps(3, i), lifeEl, h('h3', t), h('p', p))); };
  ctx.countdown(240, () => ctx.finish({ success: false, score: ctx.score, note: 'Süre doldu; çekirdek soğudu.' }));

  // Aşama 1: Işık hattı: elektronu sırayla ilerlet
  function s1() {
    head(0, '1. Işık Hattını Kur', 'Işığın kullanıldığı tepkimeleri sırala: ilk ne olur, sonra ne gelir?');
    const seq = [['Işık', 'Güneş ışığı kloroplasta ulaştı'], ['Klorofil', 'Pigmentler ışık enerjisini yakaladı'], ['Fotoliz', 'Su parçalandı, O₂ açığa çıktı'], ['Elektron Taşıma', 'Elektronlar elektron taşıma sisteminde ilerledi'], ['ATP + NADPH', 'Kimyasal enerji depolandı']];
    const board = h('div.fn-board'); const trail = h('div.fn-trail'); R.append(trail, board);
    let k = 0;
    shuffle(seq.map((s, i) => ({ s, i }))).forEach(({ s, i }) => board.append(h('button.fn-node', { onclick: e => {
      if (i === k) { const b = e.currentTarget; b.classList.add('on'); b.disabled = true; trail.append(h('span', s[0])); ctx.add(60); sfx('collect'); ctx.toast(s[1], 'good', 1400); k++; if (k === seq.length) ctx.after(800, s2); }
      else oops('Sıra bu değil: önce neyin olması gerektiğini düşün.');
    } }, h('b', s[0]))));
  }
  // Aşama 2: Calvin motoru: yakıtı doğru sırayla ver
  function s2() {
    head(1, '2. Besin Motorunu Çalıştır', 'Işığın kullanılmadığı tepkimeler için doğru cevabı seç.');
    const Q = [
      { n: 'Hangi maddeler kullanılır?', a: 'CO₂, ATP ve NADPH', o: ['CO₂, ATP ve NADPH', 'O₂ ve H₂O', 'Glikoz ve O₂'], w: 'Stromada CO₂, ATP ve NADPH kullanılır.' },
      { n: 'Hangi besin üretilir?', a: 'Glikoz', o: ['Glikoz', 'Oksijen', 'Klorofil'], w: 'Calvin döngüsünün sonunda glikoz oluşur.' },
      { n: 'Tilakoide ne döner?', a: 'ADP ve NADP⁺', o: ['ADP ve NADP⁺', 'O₂ ve CO₂', 'Glikoz ve su'], w: 'ADP ve NADP⁺, yeniden ATP ve NADPH yapımında kullanılır.' },
    ];
    const pist = h('div.fn-engine'); R.append(pist); let i = 0;
    const show = () => {
      if (i >= Q.length) return s3();
      const q = Q[i]; pist.innerHTML = ''; pist.append(h('div.fn-gear', { html: icon('cycle', 54), style: { animationDuration: 3 - i * .8 + 's' } }), h('b', q.n), h('div.fn-opts', ...shuffle([...q.o]).map(o => h('button.tile', { onclick: e => { if (o === q.a) { ctx.add(110); ctx.good(q.w); i++; show(); } else { e.currentTarget.disabled = true; oops('Motor tekledi: bu girdiler bu aşamada kullanılmaz.'); } } }, o))));
    };
    show();
  }
  // Aşama 3: Ekosistem ağı: okları etiketle
  function s3() {
    head(2, '3. Ekosistemi Bağla', 'Önce bir etikete, sonra doğru oka dokun. Enerji tek yönlü akar, madde döner.');
    const LINKS = [
      { id: 'a', from: 'Güneş', to: 'Bitki', ans: 'Işık enerjisi' }, { id: 'b', from: 'Bitki', to: 'Hayvan', ans: 'Glikoz + O₂' },
      { id: 'c', from: 'Hayvan', to: 'Bitki', ans: 'CO₂ + H₂O' }, { id: 'd', from: 'Canlılar', to: 'Çevre', ans: 'Isı' }, { id: 'e', from: 'Ayrıştırıcı', to: 'Toprak', ans: 'Mineraller' },
    ];
    let sel = null, left = LINKS.length;
    const pool = h('div.pz-pool'), grid = h('div.fn-eco');
    LINKS.forEach(l => {
      const slot = h('button.fn-link', { onclick: () => {
        if (!sel || slot.classList.contains('ok')) return;
        if (sel.dataset.a === l.ans) { slot.classList.add('ok'); slot.querySelector('em').textContent = l.ans; sel.remove(); sel = null; ctx.add(60); sfx('collect'); if (--left === 0) win(); }
        else { sel.classList.remove('sel'); sel = null; oops('Bu ok için doğru akış değil.'); }
      } }, h('span', l.from), h('i', '→'), h('span', l.to), h('em', '?'));
      grid.append(slot);
    });
    shuffle(LINKS.map(l => l.ans)).forEach(a => { const t = h('button.pz-tile', { onclick: () => { sel?.classList.remove('sel'); sel = t; t.classList.add('sel'); sfx('tick'); } }, a); t.dataset.a = a; pool.append(t); });
    R.append(grid, pool);
  }
  function win() {
    ctx.toast('Enerji Çekirdeği yeniden yanıyor!', 'good', 3000); sfx('level');
    ctx.add((MAX - errs) * 14);
    ctx.after(1100, () => ctx.finish({ success: true, score: ctx.score, note: 'Ada yeniden canlandı. Çekirdeği görmek için merkeze bak!' }));
  }
  s1();
}
