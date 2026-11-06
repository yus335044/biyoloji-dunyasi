// Saf arazi matematiği: hem tarayıcı hem Node sunucusu kullanır (three.js gerektirmez).
import { GAMES } from '../core/data.js';

export const PONDS = [{ x: 60, z: -2, r: 22 }, { x: -18, z: 18, r: 6 }, { x: -62, z: 44, r: 9 }, { x: 10, z: -42, r: 6 }];
// Gizli alanların dünya koordinatları; sunucu giriş doğrulamasında da kullanır.
export const SECRET = { yusuf: [-92, -4], cave: [64, 37], plant: [-22, -44], prof: [-58, 80], frog: [-12, 19], mush: [-27, 68], pillar: [-22, 72] };
const HILLS = [
  { x: -58, z: -48, h: 9, r: 17 }, { x: 74, z: 46, h: 13, r: 16 }, { x: 18, z: 80, h: 5, r: 18 },
  { x: -84, z: -22, h: 6, r: 16 }, { x: 74, z: -66, h: 7, r: 16 }, { x: -22, z: -92, h: 5, r: 16 }, { x: 42, z: 8, h: 2.5, r: 8 },
];
export const STATIONS = GAMES.filter(g => g.r);
const HUB = [0, 0];
// Yollar: merkezden bölge düğümlerine, oradan istasyonlara.
const NODES = { lab: [0, 34], forest: [-34, -4], lake: [32, -10], north: [4, -50] };
export const PATHS = [
  [HUB, NODES.lab], [HUB, NODES.forest], [HUB, NODES.lake], [HUB, [0, -20]], [[0, -20], NODES.north],
  [NODES.lab, [-16, 46]], [NODES.lab, [20, 56]], [NODES.lab, [36, 32]], [NODES.lab, [-42, 34]],
  [NODES.forest, [-40, 8]], [NODES.forest, [-58, -12]], [NODES.forest, [-30, -30]], [[-40, 8], [-74, 22]],
  [NODES.lake, [40, -24]], [[40, -24], [78, -24]],
  [NODES.north, [-10, -68]], [NODES.north, [26, -62]], [NODES.north, [-40, -62]], [[26, -62], [56, -52]],
];
export const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.12;

export function pathDist(x, z) {
  let m = 1e9;
  for (const [a, b] of PATHS) {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const wob = Math.sin(t * 9 + a[0]) * 1.4 * Math.sin(t * Math.PI);
    m = Math.min(m, Math.hypot(x - (a[0] + dx * t) + wob * dz / 40, z - (a[1] + dz * t) - wob * dx / 40));
  }
  return m;
}
export const BASE = 1.5;
function raw(x, z) {
  const d = Math.hypot(x, z), a = Math.atan2(z, x);
  const shore = 118 + 7 * Math.sin(a * 3 + 1) + 4 * Math.sin(a * 5 + 2.3) + 2.5 * Math.sin(a * 11);
  const t = sm(shore, shore - 20, d);
  let hh = -2.6 + t * (2.6 + 0.7) + t * fbm(x * 0.035 + 10, z * 0.035 + 10) * 2.6;
  for (const k of HILLS) { const q = ((x - k.x) ** 2 + (z - k.z) ** 2) / (k.r * k.r); if (q < 6) hh += k.h * Math.exp(-q * 1.6) * (0.85 + 0.3 * vnoise(x * 0.2, z * 0.2)); }
  // Yollar ve istasyon düzlükleri yumuşatılır
  const pd = pathDist(x, z); hh += (Math.min(hh, BASE + 1.2) - hh) * sm(5, 1.5, pd); hh += (BASE - hh) * 0.6 * sm(6, 2, pd);
  for (const g of STATIONS) { const q = Math.hypot(x - g.pos[0], z - g.pos[1]); hh += (BASE - hh) * sm(g.r + 8, g.r + 3, q); }
  hh += (BASE - hh) * sm(26, 18, d);
  for (const p of PONDS) { const q = Math.hypot(x - p.x, z - p.z) / p.r + (vnoise(x * .25, z * .25) - .5) * .25; hh = hh + (-1.6 - hh) * sm(1.15, 0.72, q); }
  return hh;
}

// Sıklık: çalışma zamanında ızgaradan okunur (hızlı).
export const SIZE = 290; export let SEG = 150; let grid, step;
export function buildGrid(seg) {
  SEG = seg; step = SIZE / SEG; grid = new Float32Array((SEG + 1) ** 2);
  for (let j = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++) grid[j * (SEG + 1) + i] = raw(-SIZE / 2 + i * step, -SIZE / 2 + j * step);
}
/** Üçgenlerin gerçek yüzeyine oturan bilineer yükseklik. */
export function height(x, z) {
  const fx = (x + SIZE / 2) / step, fz = (z + SIZE / 2) / step;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= SEG || j >= SEG) return -4;
  const u = fx - i, v = fz - j, s = SEG + 1;
  const a = grid[j * s + i], b = grid[j * s + i + 1], c = grid[(j + 1) * s + i], e = grid[(j + 1) * s + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
}

