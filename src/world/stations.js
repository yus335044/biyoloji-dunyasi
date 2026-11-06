import * as THREE from 'three';
import { box, cyl, ball, cone, ring, M, glow, live, sign, bake } from './kit.js';

const glass = () => new THREE.MeshStandardMaterial({ color: '#bff5ee', transparent: true, opacity: .32, roughness: .1, metalness: .1, flatShading: true });
const G = { leaf: '#57b94a', dark: '#2f7f47', wood: '#9a6b3f', woodD: '#6f4a2b', stone: '#c9c6b4', white: '#f5f4ea', metal: '#8aa1a8' };
function leafMesh(l, w, c = G.leaf) {
  const m = ball(1, c); m.scale.set(w, .12, l); return m;
}
function molecule(cols, gap) {
  const g = new THREE.Group();
  cols.forEach((c, i) => g.add(ball(i === 0 ? .9 : .65, c, i === 0 ? 0 : (i % 2 ? gap : -gap), 0, 0, 1, { roughness: .35 })));
  return g;
}
// Her kurucu: (g) => güncelleme(t) döndürür. +z yönü adanın merkezine bakar.
export const BUILDERS = {
  lab(g) {
    g.add(cyl(5.2, 5.6, 2.2, G.white, 0, 1.1, -1, 12), cyl(5.6, 5.8, .4, '#38d6c0', 0, 2.3, -1, 12));
    const d = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 8, 0, 6.3, 0, 1.57), glass()); d.position.set(0, 2.4, -1); g.add(d);
    g.add(box(2, 2, .3, '#2a6a64', 0, 1, 4.5));
    const f = cyl(.25, .95, 1.8, '#7ff5d9', 0, 3.6, -1, 8, glow('#38d6c0', .7)); g.add(f);
    g.add(cone(.2, .8, '#ffc93c', 0, 8.2, -1), cyl(.05, .05, 1, G.metal, 0, 7.5, -1));
    g.add(box(2.6, .15, 1, G.wood, -3.8, 1, 4.5), box(2.6, .15, 1, G.wood, 3.8, 1, 4.5), cyl(.2, .4, .7, '#ff8a8a', -4.2, 1.45, 4.5), cyl(.2, .4, .7, '#9aa8ff', 3.6, 1.45, 4.5));
    return t => { f.material.emissiveIntensity = .5 + .4 * Math.sin(t * 2); };
  },
  kloroplast(g) {
    const body = live(new THREE.Group()); body.position.y = 7;
    const b = ball(5, '#62c64a', 0, 0, 0, 2, { roughness: .5 }); b.scale.set(1.5, .85, .9); body.add(b);
    for (let i = -2; i <= 2; i++) for (let k = 0; k < 4; k++) body.add(cyl(.9, .9, .22, k % 2 ? '#2e8f3c' : '#b8f05c', i * 2.3, 4.4 + k * .3 - Math.abs(i) * .55, 0, 10));
    g.add(body, cyl(.5, 1, 3.4, G.dark, 0, 1.2, 0), leafMesh(4.5, 2, G.leaf));
    return t => { body.rotation.y = t * .18; body.position.y = 7 + Math.sin(t * .8) * .35; };
  },
  isik(g) {
    g.add(cyl(.35, .55, 5, G.woodD, 0, 2.5, 0));
    const dish = live(new THREE.Group()); dish.position.y = 5.4;
    const a = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#ffe48a', side: 2, metalness: .5, roughness: .3, emissive: '#ffb300', emissiveIntensity: .35 })); a.rotation.x = Math.PI; dish.add(a); g.add(dish);
    const cs = [['#ff5a4d', -3.4], ['#4d7cff', 3.4], ['#55d964', 0]];
    const cr = cs.map(([c, x]) => { const m = live(cone(.6, 1.8, c, x, 1.4, 3.3, 5, { ...glow(c, .7), roughness: .2 })); g.add(m); return m; });
    return t => { dish.rotation.y = t * .5; dish.rotation.z = Math.sin(t * .6) * .15; cr.forEach((m, i) => { m.rotation.y = t + i; m.position.y = 1.4 + Math.sin(t * 1.6 + i) * .25; }); };
  },
  karbon(g) {
    const l = leafMesh(6.2, 3.8, '#4eae48'); l.position.y = 1; l.rotation.x = .1; g.add(l);
    for (let i = 0; i < 5; i++) { const s = ring(.42, .12, '#d4f08c', (i - 2) * 1.4, 1.3 + (i % 2) * .08, (i % 2) ? -1.4 : 1.4); s.rotation.x = Math.PI / 2; g.add(s); }
    const ms = [0, 1, 2].map(i => { const m = live(molecule(['#3d4a55', '#e45b52', '#e45b52'], 1.15)); m.scale.setScalar(.8); g.add(m); return m; });
    return t => ms.forEach((m, i) => { const a = t * .4 + i * 2.1; m.position.set(Math.cos(a) * 4.2, 3.6 + Math.sin(t + i) * .7, Math.sin(a) * 4.2); m.rotation.y = t + i; });
  },
  su(g) {
    const blue = '#42b4ff';
    g.add(cyl(3, 3.4, .6, G.woodD, 0, .3, 0));
    for (let i = 0; i < 7; i++) { const a = i * .9, r = cyl(.1, .22, 2.4, G.woodD, Math.cos(a) * 2.2, .5, Math.sin(a) * 2.2); r.rotation.z = Math.cos(a) * .9; r.rotation.x = -Math.sin(a) * .9; g.add(r); }
    g.add(cyl(.55, .55, 9, blue, 0, 5, 0, 8, { roughness: .3 }), cyl(.45, .45, 3.4, blue, 1.8, 7.4, 0, 8, { roughness: .3 }));
    const c = cyl(.45, .45, 2.2, blue, .9, 6, 0, 8); c.rotation.z = Math.PI / 2; g.add(c);
    const t2 = leafMesh(3.2, 1.8); t2.position.set(0, 9.7, 0); t2.rotation.x = .25; g.add(t2);
    const t3 = leafMesh(2.6, 1.5); t3.position.set(1.8, 9.2, 0); t3.rotation.z = -.3; g.add(t3);
    const drops = [0, 1, 2, 3, 4].map(i => { const d = live(ball(.32, '#bfe9ff', .0, 0, 0, 1, glow('#6fd2ff', .9))); g.add(d); return [d, i / 5]; });
    return t => drops.forEach(([d, o]) => { const q = (t * .25 + o) % 1; d.position.set(.72, 1 + q * 8.6, .3); d.scale.setScalar(.6 + Math.sin(q * 3.14) * .5); });
  },
  oksijen(g) {
    g.add(box(8, 4.4, 6, '#d7e8e5', 0, 2.2, -.5), box(8.4, .5, 6.4, '#5ec9d6', 0, 4.6, -.5), box(2.2, 2.6, .3, '#2d6a78', 0, 1.3, 2.6));
    g.add(cyl(.7, 1, 4, '#b7c5c4', -2.4, 6.5, -1.5), cyl(.7, 1, 5.2, '#b7c5c4', 2.2, 7.1, -1.5));
    const b = Array.from({ length: 8 }, (_, i) => { const m = live(ball(.42, '#d6f8ff', 0, 0, 0, 1, { transparent: true, opacity: .75, roughness: .1 })); g.add(m); return [m, i / 8, i % 2]; });
    const w = live(ring(1, .22, '#42b4ff', -5.2, 2, 2)); g.add(w);
    return t => { w.rotation.z = t; b.forEach(([m, o, s]) => { const q = (t * .18 + o) % 1; m.position.set((s ? 2.2 : -2.4) + Math.sin(q * 12) * .5, (s ? 9.5 : 8.4) + q * 9, -1.5); m.scale.setScalar(.5 + q * 1.5); m.material.opacity = .85 * (1 - q); }); };
  },
  calvin(g) {
    g.add(box(1, 6, 1, G.metal, -5, 3, 0), box(1, 6, 1, G.metal, 5, 3, 0), box(11, .6, 2.4, G.stone, 0, .3, 0));
    const wheel = live(new THREE.Group()); wheel.position.set(0, 6.6, 0);
    wheel.add(ring(4.2, .32, '#ff9f6b'), ring(1, .3, '#ffcf6b'));
    [['#6fe0ff', 0], ['#ffd76b', 2.09], ['#a4ff5c', 4.19]].forEach(([c, a]) => {
      const s = box(.3, 3.2, .3, G.woodD, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0); s.rotation.z = a - Math.PI / 2; wheel.add(s);
      wheel.add(ball(1, c, Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0, 1, glow(c, .55)));
    });
    g.add(wheel);
    return t => { wheel.rotation.z = t * .4; };
  },
  dedektif(g) {
    g.add(box(6.6, 3.4, 5, '#8b6a4a', 0, 1.7, -.6), box(1.5, 2.3, .3, '#54351e', 0, 1.15, 2));
    const r = cone(5, 2.4, '#5b3f6e', 0, 4.6, -.6, 4); r.rotation.y = Math.PI / 4; g.add(r);
    g.add(box(1.4, 1, .2, '#ffe9a8', 2, 2, 2));
    const lens = live(new THREE.Group()); lens.position.set(-3.6, 4, 2.6);
    lens.add(ring(1.2, .18, '#e0a8ff', 0, 0, 0, { metalness: .4 }));
    const gl = new THREE.Mesh(new THREE.CircleGeometry(1.15, 14), glass()); lens.add(gl);
    const hd = cyl(.13, .13, 1.6, G.woodD, 0, -1.9); lens.add(hd); g.add(lens);
    return t => { lens.rotation.z = Math.sin(t) * .3 - .4; lens.position.y = 4 + Math.sin(t * 1.3) * .2; };
  },
  kurtar(g) {
    g.add(box(7, .4, 7, G.stone, 0, .2, 0));
    for (const [x, z] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) g.add(box(.2, 4, .2, G.white, x, 2.2, z));
    g.add(box(7, .2, .2, G.white, 0, 4.2, 3.3), box(7, .2, .2, G.white, 0, 4.2, -3.3), box(.2, .2, 7, G.white, 3.3, 4.2, 0), box(.2, .2, 7, G.white, -3.3, 4.2, 0));
    const gl = new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.8, 6.6), glass()); gl.position.y = 2.3; g.add(gl);
    const rf = cone(5, 1.6, '#c9f5ec', 0, 5, 0, 4, { transparent: true, opacity: .4 }); rf.rotation.y = Math.PI / 4; g.add(rf);
    g.add(cyl(.8, .55, 1, '#c76b42', 0, .9, 0), cyl(.1, .14, 1.6, G.dark, 0, 2, 0));
    const lv = live(new THREE.Group()); lv.position.y = 2.6;
    for (let i = 0; i < 5; i++) { const l = leafMesh(.9, .4, '#b6c95a'); const a = i * 1.26; l.position.set(Math.cos(a) * .7, -.1, Math.sin(a) * .7); l.rotation.y = -a + 1.57; l.rotation.x = .5; lv.add(l); }
    g.add(lv);
    return t => { lv.rotation.y = t * .25; lv.rotation.x = Math.sin(t) * .05; };
  },
  molekul(g) {
    g.add(cyl(2.4, 3, .8, G.stone, 0, .4, 0, 8), cyl(.3, .5, 2.6, G.metal, 0, 2, 0));
    const m = live(new THREE.Group()); m.position.y = 6;
    const atoms = [[0, 0, 0, 1.3, '#ff7fb4'], [2.6, 1, 0, .9, '#6fd2ff'], [-2.4, 1.2, .6, .9, '#ffd76b'], [.4, -2.5, 1, .9, '#a4ff5c'], [-.6, 1.2, -2.5, .8, '#c58bff']];
    atoms.forEach(([x, y, z, r, c], i) => {
      m.add(ball(r, c, x, y, z, 1, { roughness: .3 }));
      if (i) { const l = Math.hypot(x, y, z), s = cyl(.14, .14, l, G.white, x / 2, y / 2, z / 2); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize()); m.add(s); }
    });
    g.add(m);
    return t => { m.rotation.y = t * .5; m.rotation.x = Math.sin(t * .4) * .3; };
  },
  parkur(g) {
    [[-3, 0, 2, 1, '#8fe35b'], [0, 3, 3.4, 1, '#ffb02e'], [3, -1, 5, 1, '#8fe35b'], [0, -3.4, 6.8, 1.1, '#ffb02e']].forEach(([x, z, y, r, c]) => { g.add(cyl(1.5 * r, .9 * r, .5, c, x, y, z, 8), cyl(.14, .18, y, G.dark, x, y / 2, z)); });
    const s = live(ball(1.6, '#ffd24c', 0, 10.2, -3.4, 2, glow('#ffb300', 1.1))); g.add(s);
    const h = live(ring(2.3, .1, '#ffe48a', 0, 10.2, -3.4, glow('#ffb300', 1))); g.add(h);
    return t => { h.rotation.y = t; h.rotation.x = t * .7; s.position.y = 10.2 + Math.sin(t * 1.2) * .3; };
  },
  puzzle(g) {
    const c = ['#b6ef4f', '#42b4ff', '#ffc93c', '#ff7fb4', '#38d6c0'];
    [[-2.2, 1, 0, 2.2], [0, 1, .3, 2.2], [2.2, 1, -.1, 2.2], [-1, 3.2, .1, 2.2], [1.2, 3.2, 0, 2.2]].forEach(([x, y, z, s], i) => {
      g.add(box(s, s, s, c[i], x, y, z)); g.add(ball(.42, c[i], x + s / 2, y, z, 0));
    });
    const f = live(box(2.2, 2.2, 2.2, '#fff27a', 0, 7, 0, glow('#ffd93c', .35))); g.add(f);
    return t => { f.rotation.y = t * .8; f.rotation.x = t * .5; f.position.y = 6.6 + Math.sin(t * 1.4) * .5; };
  },
  faktor(g) {
    const r = ring(6.4, .5, G.stone, 0, .4, 0); r.rotation.x = Math.PI / 2; g.add(r);
    const bars = [1.5, 3, 4.4, 5.2, 5.4, 5.4].map((hh, i) => { const b = live(box(1, 1, 1, i < 3 ? '#ff8a8a' : '#ffc93c', -3.4 + i * 1.35, 0, -2.8)); g.add(b); return [b, hh]; });
    g.add(cyl(.15, .15, 7, G.metal, -5.8, 3.5, -3), cyl(.15, .15, 7, G.metal, 5.8, 3.5, -3));
    const banner = sign(['Işık · CO₂ · Sıcaklık'], 11, 1.5, { bg: '#7e2f40', size: 58 }); banner.position.set(0, 7, -3); g.add(banner);
    return t => bars.forEach(([b, hh], i) => { const v = hh * (.85 + .15 * Math.sin(t * 1.2 + i * .5)); b.scale.y = v; b.position.y = v / 2 + .1; });
  },
  kasif(g) {
    g.add(cyl(1.3, 2.1, 7, G.woodD, 0, 3.5, 0), cyl(4, 4, .4, G.wood, 0, 6.2, 0, 10));
    for (let i = 0; i < 8; i++) { const a = i * .785; g.add(cyl(.08, .08, 1, G.wood, Math.cos(a) * 3.8, 6.8, Math.sin(a) * 3.8, 5)); }
    g.add(ball(4, G.dark, 0, 10.2, 0), ball(2.7, G.leaf, 2.4, 9, 1), ball(2.5, G.leaf, -2.2, 9.3, -.8));
    for (let i = 0; i < 6; i++) g.add(box(1, .12, .3, G.wood, 1.9, .8 + i, 2 - i * .05));
    const scope = cyl(.18, .3, 1.8, '#ffd76b', 2, 7.4, 2, 7, { metalness: .4, roughness: .3 }); scope.rotation.x = 1; g.add(scope);
    const lamp = live(ball(.4, '#ffd76b', -3, 7.2, 2.2, 0, glow('#ffc93c', 1.3))); g.add(lamp);
    return t => { lamp.material.emissiveIntensity = 1 + .5 * Math.sin(t * 3); };
  },
  final(g) {
    g.add(cyl(7, 8, 1, '#a9aea0', 0, .5, 0, 6), cyl(5, 6, 1, '#8c937f', 0, 1.5, 0, 6));
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + .52; g.add(box(.9, 9, .9, '#6e7a6d', Math.cos(a) * 4.3, 6, Math.sin(a) * 4.3)); }
    const coreMat = new THREE.MeshStandardMaterial({ color: '#5d6c6c', emissive: '#223333', emissiveIntensity: .6, flatShading: true, roughness: .3 });
    const core = live(new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 1), coreMat)); core.position.y = 7; g.add(core);
    const rings = [0, 1, 2].map(i => { const r = live(ring(3 + i * .55, .1, '#7e8a80', 0, 7, 0, { metalness: .5, roughness: .4 })); g.add(r); return r; });
    const beam = live(new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.5, 70, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#c9ff8a', transparent: true, opacity: .32, side: 2, depthWrite: false, toneMapped: false })));
    beam.position.y = 43; beam.visible = false; g.add(beam);
    g.userData.setActive = on => {
      coreMat.color.set(on ? '#c9ff5c' : '#5d6c6c'); coreMat.emissive.set(on ? '#7bff3c' : '#223333'); coreMat.emissiveIntensity = on ? 1.5 : .6;
      rings.forEach(r => { r.material = M(on ? '#ffe48a' : '#7e8a80', on ? glow('#ffb300', 1) : { metalness: .5, roughness: .4 }); });
      beam.visible = on; g.userData.on = on;
    };
    return t => {
      const k = g.userData.on ? 1 : .15; core.rotation.y = t * .5 * k; core.position.y = 7 + Math.sin(t) * .25 * k;
      rings.forEach((r, i) => { r.rotation.x = t * (.5 + i * .2) * k + i; r.rotation.y = t * (.3 + i * .17) * k; });
    };
  },
};
export { bake };
