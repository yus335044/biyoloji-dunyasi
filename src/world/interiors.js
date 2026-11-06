import * as THREE from 'three';
import { box, cyl, ball, cone, glow, live, sign, bake, textTexture, billboard, uTime } from './kit.js';
import { clamp } from '../core/dom.js';
import { giveCard, unlock, save } from '../core/store.js';
import { sfx } from '../core/audio.js';

// Her iç mekân ayrı bir sahnedir; dünyadan bağımsız yüklenir ve dünyayı render etmez.
function room(w, d, bg, floor, wall, h = 6) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
  const fl = box(w, .2, d, floor, 0, -.1, 0); fl.castShadow = false; scene.add(fl);
  const mk = (W, D, x, z) => { const m = box(W, h, D, wall, x, h / 2, z); m.castShadow = false; scene.add(m); return m; };
  mk(w, .3, 0, -d / 2); mk(w, .3, 0, d / 2); mk(.3, d, -w / 2, 0); mk(.3, d, w / 2, 0);
  const cs = [];
  const lv = {
    scene, colliders: cs, interact: [], name: 'interior',
    groundAt: () => 0,
    solve(p, r) {
      for (const c of cs) { const dx = p.x - c.x, dz = p.z - c.z, q = c.r + r, q2 = dx * dx + dz * dz; if (q2 < q * q && q2 > 1e-5) { const l = Math.sqrt(q2); p.x += dx / l * (q - l); p.z += dz / l * (q - l); } }
      p.x = clamp(p.x, -w / 2 + r + .2, w / 2 - r - .2); p.z = clamp(p.z, -d / 2 + r + .2, d / 2 - r - .2);
    },
    cameraFix(c) { c.x = clamp(c.x, -w / 2 + .5, w / 2 - .5); c.z = clamp(c.z, -d / 2 + .5, d / 2 - .5); c.y = clamp(c.y, .6, h - .3); },
    update(t) { uTime.value = t; lv.tick?.(t); },
    entry: [0, d / 2 - 2], minDist: 4,
  };
  return lv;
}
const exitDoor = (lv, hooks, x, z, label = 'Dışarı çık') => lv.interact.push({ id: 'exit', pos: new THREE.Vector3(x, 0, z), r: 2.3, label: () => label, icon: 'back', act: () => hooks.leaveInterior() });

