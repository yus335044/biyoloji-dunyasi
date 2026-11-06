import * as THREE from 'three';

// Ortak zaman uniform'u: rüzgâr ve su shader'ları kullanır.
export const uTime = { value: 0 };

const mats = new Map();
export function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...o }));
  return mats.get(key);
}
function mk(geo, color, x, y, z, o) {
  const m = new THREE.Mesh(geo, color?.isMaterial ? color : M(color, o));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
export const box = (w, h, d, c, x = 0, y = 0, z = 0, o) => mk(new THREE.BoxGeometry(w, h, d), c, x, y, z, o);
export const cyl = (rt, rb, h, c, x = 0, y = 0, z = 0, seg = 8, o) => mk(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, o);
export const ball = (r, c, x = 0, y = 0, z = 0, det = 1, o) => mk(new THREE.IcosahedronGeometry(r, det), c, x, y, z, o);
export const cone = (r, h, c, x = 0, y = 0, z = 0, seg = 7, o) => mk(new THREE.ConeGeometry(r, h, seg), c, x, y, z, o);
export const ring = (r, t, c, x = 0, y = 0, z = 0, o) => mk(new THREE.TorusGeometry(r, t, 6, 20), c, x, y, z, o);
export const glow = (c, i = 1.2) => ({ emissive: c, emissiveIntensity: i });
export const live = m => { m.userData.live = true; return m; };

/** Geometrileri tek geometride birleştirir (BufferGeometryUtils yerine küçük sürüm). */
export function mergeGeos(list) {
  const flat = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of flat) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
export function tint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
export const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

/** Grubun hareketsiz, parlamayan parçalarını tek draw call'a indirger. `live` işaretliler aynen kalır. */
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), geos = [], remove = [];
  root.traverse(o => {
    if (!o.isMesh || o === root) return;
    let p = o, keep = false;
    while (p && p !== root) { if (p.userData.live) keep = true; p = p.parent; }
    const m = o.material;
    if (keep || m.transparent || !m.isMeshStandardMaterial || m.emissiveIntensity > 0 && m.emissive?.getHex()) return;
    const g = tint(o.geometry.clone(), m.color); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    geos.push(g); remove.push(o);
  });
  remove.forEach(o => { o.parent.remove(o); o.geometry.dispose(); });
  if (geos.length) {
    const merged = new THREE.Mesh(mergeGeos(geos), vcMat);
    merged.geometry.computeVertexNormals();
    merged.castShadow = merged.receiveShadow = true; root.add(merged);
  }
  return root;
}

/** Rüzgâr: instanced yaprakları hafifçe sallar. */
export function windMat(mat, amp = 0.12) {
  mat.onBeforeCompile = s => {
    s.uniforms.uTime = uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3][0] * .3 + instanceMatrix[3][2] * .23;
      #else
        float ph = 0.;
      #endif
      float w = max(position.y, 0.) * ${amp.toFixed(3)};
      transformed.x += sin(uTime * 1.5 + ph) * w; transformed.z += cos(uTime * 1.2 + ph * 1.3) * w * .7;`);
  };
  return mat;
}

/** Tuval dokusuyla yazı; tabelalar ve ekranlar. Türkçe karakter destekli. */
export function textTexture(lines, o = {}) {
  const { w = 512, h = 256, bg = '#2d4a3e', fg = '#fff8e0', font = 600, size = 54, border = '#8a6a3f', lineGap = 1.25 } = o;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  if (border) { x.strokeStyle = border; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${font} ${size}px Fredoka, "SF Pro Rounded", system-ui, sans-serif`;
  const arr = Array.isArray(lines) ? lines : [lines], top = h / 2 - (arr.length - 1) * size * lineGap / 2;
  arr.forEach((l, i) => x.fillText(l, w / 2, top + i * size * lineGap));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function sign(lines, W, H, o) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: textTexture(lines, { h: Math.round(512 * H / W), ...o }), transparent: false, toneMapped: false, fog: true }));
  m.userData.live = true; return m;
}
export function billboard(text, color = '#fff', scale = 6) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.font = '600 44px Fredoka, system-ui, sans-serif'; const w = Math.min(500, x.measureText(text).width + 50);
  x.fillStyle = 'rgba(8,32,28,.72)'; x.beginPath(); x.roundRect(256 - w / 2, 8, w, 80, 34); x.fill();
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(scale, scale * 96 / 512, 1); s.userData.live = true; return s;
}

/** Sabit tohumlu rastgele sayı; dünya her açılışta aynı görünür. */
export function seeded(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
