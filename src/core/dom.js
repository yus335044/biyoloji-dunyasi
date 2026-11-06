/** h('div.a.b', {onclick}, child...) — küçük DOM yardımcısı. */
export function h(sel, props, ...kids) {
  const [head, ...cls] = sel.split('.'), [tag, id] = head.split('#');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (cls.length) el.className = cls.join(' ');
  if (props instanceof Node || typeof props !== 'object' || props === null) kids.unshift(props);
  else for (const [k, v] of Object.entries(props)) {
    if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el[k] = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const isTouch = () => matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