export function buildYusuf(hooks) {
  const lv = room(13, 11, '#1a1420', '#6b4a33', '#3d3350', 5.2); const s = lv.scene;
  s.add(new THREE.HemisphereLight('#ffe7c4', '#3a2a40', 1.3));
  const lamp = new THREE.PointLight('#ffd08a', 60, 18); lamp.position.set(0, 4.4, 0); s.add(lamp);
  const sc = new THREE.PointLight('#6fffc8', 22, 8); sc.position.set(-3, 2.2, -3.4); s.add(sc);
  const dec = new THREE.Group();
  dec.add(box(13, .1, 11, '#2b2138', 0, 5.15, 0), box(6, .05, 5, '#a2483c', 0, .03, .5)); // Tavan ve halı
  // Masa ve bilgisayar
  dec.add(box(5, .2, 1.6, '#8a5e38', -3, 1.05, -4.3));
  for (const [x, z] of [[-5.2, -3.7], [-.8, -3.7], [-5.2, -4.9], [-.8, -4.9]]) dec.add(box(.16, 1, .16, '#5f3f25', x, .5, z));
  dec.add(box(.5, .35, .3, '#2a2f38', -3, 1.32, -4.5), box(2, .08, .6, '#333a44', -3, 1.19, -3.8));
  dec.add(box(.9, .9, .9, '#2fa58b', -3, .45, -2.6), cyl(.5, .5, .1, '#1d6b63', -3, .95, -2.6, 10));   // Koltuk
  // Kitaplık
  dec.add(box(.5, 4, 4, '#6f4a2b', 6.1, 2, -2));
  const bookC = ['#e45b52', '#42b4ff', '#ffc93c', '#8fe35b', '#c58bff', '#ff8a5c'];
  for (let sh = 0; sh < 4; sh++) { dec.add(box(.6, .1, 3.9, '#8a5e38', 5.95, .5 + sh, -2)); for (let i = 0; i < 11; i++) dec.add(box(.32, .55 + (i * 7 % 3) * .08, .24, bookC[(i + sh * 2) % 6], 5.72, .86 + sh, -3.7 + i * .33)); }
  // Bitkiler, top, kupa, yerde duran kablo
  dec.add(cyl(.45, .32, .6, '#c76b42', 5.3, .3, 4.3), ball(.8, '#3fbf6f', 5.3, 1.2, 4.3), ball(.55, '#57d94a', 4.9, 1.5, 4.6, 0));
  dec.add(cyl(.09, .08, .2, '#fff', -1.4, 1.25, -3.9, 8), ball(.28, '#ff7fb4', -5, 1.43, -4.3, 0));
  dec.add(box(.7, 1.6, .7, '#3a4a58', -5.6, .8, 4.2), ball(.28, '#ffd24c', -5.6, 1.9, 4.2, 0));
  s.add(bake(dec));
  // Bilgisayar ekranı: canlı yazı
  const c = document.createElement('canvas'); c.width = 512; c.height = 288; const x = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.45), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); screen.position.set(-3, 2.25, -4.57); s.add(box(2.7, 1.65, .1, '#1c2128', -3, 2.25, -4.65), screen);
  const draw = t => {
    x.fillStyle = '#071511'; x.fillRect(0, 0, 512, 288); x.fillStyle = '#58ffb0'; x.textAlign = 'center';
    x.font = '600 44px Fredoka, ui-monospace, monospace'; x.fillText('Yusuf.exe çalışıyor...', 256, 110);
    x.font = '26px ui-monospace, monospace'; x.fillStyle = '#2fbf80';
    const dots = Math.floor(t * 2) % 8; x.fillText('[' + '■'.repeat(dots) + ' '.repeat(7 - dots) + ']', 256, 170);
    x.fillText(Math.floor(t * 1.5) % 2 ? 'hayal gücü yükleniyor_' : 'hayal gücü yükleniyor', 256, 220); tex.needsUpdate = true;
  };
  let lastD = -1;
  lv.tick = t => { const d = Math.floor(t * 4); if (d !== lastD) { lastD = d; draw(t); } lamp.intensity = 58 + Math.sin(t * 3) * 3; book.position.y = 1.32 + Math.sin(t * 2) * .03; };
  // Tabelalar: istenen metinler birebir
  const A = sign('Bu dünyayı Yusuf yaptı!', 6, 1.05, { size: 48, bg: '#ffc93c', fg: '#3a2a10', border: '#a0712a', w: 760 }); A.position.set(2.8, 3.7, -5.3); s.add(A);
  const B = sign(['Yusuf’un Gizli', 'Laboratuvarı'], 3.2, 1.5, { bg: '#1d6b63', size: 60, border: '#58ffb0' }); B.rotation.y = Math.PI / 2; B.position.set(-6.3, 3.3, 3); s.add(B);
  const C = sign('Yusuf buradaydı :)', 1.9, .5, { bg: '#f5f4ea', fg: '#333', size: 50, border: '#b9b19a' }); C.rotation.y = -Math.PI / 2 ; C.position.set(6.31, .75, 4.9); s.add(C);
  // Not defteri
  const book = live(box(.8, .12, .6, '#c0392b', -1.1, 1.32, -4.1, glow('#ff5a4d', .4))); book.rotation.y = .3; s.add(book);
  const bookL = billboard('Yusuf’un Not Defteri', '#ffe48a', 3); bookL.position.set(-1.1, 2, -3.9); bookL.visible = true; s.add(bookL);
  lv.colliders.push({ x: -3, z: -2.6, r: .6 }, { x: 5.3, z: 4.3, r: .6 }, { x: -5.6, z: 4.2, r: .7 });
  for (let i = -5.2; i <= -.8; i += 1) lv.colliders.push({ x: i, z: -4.2, r: .75 });
  for (let i = -3.8; i <= -.2; i += 1) lv.colliders.push({ x: 6, z: i, r: .6 });
  // Yusuf'un bilgisayar mesajı: metin birebir istenen haliyle.
  lv.interact.push({ id: 'pc', pos: new THREE.Vector3(-3, 0, -2.8), r: 2.4, label: () => 'Bilgisayarı incele', icon: 'hand', act: () => {
    sfx('secret');
    hooks.dialog('Yusuf.exe', 'Merhaba Kaşif!\n\nBurayı bulmayı başardın! Bu küçük dünyayı Yusuf tasarladı ve geliştirdi.\n\nUmarım keşfederken eğlenmişsindir. Bütün bu dünyanın arkasında biraz emek, biraz hayal gücü ve bolca biyoloji var.\n\nBeni bulduğun için tebrikler!\n\nYusuf', 'crown');
  } });
  lv.interact.push({ id: 'book', pos: new THREE.Vector3(-1.1, 0, -3.1), r: 1.7, label: () => 'Yusuf’un Not Defteri’ni aç', icon: 'book', act: () => {
    sfx('good'); hooks.dialog('Yusuf’un Not Defteri', 'Her büyük proje küçük bir fikirle başlar. Bu da onlardan biri!', 'book');
  } });
  exitDoor(lv, hooks, 0, 4.6, 'Ağaca geri dön');
  const door = box(2, 3, .1, '#ffd76b', 0, 1.5, 5.3, glow('#ffc93c', .6)); s.add(door);
  lv.onEnter = () => { sfx('secret'); unlock('yusuf'); giveCard('h-yusuf'); };
  return lv;
}

