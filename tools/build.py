#!/usr/bin/env python3
"""Tek dosyalık dağıtım üretir: dist/photosynthesis-world.html (Node gerekmez, çift tıkla açılır)."""
import json, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda p: open(os.path.join(root, p), encoding='utf8').read()
mods = {'three': read('vendor/three.module.min.js')}
for d, _, fs in os.walk(os.path.join(root, 'src')):
    for f in fs:
        if f.endswith('.js'):
            rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
            mods[rel] = read(rel)
loader = """
const M = JSON.parse(document.getElementById('mods').textContent), U = {};
const dir = p => p.split('/').slice(0, -1);
const res = (from, s) => { const o = dir(from); for (const x of s.split('/')) { if (x === '..') o.pop(); else if (x !== '.') o.push(x); } return o.join('/'); };
function url(id) {
  if (U[id]) return U[id];
  const src = M[id].replace(/(from\\s*|import\\s*\\(?\\s*)(['"])(\\.{1,2}\\/[^'"]+|three)\\2/g, (m, a, q, s) => a + q + url(s === 'three' ? 'three' : res(id, s)) + q);
  return U[id] = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
}
import(url('src/main.js'));
"""
html = read('index.html')
html = re.sub(r'<script type="importmap">.*?</script>\n?', '', html, flags=re.S)
html = re.sub(r'<link href="src/ui/style.css"[^>]*>', lambda _: '<style>' + read('src/ui/style.css') + '</style>', html)
html = re.sub(r'<script type="module" src="src/main.js"></script>', lambda _: '<script type="application/json" id="mods">' + json.dumps(mods).replace('</', '<\\/') + '</script><script type="module">' + loader + '</script>', html)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
out = os.path.join(root, 'dist/photosynthesis-world.html')
open(out, 'w', encoding='utf8').write(html)
print(out, round(os.path.getsize(out) / 1e6, 2), 'MB')
