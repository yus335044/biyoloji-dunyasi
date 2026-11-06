import * as THREE from 'three';
import { GAMES, GAME, HIDDEN_CARDS, MAIN_GAMES } from '../core/data.js';
import { save, isUnlocked, giveCard, unlock, persist, notify } from '../core/store.js';
import { sfx } from '../core/audio.js';
import { box, cyl, ball, cone, M, glow, live, bake, billboard, seeded, tint, mergeGeos, vcMat, windMat, uTime, sign, ring } from './kit.js';
import { BUILDERS } from './stations.js';
import { buildGrid, buildTerrain, buildWater, height, PONDS, pathDist, BASE, fbm, SECRET } from './terrain.js';

export { SECRET };

export function buildWorld(Q, hooks) {
  buildGrid(Q.seg);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe9e6');
  scene.fog = new THREE.FogExp2('#bfe9e6', Q.low ? .0065 : .0045);
  const colliders = [], interact = [], updaters = [];
  const addC = (x, z, r) => colliders.push({ x, z, r });
  const surfaces = []; const pillars = [];

  // Işık
  scene.add(new THREE.HemisphereLight('#dff6ff', '#6d9a55', 1.55));
  const sun = new THREE.DirectionalLight('#fff0cf', 2.9); sun.position.set(40, 70, 30);
  sun.castShadow = Q.shadow;
  if (Q.shadow) {
    sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize); sun.shadow.bias = -.0006; sun.shadow.normalBias = .05;
    const c = sun.shadow.camera; c.left = c.bottom = -38; c.right = c.top = 38; c.near = 5; c.far = 170;
  }
  scene.add(sun, sun.target);

  // Gökyüzü
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 v; void main(){ v=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 v; void main(){ float h=clamp(v.y,0.,1.); vec3 c=mix(vec3(.52,.81,.79),vec3(.2,.5,.86),pow(h,.55));
      vec3 s=normalize(vec3(.45,.75,.34)); float d=max(dot(normalize(v),s),0.); c+=vec3(1.,.8,.5)*pow(d,28.)*.35+vec3(1.,.95,.8)*smoothstep(.9975,.9985,d);
      gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}` }));
  sky.renderOrder = -1; scene.add(sky);

  // Arazi ve su
  scene.add(buildTerrain());
  const water = buildWater(Q.waterSeg); scene.add(water);

  const rand = seeded(4242);
  const inPond = (x, z, m = 1.25) => PONDS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * m);
  const nearStation = (x, z, m) => GAMES.some(g => g.r && Math.hypot(x - g.pos[0], z - g.pos[1]) < g.r + m);
  const nearSecret = (x, z, m) => Object.values(SECRET).some(s => Math.hypot(x - s[0], z - s[1]) < m);
  const free = (x, z, pm = 2.6, sm = 4) => height(x, z) > .55 && !inPond(x, z) && pathDist(x, z) > pm && !nearStation(x, z, sm) && Math.hypot(x, z) > 19 && !nearSecret(x, z, 6);

  // --- Ağaçlar (instanced) ---
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < Q.trees && guard++ < 6000) {
    const a = rand() * 6.283, d = 20 + rand() * 94, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!free(x, z)) continue;
    const forest = x < -18 || z < -46;                        // batı ormanı ve kuzey
    if (!forest && rand() > .24) continue;
    if (treeSpots.some(t => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
    treeSpots.push({ x, z, s: .8 + rand() * .75, kind: rand() < .42 ? 1 : rand() < .25 ? 2 : 0, rot: rand() * 6.28 });
  }
  // Yusuf'un yaşlı ağacını önden saklayan sık ağaç halkası
  const [yx, yz] = SECRET.yusuf;
  for (let i = 0; i < 9; i++) { const a = -1.15 + i * .29, x = yx + Math.cos(a) * 8.5, z = yz + Math.sin(a) * 8.5; if (height(x, z) > .5) treeSpots.push({ x, z, s: 1.1 + rand() * .3, kind: i % 2, rot: rand() * 6 }); }
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.28, .48, 3, 6).translate(0, 1.5, 0), M('#8a5e38'), treeSpots.length);
  const leafG = {
    0: mergeGeos([new THREE.IcosahedronGeometry(2.1, 1).translate(0, 4.3, 0), new THREE.IcosahedronGeometry(1.4, 1).translate(1.2, 3.5, .4), new THREE.IcosahedronGeometry(1.3, 0).translate(-1.1, 3.6, -.4)]),
    1: mergeGeos([new THREE.ConeGeometry(2, 3, 7).translate(0, 3.5, 0), new THREE.ConeGeometry(1.6, 2.6, 7).translate(0, 5, 0), new THREE.ConeGeometry(1.1, 2.1, 7).translate(0, 6.4, 0)]),
    2: mergeGeos([new THREE.IcosahedronGeometry(2, 1).translate(0, 4.1, 0), new THREE.IcosahedronGeometry(1.1, 0).translate(1, 5.2, .5)]),
  };
  const lm = windMat(new THREE.MeshStandardMaterial({ flatShading: true, roughness: .9, vertexColors: true }), .035);
  const pal = { 0: ['#5fbf4a', '#4cae4e', '#7cd052', '#3f9f50'], 1: ['#2e8f58', '#37a067', '#277d55'], 2: ['#ff9ec4', '#ffb34d', '#f7d84e', '#ff8a7a'] };
  [0, 1, 2].forEach(k => {
    const list = treeSpots.filter(t => t.kind === k); if (!list.length) return;
    const im = new THREE.InstancedMesh(leafG[k], lm, list.length); im.castShadow = true; im.receiveShadow = true;
    list.forEach((t, i) => {
      dummy.position.set(t.x, height(t.x, t.z) - .1, t.z); dummy.rotation.y = t.rot; dummy.scale.setScalar(t.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, col.set(pal[k][Math.floor(rand() * pal[k].length)]));
    });
    scene.add(im);
  });
  trunkI.castShadow = true;
  treeSpots.forEach((t, i) => {
    dummy.position.set(t.x, height(t.x, t.z) - .1, t.z); dummy.rotation.y = t.rot; dummy.scale.set(t.s, t.kind === 1 ? t.s * 1 : t.s, t.s); dummy.updateMatrix(); trunkI.setMatrixAt(i, dummy.matrix);
    addC(t.x, t.z, .55 * t.s);
  });
  scene.add(trunkI);

  // --- Çim, çiçek, taş, çalı (instanced/tek geometride) ---
  const scatter = (geo, mat, count, test, fn) => {
    const im = new THREE.InstancedMesh(geo, mat, count); let n = 0, g = 0;
    while (n < count && g++ < count * 12) {
      const a = rand() * 6.283, d = 12 + rand() * 102, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!test(x, z)) continue;
      dummy.position.set(x, height(x, z), z); dummy.rotation.set(0, rand() * 6.28, 0); dummy.scale.setScalar(1); fn && fn(x, z, n, im); dummy.updateMatrix(); im.setMatrixAt(n++, dummy.matrix);
    }
    im.count = n; scene.add(im); return im;
  };
  const grassM = windMat(new THREE.MeshStandardMaterial({ flatShading: true, color: '#fff', vertexColors: false, roughness: 1 }), .22);
  scatter(new THREE.ConeGeometry(.16, .75, 3).translate(0, .37, 0), grassM, Q.grass, (x, z) => height(x, z) > .75 && !inPond(x, z, 1.1) && pathDist(x, z) > 1.9 && Math.hypot(x, z) > 17 && !nearStation(x, z, 7),
    (x, z, i, im) => { dummy.scale.setScalar(.7 + rand() * .9); im.setColorAt(i, col.setHSL(.27 + rand() * .06, .55, .42 + rand() * .14)); });
  const flowerG = mergeGeos([tint(new THREE.CylinderGeometry(.03, .04, .6, 4).translate(0, .3, 0), '#3f9f50'), ...[0, 1, 2, 3, 4].map(i => tint(new THREE.IcosahedronGeometry(.13, 0).translate(Math.cos(i * 1.26) * .16, .62, Math.sin(i * 1.26) * .16), '#ffffff')), tint(new THREE.IcosahedronGeometry(.1, 0).translate(0, .64, 0), '#ffd24c')]);
  const fm = windMat(new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: .8 }), .13);
  const fCols = ['#ff7fb4', '#fff27a', '#ffffff', '#ff8a5c', '#c8a2ff', '#6fd2ff'];
  scatter(flowerG, fm, Q.flowers, (x, z) => height(x, z) > .8 && !inPond(x, z, 1.1) && pathDist(x, z) > 2.2 && Math.hypot(x, z) > 19 && !nearStation(x, z, 2.5) && fbm(x * .06, z * .06) > .42,
    (x, z, i, im) => { dummy.scale.setScalar(.8 + rand() * .55); im.setColorAt(i, col.set(fCols[Math.floor(rand() * fCols.length)])); });
  const rockC = [];
  scatter(new THREE.DodecahedronGeometry(.8, 0), M('#a4aa9b'), Q.low ? 40 : 80, (x, z) => free(x, z, 2.5, 2) || (height(x, z) < .6 && height(x, z) > .05), (x, z) => {
    const s = .4 + rand() * 1.6; dummy.scale.set(s, s * (.5 + rand() * .4), s * (.7 + rand() * .5)); dummy.position.y += s * .15; if (s > 1.1) rockC.push([x, z, s * .75]);
  });
  rockC.forEach(([x, z, r]) => addC(x, z, r));
  scatter(new THREE.IcosahedronGeometry(1, 0).translate(0, .6, 0), new THREE.MeshStandardMaterial({ flatShading: true, color: '#fff', roughness: .9 }), Q.low ? 40 : 90, (x, z) => free(x, z, 2.5, 2),
    (x, z, i, im) => { dummy.scale.set(.7 + rand(), .6 + rand() * .6, .7 + rand()); im.setColorAt(i, col.setHSL(.28 + rand() * .07, .5, .34 + rand() * .1)); });

  // Nilüferler
  const lilies = [];
  PONDS.forEach(p => { for (let i = 0; i < p.r * .9; i++) { const a = rand() * 6.28, d = p.r * (.25 + rand() * .55); lilies.push(tint(new THREE.CylinderGeometry(.5 + rand() * .4, .5, .05, 7).translate(p.x + Math.cos(a) * d, .08, p.z + Math.sin(a) * d), rand() < .2 ? '#ff9ec4' : '#57b94a')); } });
  scene.add(new THREE.Mesh(mergeGeos(lilies), vcMat));

  // Dev bitkiler (kuzey)
  const giants = new THREE.Group();
  const giantLeaf = (px, pz, hgt, c, lean) => {
    const y0 = height(px, pz); const g = new THREE.Group(); g.position.set(px, y0, pz); g.rotation.y = lean;
    const stem = cyl(.28, .5, hgt, '#3d9a4c', 0, hgt / 2, 0); g.add(stem);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + lean, l = ball(1, c); l.scale.set(1.5, .16, 3.6); l.position.set(Math.cos(a) * 2.8, hgt - i * 1.3, Math.sin(a) * 2.8); l.rotation.y = -a + 1.57; l.rotation.x = .25; g.add(l); }
    const bud = ball(1, i2(c), 0, hgt + .5, 0); g.add(bud); giants.add(g); addC(px, pz, .7);
  };
  const i2 = c => c === '#6fd14c' ? '#ffd24c' : '#ff7fb4';
  [[-24, -56, 12, 0], [8, -80, 15, 1], [-56, -74, 14, 2], [38, -78, 13, 3], [-2, -56, 9, 4], [20, -46, 10, 5], [66, -76, 12, 1], [-30, -82, 11, 2]].forEach(([x, z, hh, s]) => giantLeaf(x, z, hh, s % 2 ? '#6fd14c' : '#3fbf6f', s));
  // Merkez meydan: banklar + güneş takip eden ayçiçekleri
  const flowers = [];
  [[-13, -6], [13, -6], [-14, 7], [14, 7]].forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, BASE, z); addC(x, z, .7);
    g.add(cyl(.2, .3, 4.5, '#3d9a4c', 0, 2.25, 0));
    const lf = ball(1, '#57b94a', .9, 2, 0); lf.scale.set(1.1, .1, .5); g.add(lf);
    const head = live(new THREE.Group()); head.position.y = 4.8;
    head.add(cyl(.95, .95, .25, '#6f4a2b', 0, 0, 0, 10)); for (let k = 0; k < 10; k++) { const p = cone(.42, 1.1, '#ffd24c', Math.cos(k * .628) * 1.35, 0, Math.sin(k * .628) * 1.35, 4); p.rotation.z = -Math.cos(k * .628) * 1.57; p.rotation.x = Math.sin(k * .628) * 1.57; head.add(p); }
    head.rotation.x = -.5; g.add(head); giants.add(g); flowers.push(head);
  });
  const hubDec = new THREE.Group();
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + .5, b = box(2.6, .16, .7, '#9a6b3f', Math.cos(a) * 15.5, BASE + .55, Math.sin(a) * 15.5); b.rotation.y = -a + 1.57; hubDec.add(b, box(.2, .5, .6, '#6f4a2b', Math.cos(a) * 15.5, BASE + .25, Math.sin(a) * 15.5)); addC(Math.cos(a) * 15.5, Math.sin(a) * 15.5, 1); }
  // Yönlendirme tabelası
  const signPost = (x, z, lines) => { const g = new THREE.Group(); g.position.set(x, height(x, z), z); g.add(cyl(.09, .12, 2.6, '#6f4a2b', 0, 1.3, 0)); const s = sign(lines, 2.8, 1.5, { size: 46 }); s.position.y = 2.6; g.add(s); g.rotation.y = Math.atan2(-x, -z) + Math.PI; s.rotation.y = Math.PI; hubDec.add(g); };
  signPost(3, 22, ['↓ Laboratuvar']); signPost(-22, 3, ['← Orman']); signPost(22, -3, ['→ Göl']); signPost(4, -32, ['↑ Dev Bitkiler']);
  scene.add(bake(giants), bake(hubDec));

  // Bulutlar
  const cg = mergeGeos([new THREE.IcosahedronGeometry(6, 0), new THREE.IcosahedronGeometry(4.2, 0).translate(6, -.5, 1), new THREE.IcosahedronGeometry(3.6, 0).translate(-6, -.8, -1)]);
  const clouds = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: '#fff', flatShading: true, roughness: 1, emissive: '#dfe9ee', emissiveIntensity: .4 }), 16);
  const cl = Array.from({ length: 16 }, () => ({ x: rand() * 480 - 240, z: rand() * 480 - 240, y: 52 + rand() * 24, s: .8 + rand() * 1.4, v: .4 + rand() * .7 })); scene.add(clouds);

  // Kelebekler
  const wingG = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -.18, 0, 0, .18, .34, 0, 0]), 3));
  const flies = Array.from({ length: Q.butterflies }, () => {
    const c = pick2(['#ffb02e', '#ff7fb4', '#fff27a', '#7fd8ff', '#c8a2ff']), mat = new THREE.MeshBasicMaterial({ color: c, side: 2 });
    const g = new THREE.Group(), a = new THREE.Mesh(wingG, mat), b = new THREE.Mesh(wingG, mat); b.scale.x = -1; g.add(a, b); scene.add(g);
    return { g, a, b, cx: (rand() - .5) * 140, cz: (rand() - .5) * 140, ph: rand() * 6, r: 3 + rand() * 6 };
  });
  function pick2(a) { return a[Math.floor(rand() * a.length)]; }

  // Işık parçacıkları
  const pc = Q.particles, pPos = new Float32Array(pc * 3), pSeed = new Float32Array(pc);
  for (let i = 0; i < pc; i++) { pPos[i * 3] = (rand() - .5) * 60; pPos[i * 3 + 1] = rand() * 12; pPos[i * 3 + 2] = (rand() - .5) * 60; pSeed[i] = rand() * 100; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('aS', new THREE.BufferAttribute(pSeed, 1));
  const pts = new THREE.Points(pg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uC: { value: new THREE.Vector3() } },
    vertexShader: `attribute float aS; uniform float uTime; uniform vec3 uC; varying float vA;
      void main(){ vec3 p=position; p.x+=sin(uTime*.3+aS)*1.5; p.y=mod(p.y+uTime*.35+aS,12.)+.5; p.z+=cos(uTime*.26+aS)*1.5;
      p.xz=mod(p.xz-uC.xz+30.,60.)-30.+uC.xz; p.y+=uC.y-2.; vA=.45+.55*sin(uTime*1.6+aS*3.); vec4 m=modelViewMatrix*vec4(p,1.); gl_PointSize=(18.+aS*.1)/-m.z*6.; gl_Position=projectionMatrix*m; }`,
    fragmentShader: 'varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5)discard; gl_FragColor=vec4(1.,.95,.6,(1.-d*2.)*(1.-d*2.)*vA*.55); }' }));
  pts.frustumCulled = false; scene.add(pts);

  // --- İSTASYONLAR ---
  const stations = {};
  const hubFace = (x, z) => Math.atan2(-x, -z);
  MAIN_GAMES.forEach(gm => {
    const [x, z] = gm.pos, g = new THREE.Group(); g.position.set(x, BASE, z);
    const face = gm.id === 'final' ? 0 : hubFace(x, z); g.rotation.y = face;
    const upd = BUILDERS[gm.id](g); bake(g);
    const R = gm.r;
    const pad = ring(R * .55 > 3 ? 2 : 1.8, .16, gm.color, 0, .1, R + 2.2, glow(gm.color, 1)); pad.rotation.x = Math.PI / 2; pad.castShadow = false; g.add(pad);
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(.62, 0), new THREE.MeshStandardMaterial({ color: gm.color, emissive: gm.color, emissiveIntensity: .9, flatShading: true }));
    beacon.position.set(0, 2.6, R + 2.2); g.add(beacon);
    const lab = billboard(gm.title, '#fff', 8); lab.position.set(0, 4.1, R + 2.2); g.add(lab);
    scene.add(g); addC(x, z, R * .92);
    const st = { gm, g, beacon, lab, pad, upd, spot: new THREE.Vector3(x + Math.sin(face) * (R + 2.2), BASE, z + Math.cos(face) * (R + 2.2)), refresh() {
      const open = isUnlocked(gm.need), done = save.games[gm.id]?.done;
      beacon.material.color.set(open ? (done ? '#ffd24c' : gm.color) : '#6b7570'); beacon.material.emissive.set(open ? (done ? '#ffb300' : gm.color) : '#20282a');
      pad.material = M(open ? (done ? '#ffd24c' : gm.color) : '#6b7570', open ? glow(done ? '#ffb300' : gm.color, 1) : {});
      if (gm.id === 'final') g.userData.setActive?.(!!done || !!hooks.coreLit?.());
    } };
    st.refresh(); stations[gm.id] = st;
    interact.push({ id: gm.id, pos: st.spot, r: 4.2, label: () => isUnlocked(gm.need) ? `Oyna: ${gm.title}` : `Kilitli: ${gm.need} oyun bitir (${gm.title})`, icon: gm.icon, station: true, act: () => hooks.openGame(gm.id) });
  });

  // --- GİZLİ ALANLAR ---
  // Yusuf'un yaşlı ağacı: kapısı adaya ters bakar, ağaç halkasının arkasında kalır.
  {
    const y0 = height(yx, yz), g = new THREE.Group(); g.position.set(yx, y0, yz);
    g.add(cyl(2.1, 3.1, 8, '#6d4a2d', 0, 4, 0, 9), ball(5.6, '#2f7f47', 0, 10.5, 0), ball(3.6, '#3a9650', 3.4, 9, 1.4), ball(3.6, '#2b7442', -3.2, 9, -1.2));
    for (let i = 0; i < 6; i++) { const a = i * 1.05, r = cyl(.2, .55, 3.2, '#5b3c24', Math.cos(a) * 2.8, .4, Math.sin(a) * 2.8); r.rotation.z = Math.cos(a) * 1.15; r.rotation.x = -Math.sin(a) * 1.15; g.add(r); }
    bake(g);
    const door = live(box(.18, 2.2, 1.5, '#ffd76b', -2.65, 1.1, 0, glow('#ffc93c', .55))); g.add(door); // Yalnızca arkadan görünen sıcak ışık
    scene.add(g); addC(yx, yz, 2.7);
    updaters.push(t => { door.material.emissiveIntensity = .4 + .3 * Math.sin(t * 1.5); });
    const spot = new THREE.Vector3(yx - 3.9, y0, yz);
    interact.push({ id: 'yusuf', pos: spot, r: 2.4, label: () => 'Ağacın kovuğundan içeri süzül', icon: 'hand', secret: true, act: () => hooks.enterInterior('yusuf', spot) });
  }
  // Gizli mağara: tepenin yamacında kaya kemeri
  {
    const [cx, cz] = SECRET.cave, y0 = height(cx, cz), g = new THREE.Group(); g.position.set(cx, y0, cz); g.rotation.y = Math.atan2(-cx, -cz);
    [[-2.3, 1.6, 0, 2.2], [2.3, 1.6, .1, 2.2], [-1.3, 3.8, .2, 1.8], [1.3, 3.9, .1, 1.8], [0, 4.6, 0, 1.7], [-3.3, 3, -.8, 2], [3.3, 3, -.8, 2]].forEach(([x, y, z, s]) => g.add(ball(s, '#7f867b', x, y, z, 0)));
    bake(g);
    const dark = new THREE.Mesh(new THREE.CircleGeometry(1.8, 12), new THREE.MeshBasicMaterial({ color: '#0b0f12' })); dark.position.set(0, 1.5, .25); g.add(dark);
    const c1 = live(cone(.3, .7, '#c58bff', -.9, .35, .9, 5, glow('#c58bff', 1.3))); g.add(c1);
    scene.add(g); addC(cx, cz, 1.2);
    const f = g.rotation.y, spot = new THREE.Vector3(cx + Math.sin(f) * 2.4, y0, cz + Math.cos(f) * 2.4);
    interact.push({ id: 'cave', pos: spot, r: 3.2, label: () => 'Karanlık mağaraya gir', icon: 'cave', secret: true, act: () => hooks.enterInterior('cave', spot) });
  }
  // İçine girilebilen dev bitki: kapanmış tomurcuk
  {
    const [x, z] = SECRET.plant, y0 = height(x, z), g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = Math.atan2(-x, -z);
    g.add(cyl(1.6, 2.5, 7, '#3d9a4c', 0, 3.5, 0, 9));
    for (let i = 0; i < 7; i++) { const a = i * .9, l = ball(1, i % 2 ? '#7ad04f' : '#4cae4e', Math.cos(a) * 3.2, 7.4, Math.sin(a) * 3.2); l.scale.set(1.3, 2.9, .4); l.rotation.y = -a + 1.57; l.rotation.x = -.35; g.add(l); }
    bake(g);
    const open = live(new THREE.Mesh(new THREE.CircleGeometry(1.1, 10), new THREE.MeshBasicMaterial({ color: '#b6ff6a' }))); open.scale.y = 1.6; open.position.set(0, 1.7, 2.32); g.add(open);
    scene.add(g); addC(x, z, 2.3);
    const f = g.rotation.y, spot = new THREE.Vector3(x + Math.sin(f) * 3.6, y0, z + Math.cos(f) * 3.6);
    updaters.push(t => { open.material.color.setHSL(.27, .8, .34 + Math.sin(t * 2) * .08); });
    interact.push({ id: 'plant', pos: spot, r: 2.8, label: () => 'Dev bitkinin içine gir', icon: 'plant', secret: true, act: () => hooks.enterInterior('plant', spot) });
  }
  // Prof. Klorofil: kumsalda komik bilim insanı
  {
    const [x, z] = SECRET.prof, y0 = height(x, z), g = live(new THREE.Group()); g.position.set(x, y0, z);
    g.add(box(1, 1.3, .6, '#f5f4ea', 0, 1.05, 0), ball(.48, '#f6c9a0', 0, 2.1, 0), box(.32, .6, .3, '#3d4a55', -.27, .3, 0), box(.32, .6, .3, '#3d4a55', .27, .3, 0));
    for (let i = 0; i < 9; i++) { const a = i * .7, s = i * .05 + .22; g.add(ball(s, '#57d94a', Math.cos(a) * .42, 2.5 + (i % 3) * .14, Math.sin(a) * .42, 0)); }
    g.add(box(.68, .14, .05, '#22333a', 0, 2.2, .46), box(.18, 1, .18, '#f5f4ea', .66, 1.4, 0));
    const flask = cyl(.08, .22, .5, '#7ff5d9', .66, 2.1, 0, 7, glow('#38d6c0', .9)); g.add(flask);
    const label = billboard('Prof. Klorofil', '#b6ff6a', 3.6); label.position.y = 3.5; g.add(label);
    scene.add(g); addC(x, z, .9);
    const prof = { spin: 0, i: 0 };
    updaters.push((t, dt) => { if (prof.spin > 0) { prof.spin -= dt; g.rotation.y += dt * 16; g.position.y = y0 + Math.abs(Math.sin(prof.spin * 8)) * .8; } else { g.position.y = y0 + Math.abs(Math.sin(t * 2)) * .08; } });
    const jokes = [
      'Bana “yeşil kafalı” diyorlar. Yanılıyorlar: kırmızı ve maviyi soğurup yeşili yansıtıyorum!',
      'Dün gece fotosentez yapmaya çalıştım. Hiçbir şey olmadı. Işığı kapatmak bilimsel bir hataymış.',
      'Oksijen nereden gelir? CO₂ dersen deneyimi patlatırım. Sudan gelir! Robert Hill de kloroplastlarla bunu gözlemlemişti.',
      'Bitkiler neden hiç kavga etmez? Çünkü her şeyi “stoma”ya alıyorlar… Tamam, bu kötüydü.',
      'Sana bir sır: ormanın en batısındaki yaşlı ağacın arkasında tuhaf bir ışık görmüştüm. Ben o tarafa gitmem, internet çekmiyor.',
    ];
    interact.push({ id: 'prof', pos: new THREE.Vector3(x, y0, z), r: 3.3, label: () => 'Prof. Klorofil ile konuş', icon: 'flask', secret: true, act: () => {
      unlock('profesor'); prof.spin = 1.1; sfx('jump');
      hooks.dialog('Prof. Klorofil', jokes[prof.i++ % jokes.length]);
    } });
  }
  // Zıplayan kurbağa
  {
    const [x, z] = SECRET.frog, y0 = height(x, z), g = live(new THREE.Group()); g.position.set(x, y0, z);
    const b = ball(.42, '#6fd14c'); b.scale.set(1.1, .7, 1.2); b.position.y = .3; g.add(b, ball(.14, '#fff', -.2, .62, .25, 0), ball(.14, '#fff', .2, .62, .25, 0), ball(.07, '#111', -.2, .64, .36, 0), ball(.07, '#111', .2, .64, .36, 0));
    scene.add(g);
    let hop = 0, n = 0;
    updaters.push((t, dt) => { if (hop > 0) { hop = Math.max(0, hop - dt * 1.6); g.position.y = y0 + Math.sin(hop * 3.14) * 2.4; g.rotation.y += dt * 8; } });
    interact.push({ id: 'frog', pos: new THREE.Vector3(x, y0, z), r: 2.4, label: () => 'Kurbağayı dürt', icon: 'hand', secret: true, act: () => {
      hop = 1; sfx('jump'); n++; save.frog = (save.frog || 0) + 1; persist();
      if (save.frog >= 5) unlock('kurbaga');
      else if (n === 1) notify('Vırak!', 'Kurbağa seni fazla önemsemiyor. Bir daha dene.', 'drop');
    } });
  }
  // Sıçrama mantarı + kaya sütunu
  {
    const [mx, mz] = SECRET.mush, [px, pz] = SECRET.pillar, g = new THREE.Group(), y0 = height(mx, mz), py = height(px, pz);
    const m = new THREE.Group(); m.position.set(mx, y0, mz); m.add(cyl(.5, .6, 1.2, '#f5f0d8', 0, .6, 0)); const cap = ball(1.5, '#ff5a7d', 0, 1.3, 0); cap.scale.y = .55; m.add(cap, ball(.25, '#fff', .6, 1.8, .3, 0), ball(.2, '#fff', -.5, 1.8, -.4, 0));
    const pil = new THREE.Group(); pil.position.set(px, py, pz); pil.add(cyl(2.8, 3.4, 11.5 - py, '#8f9a8a', 0, (11.5 - py) / 2, 0, 7), cyl(3, 2.8, .5, '#6fc24a', 0, 11.5 - py, 0, 7));
    g.add(m, pil); scene.add(bake(g));
    pillars.push({ x: px, z: pz, r: 3, top: 11.7 });
    hooks.bounce = { x: mx, z: mz, r: 1.5, top: y0 + 1.7 };
  }
  // İskele
  {
    const g = new THREE.Group();
    for (let i = 0; i < 12; i++) g.add(box(2, .14, 1.5, i % 2 ? '#a9794a' : '#9a6b3f', 40 + i * 1.75, .95, -8));
    for (let i = 0; i < 6; i++) { g.add(cyl(.12, .12, 2, '#6f4a2b', 41 + i * 3.6, .2, -7.1), cyl(.12, .12, 2, '#6f4a2b', 41 + i * 3.6, .2, -8.9)); }
    scene.add(bake(g)); surfaces.push({ x0: 38, x1: 60.4, z0: -9, z1: -7, y: 1.03 });
  }

  // Dünyadaki kart toplama noktaları
  const pickups = [];
  HIDDEN_CARDS.filter(c => c.pos[0] !== 0 || c.pos[1] !== 0).forEach(c => {
    if (save.cards.includes(c.id)) return;
    const [x, z, yy] = c.pos, y = (yy || height(x, z)) + 1.3;
    const m = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.1, .06), new THREE.MeshStandardMaterial({ color: '#ffe48a', emissive: '#ffb300', emissiveIntensity: .9 }));
    m.position.set(x, y, z); scene.add(m); pickups.push({ m, id: c.id, x, y, z });
  });

  // Oyuncunun görev kristali (Bilgi Kaşifi) için dış erişim
  const level = {
    scene, colliders, interact, name: 'world',
    groundAt(x, z, y) {
      let g = height(x, z);
      for (const s of surfaces) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && y >= s.y - .4) g = Math.max(g, s.y);
      for (const p of pillars) if (Math.hypot(x - p.x, z - p.z) < p.r && y >= p.top - .5) g = Math.max(g, p.top);
      return g;
    },
    solve(p, r, prev) {
      for (const c of colliders) {
        const dx = p.x - c.x, dz = p.z - c.z, q = c.r + r, d2 = dx * dx + dz * dz;
        if (d2 < q * q && d2 > 1e-5) { const d = Math.sqrt(d2), k = (q - d) / d; p.x += dx * k; p.z += dz * k; }
      }
      for (const c of pillars) {
        if (p.y >= c.top - .5) continue;
        const dx = p.x - c.x, dz = p.z - c.z, q = c.r + r, d = Math.hypot(dx, dz);
        if (d < q && d > 1e-4) { p.x += dx / d * (q - d); p.z += dz / d * (q - d); }
      }
      // Derin suya ve açık denize girilmez
      if (level.groundAt(p.x, p.z, p.y) < -.42) { p.x = prev.x; p.z = prev.z; }
    },
    // Kamerayla oyuncu arasına giren ağaçlar varsa kamerayı öne çeker
    cameraLimit(t, dx, dz, dist, pitch) {
      let lim = dist;
      for (const k of treeSpots) {
        const vx = k.x - t.x, vz = k.z - t.z, pr = vx * dx + vz * dz;
        if (pr <= 0 || pr > dist + 3) continue;
        const R = 2.3 * k.s, px = vx - pr * dx, pz = vz - pr * dz;
        if (px * px + pz * pz > R * R) continue;
        if (t.y + Math.tan(pitch) * pr > height(k.x, k.z) + 7.5 * k.s) continue;
        lim = Math.min(lim, Math.max(3.2, pr - R));
      }
      return lim;
    },
    cameraFix(pos) { pos.y = Math.max(pos.y, Math.max(height(pos.x, pos.z), 0) + .7); },
    update(t, dt, player, camera) {
      uTime.value = t;
      sky.position.copy(camera.position);
      sun.target.position.copy(player.pos); sun.position.copy(player.pos).add(new THREE.Vector3(36, 62, 26));
      if (Q.shadow) { /* gölgeler kamerayla kayar */ }
      pts.material.uniforms.uC.value.copy(player.pos);
      cl.forEach((c, i) => { c.x += c.v * dt; if (c.x > 260) c.x = -260; dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(c.s * 1.5, c.s * .7, c.s); dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix); });
      clouds.instanceMatrix.needsUpdate = true;
      flies.forEach(f => {
        const a = t * .55 + f.ph, x = f.cx + Math.cos(a) * f.r, z = f.cz + Math.sin(a * 1.3) * f.r;
        f.g.position.set(x, Math.max(height(x, z), 0) + 1.6 + Math.sin(t * 2 + f.ph) * .5, z); f.g.rotation.y = -a;
        const w = Math.sin(t * 16 + f.ph) * .9; f.a.rotation.z = w; f.b.rotation.z = -w;
      });
      flowers.forEach(h => { h.rotation.y = Math.sin(t * .2) * .3 + .6; });
      const pp = player.pos;
      for (const k in stations) {
        const s = stations[k], d2 = (s.g.position.x - pp.x) ** 2 + (s.g.position.z - pp.z) ** 2;
        s.beacon.position.y = 2.6 + Math.sin(t * 2) * .22; s.beacon.rotation.y = t;
        s.lab.visible = d2 < 34 * 34 && (s.spot.x - pp.x) ** 2 + (s.spot.z - pp.z) ** 2 > 30;
        if (d2 < 120 * 120 && s.upd) s.upd(t);
        if (d2 < (s.gm.r + 8) ** 2) hooks.seen(s.gm.id);
      }
      updaters.forEach(u => u(t, dt));
      for (let i = pickups.length - 1; i >= 0; i--) {
        const k = pickups[i]; k.m.rotation.y = t * 2; k.m.position.y = k.y + Math.sin(t * 2.5) * .2;
        if (Math.hypot(pp.x - k.x, pp.z - k.z) < 1.8 && Math.abs(pp.y + 1 - k.y) < 2.4) { giveCard(k.id); sfx('collect'); scene.remove(k.m); pickups.splice(i, 1); }
      }
      const b = hooks.bounce;
      if (b && Math.hypot(pp.x - b.x, pp.z - b.z) < b.r && pp.y <= b.top + .35 && player.vy <= 0.5 && pp.y > b.top - 2.5) { player.vy = 21; player.grounded = false; pp.y = Math.max(pp.y, b.top); sfx('jump'); }
    },
    stations,
    refresh() { for (const k in stations) stations[k].refresh(); },
  };
  return level;
}