export function buildCave(hooks) {
  const lv = room(16, 16, '#0a0d14', '#2c2f38', '#22252e', 5.6); const s = lv.scene;
  s.fog = new THREE.FogExp2('#0a0d14', .045);
  s.add(new THREE.HemisphereLight('#6d6aa8', '#10121a', .85));
  const g = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const a = i * .7, r = 5.6 + (i % 3), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const st = cone(.35 + (i % 3) * .2, 1.5 + (i % 4) * .6, '#3d414e', x * 1.03, 5.1 - (i % 4) * .2, z * 1.03); st.rotation.x = Math.PI; g.add(st);
    if (i % 2) g.add(cone(.3 + (i % 3) * .2, 1.2 + (i % 3) * .5, '#3d414e', x, .6, z));
  }
  s.add(bake(g));
  const cry = [['#c58bff', -4, -4], ['#6fe8ff', 4, -5], ['#a4ff5c', -5, 3], ['#ff7fb4', 5, 3], ['#ffd76b', 0, -6]].map(([c, x, z]) => {
    const m = cone(.55, 2, c, x, 1, z, 5, { ...glow(c, 1.5), roughness: .2 }); s.add(m);
    const l = new THREE.PointLight(c, 14, 9); l.position.set(x, 1.6, z); s.add(l); lv.colliders.push({ x, z, r: .7 }); return { m, l };
  });
  // Yaşlı kâşif (taş totem) bonus oyunu verir
  const t = new THREE.Group(); t.add(cyl(.8, 1, 1.8, '#5d6470', 0, .9, 0, 6), ball(.75, '#737b88', 0, 2.3, 0, 0), ball(.14, '#a4ff5c', -.26, 2.42, .6, 0, glow('#a4ff5c', 2)), ball(.14, '#a4ff5c', .26, 2.42, .6, 0, glow('#a4ff5c', 2))); s.add(t);
  const bl = billboard('Bekçi Totem', '#d9c8ff', 3); bl.position.y = 3.6; s.add(bl);
  lv.colliders.push({ x: 0, z: 0, r: 1.1 });
  lv.interact.push({ id: 'totem', pos: new THREE.Vector3(0, 0, 0), r: 3.2, label: () => 'Bekçi Totem’in sınavına gir', icon: 'cave', act: () => hooks.openGame('magara') });
  lv.interact.push({ id: 'cavefact', pos: new THREE.Vector3(-5, 0, 3), r: 2.2, label: () => 'Parlayan kristali incele', icon: 'lens', act: () => hooks.dialog('Mağara Notu', 'Burada ışık yok, bu yüzden fotosentez de yok. Doğadaki mağara ekosistemleri çoğunlukla dışarıdan gelen organik maddelere bağlıdır.', 'cave') });
  exitDoor(lv, hooks, 0, 6.2, 'Mağaradan çık');
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.5), new THREE.MeshBasicMaterial({ color: '#dff6ff' })); gate.position.set(0, 1.75, 7.8); gate.rotation.y = Math.PI; s.add(gate);
  lv.tick = tm => cry.forEach((c, i) => { c.l.intensity = 12 + Math.sin(tm * 1.5 + i * 2) * 5; });
  lv.onEnter = () => { sfx('secret'); unlock('magara'); };
  return lv;
}

export function buildLeaf(hooks) {
  const lv = room(22, 14, '#113d24', '#3a8d43', '#2f7a3a', 7); const s = lv.scene;
  s.fog = new THREE.FogExp2('#14512d', .022);
  s.add(new THREE.HemisphereLight('#d8ff9e', '#1e5a2e', 1.8));
  const d = new THREE.DirectionalLight('#fff5c9', 1.8); d.position.set(3, 9, 4); s.add(d);
  const decor = new THREE.Group();
  // Palizat hücreleri: arka sırada dik silindirler
  for (let i = 0; i < 9; i++) {
    const x = -9.6 + i * 2.4;
    decor.add(cyl(1, 1, 6.4, '#a5e063', x, 3.2, -5.4, 8));
    for (let k = 0; k < 6; k++) { const c = ball(.28, '#2f9c3f', x + Math.sin(k * 2.4 + i) * .78, .8 + k, -4.55 + Math.cos(k * 2.4 + i) * .05, 0); c.scale.set(1, .6, .6); decor.add(c); }
    lv.colliders.push({ x, z: -5.4, r: 1 });
  }
  // Süngerimsi hücreler: ön tarafta dağınık yuvarlaklar
  [[-8, 3], [-3.2, 4], [7.6, 3.6], [3.6, 3], [-7, -1], [8, -1]].forEach(([x, z]) => { decor.add(ball(1.15, '#8fd257', x, 1.05, z, 1)); lv.colliders.push({ x, z, r: 1.15 }); });
  // Stoma: tabanda iki bekçi hücre
  decor.add(ball(1, '#5cb84a', -1.3, .3, 6, 1), ball(1, '#5cb84a', 1.3, .3, 6, 1));
  s.add(bake(decor));
  const ks = Array.from({ length: 10 }, (_, i) => { const m = ball(.32, '#2f9c3f', 0, 0, 0, 1, glow('#2f9c3f', .3)); m.scale.set(1.4, .75, .8); s.add(m); return { m, a: i * .63, r: 2 + (i % 3) * 1.2 }; });
  lv.tick = t => ks.forEach((k, i) => k.m.position.set(Math.cos(t * .35 + k.a) * k.r * 2, 1.1 + (i % 3) * .9 + Math.sin(t + i) * .2, Math.sin(t * .35 + k.a) * k.r * .9));
  const info = (id, x, z, label, title, text) => {
    const c = live(new THREE.Mesh(new THREE.OctahedronGeometry(.34), new THREE.MeshStandardMaterial({ color: '#ffd24c', emissive: '#ffb300', emissiveIntensity: 1 }))); c.position.set(x, 1.9, z); s.add(c);
    const l = billboard(title, '#fff', 3.4); l.position.set(x, 2.8, z); s.add(l);
    lv.interact.push({ id, pos: new THREE.Vector3(x, 0, z), r: 2.2, label: () => label, icon: 'lens', act: () => { sfx('good'); hooks.dialog(title, text, 'plant'); } });
  };
  info('pal', -4.8, -3.1, 'Palizat hücresini incele', 'Palizat Dokusu', 'Yaprağın üst kısmına yakın, sık dizili uzun hücreler. Bol kloroplast içerir; ışığın büyük kısmı burada yakalanır.');
  info('sun', 4.8, 1.5, 'Süngerimsi dokuyu incele', 'Süngerimsi Doku', 'Hücreler arası boşlukları bol olduğu için gazlar yaprak içinde kolayca yayılır. CO₂ buradan hücrelere ulaşır.');
  info('sto', 0, 3.9, 'Stomayı incele', 'Stoma', 'İki bekçi hücre arasındaki açıklık. Bekçi hücreler su alıp şişince stoma açılır; su kaybedince kapanır.');
  // Kart: yaprağın sol köşesinde
  const card = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.1, .06), new THREE.MeshStandardMaterial({ color: '#ffe48a', emissive: '#ffb300', emissiveIntensity: .9 })); card.position.set(10, 1.2, 5.5); s.add(card);
  card.visible = !save.cards.includes('h-yaprak');
  lv.interact.push({ id: 'cardleaf', pos: card.position, r: 2, label: () => card.visible ? 'Kartı al' : 'Boş köşe', icon: 'card', act: () => { if (card.visible) { giveCard('h-yaprak'); sfx('collect'); card.visible = false; } } });
  exitDoor(lv, hooks, 0, 6, 'Stomadan dışarı süzül');
  lv.entry = [0, 4.5];
  lv.onEnter = () => { sfx('secret'); unlock('yaprak'); };
  return lv;
}
