import { h, clamp, rnd, pick, shuffle } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';
import { steps } from './shell.js';

// 5) SU TAŞIMA — boru döndürme bulmacası (rastgele çözülebilir ızgara)
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // üst, sağ, alt, sol
export function su(ctx) {
  const LV = [[4, 5], [5, 6], [5, 7]]; let lv = 0;
  const FACTS = ['Bitki suyu topraktan kökleriyle alır.', 'Su, iletim boruları ile gövdeden yukarı taşınır.', 'Yaprağa ulaşan su fotosentezde kullanılır.'];
  const wrap = h('div.su'); ctx.root.append(wrap);
  const timer = ctx.countdown(100, () => ctx.finish({ success: false, score: ctx.score, note: `${lv}/3 bitki sulandı. Önce başlangıçtan çıkan yolu takip etmeyi dene.` }));
  function level() {
    const [W, H] = LV[lv]; wrap.innerHTML = ''; let moves = 0;
    // Çözüm yolu
    const startC = Math.floor(rnd(W)), endC = Math.floor(rnd(W)), path = [[startC, H - 1]]; let cx = startC;
    for (let y = H - 1; y >= 0; y--) {
      const tx = y === 0 ? endC : Math.floor(rnd(W));
      while (cx !== tx) { cx += Math.sign(tx - cx); path.push([cx, y]); }
      if (y > 0) path.push([cx, y - 1]);
    }
    const cell = Array.from({ length: H }, () => Array(W).fill(null));
    const side = (a, b) => DIR.findIndex(d => d[0] === b[0] - a[0] && d[1] === b[1] - a[1]);
    path.forEach((p, i) => {
      const ms = new Set();
      if (i > 0) ms.add(side(p, path[i - 1])); else ms.add(2);
      if (i < path.length - 1) ms.add(side(p, path[i + 1])); else ms.add(0);
      cell[p[1]][p[0]] = { m: [...ms], onPath: true };
    });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!cell[y][x]) cell[y][x] = { m: Math.random() < .5 ? [0, 2] : [0, 1] };
    const tiles = cell.flat();
    tiles.forEach(t => { t.r = Math.floor(rnd(4)); });
    const open = t => t.m.map(d => (d + t.r) % 4);
    const grid = h('div.su-grid', { style: { gridTemplateColumns: `repeat(${W},1fr)`, aspectRatio: `${W}/${H}` } });
    const els = []; ctx.dbg = { els };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = cell[y][x]; const svg = pipe(t.m);
      const b = h('button.su-t', { html: svg, 'aria-label': 'Boru', onclick: () => { t.r = (t.r + 1) % 4; moves++; sfx('tick'); draw(); } });
      els.push([b, t, x, y]); grid.append(b);
    }
    let play, top, bot;
    wrap.append(
      h('div.su-side', steps(3, lv), h('div.su-lb', { html: icon('plant', 18) + 'Yaprak' }), h('small', FACTS[lv])),
      play = h('div.su-play', top = pad(endC, W, '🍃', 'Yaprak'), grid, bot = pad(startC, W, '💧', 'Kök')));
    const fit = () => { const r = play.getBoundingClientRect(), c = Math.floor(Math.min(r.width / W, (r.height - 52) / H)); if (c <= 0) return; grid.style.width = top.style.width = bot.style.width = c * W + 'px'; grid.style.height = c * H + 'px'; };
    fit(); ctx.on(window, 'resize', fit); ctx.after(0, fit);
    function pad(col, W2, em, lb) { const p = h('div.su-pad', { style: { gridTemplateColumns: `repeat(${W2},1fr)` } }); for (let i = 0; i < W2; i++) p.append(h('span' + (i === col ? '.on' : ''), i === col ? `${em} ${lb}` : '')); return p; }
    function draw() {
      const wet = new Set(), st = [[startC, H - 1]];
      if (open(cell[H - 1][startC]).includes(2)) {
        while (st.length) { const [x, y] = st.pop(), k = x + ',' + y; if (wet.has(k)) continue; wet.add(k);
          for (const d of open(cell[y][x])) { const nx = x + DIR[d][0], ny = y + DIR[d][1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; if (open(cell[ny][nx]).includes((d + 2) % 4)) st.push([nx, ny]); } }
      }
      els.forEach(([b, t, x, y]) => { b.firstChild.style.transform = `rotate(${t.r * 90 + (b._spin = (b._spin ?? 0))}deg)`; b.classList.toggle('wet', wet.has(x + ',' + y)); });
      if (wet.has(endC + ',0') && open(cell[0][endC]).includes(0)) {
        const pts = Math.max(140, 300 - Math.max(0, moves - path.length * 2) * 6); ctx.add(pts); sfx('win');
        ctx.toast(`Su yaprağa ulaştı! +${pts}`, 'good'); els.forEach(([b]) => { b.disabled = true; });
        lv++;
        ctx.after(1100, () => { if (lv >= 3) { timer.stop = true; ctx.add(timer.left * 1.2); ctx.finish({ success: true, score: ctx.score, note: 'Üç bitkinin de su yolu açık.' }); } else level(); });
      }
    }
    draw();
  }
  level();
}
function pipe(m) {
  const P = { 0: 'M50 50V0', 1: 'M50 50H100', 2: 'M50 50V100', 3: 'M50 50H0' };
  const d = m.map(k => P[k]).join(' ');
  return `<svg viewBox="0 0 100 100"><path class="o" d="${d}"/><path class="i" d="${d}"/><circle class="n" cx="50" cy="50" r="17"/></svg>`;
}

// 7) CALVIN DÖNGÜSÜ — sıradaki istasyonu seç, doğru maddeleri yükle (ara basamak yok: MEB programı)
export function calvin(ctx) {
  const ST = [
    { n: 'Karbon girişi', c: '#6fe0ff', need: ['CO₂'], q: 'Besin yapımında karbon kaynağı olan madde hangisi?', txt: 'CO₂ stromaya alındı.' },
    { n: 'Enerji yükleme', c: '#ffd76b', need: ['ATP', 'NADPH'], q: 'Işığın kullanıldığı tepkimelerden hangi iki madde gelir?', txt: 'ATP enerji, NADPH hidrojen ve elektron sağladı.' },
    { n: 'Besin çıkışı', c: '#ff9f6b', need: ['Glikoz'], q: 'Bu tepkimelerin sonunda hangi besin oluşur?', txt: 'Glikoz oluştu! Fazlası nişasta olarak depolanabilir.' },
    { n: 'Geri gönderme', c: '#a4ff5c', need: ['ADP', 'NADP⁺'], q: 'Hangi iki madde yeniden kullanılmak üzere tilakoide döner?', txt: 'ADP ve NADP⁺ tilakoide döndü, yeniden kullanılacak.' },
  ];
  const POOL = ['CO₂', 'ATP', 'NADPH', 'O₂', 'H₂O', 'Glikoz', 'ADP', 'NADP⁺'];
  let step = 0, err = 0, mode = 'pick', sel = new Set(), besin = 0; const total = 8;
  const wheel = h('div.cv-wheel'), panel = h('div.cv-panel'), mols = h('div.cv-mols');
  ctx.root.append(h('div.cv', h('div.cv-left', wheel, mols), panel));
  const nodes = ST.map((n, i) => {
    const a = (-90 + i * 90) * Math.PI / 180;
    const b = h('button.cv-node', { style: { left: 50 + Math.cos(a) * 38 + '%', top: 50 + Math.sin(a) * 38 + '%', '--c': n.c }, onclick: () => pickNode(i) }, n.n);
    wheel.append(b); return b;
  });
  const hub = h('div.cv-hub', h('small', 'STROMA'), h('b', 'Tur 1/2')); wheel.append(hub);
  function mistake(t) { err++; ctx.add(-30); ctx.bad(t); if (err >= 6) ctx.finish({ success: false, score: ctx.score, note: 'Makine durdu. Doğru sıra: CO₂ girişi → ATP ve NADPH → glikoz → ADP ve NADP⁺ geri döner.' }); }
  function pickNode(i) {
    if (mode !== 'pick') return;
    if (i !== step % 4) return mistake('Bu istasyonun sırası değil. Önce neyin gerektiğini düşün.');
    sfx('good'); mode = 'load'; sel = new Set(); render();
  }
  function run() {
    const n = ST[step % 4], ok = sel.size === n.need.length && n.need.every(k => sel.has(k));
    if (!ok) return mistake(`${n.n} için seçtiğin maddeler uygun değil.`);
    if (n.need.includes('Glikoz')) besin++;
    ctx.add(125); sfx('collect'); ctx.toast(n.txt, 'good', 2800); step++; mode = 'pick'; render();
    if (step >= total) ctx.after(700, () => ctx.finish({ success: true, score: ctx.score, note: 'Besin makinesi iki tur çalıştı: CO₂, ATP ve NADPH kullanılarak glikoz üretildi.' }));
  }
  function render() {
    const cur = step % 4, turn = Math.min(2, Math.floor(step / 4) + 1);
    hub.lastChild.textContent = `Tur ${turn}/2`;
    nodes.forEach((b, i) => { b.classList.toggle('now', mode === 'load' && i === cur); b.classList.toggle('past', i < cur); });
    mols.innerHTML = ''; [['Adım', `${Math.min(step + 1, total)}/${total}`, '#6fe0ff'], ['Üretilen glikoz', String(besin), '#ff9f6b'], ['Hata', `${err}/6`, '#ff8a8a']].forEach(([k, v, c]) => mols.append(h('div', { style: { '--c': c } }, h('small', k), h('b', v))));
    panel.innerHTML = '';
    if (mode === 'pick') {
      panel.append(h('div.chip', `Adım ${Math.min(step + 1, total)}/${total}`), h('h3', 'Sıradaki istasyona dokun'),
        h('p', step === 0 ? 'Makine boş. Besin yapmak için önce hangi madde alınmalı?' : 'Sıradaki istasyon hangisi? Çarkta saat yönünde ilerle.'));
    } else {
      const n = ST[cur];
      panel.append(h('div.chip', { style: { background: n.c, color: '#10302a' } }, n.n), h('h3', 'Maddeleri seç'), h('p', turn === 1 ? n.q : 'İkinci tur: ipucu yok, hatırlamaya çalış!'));
      const grid = h('div.cv-toks');
      POOL.forEach(k => { const b = h('button.cv-tok' + (sel.has(k) ? '.on' : ''), { onclick: () => { sel.has(k) ? sel.delete(k) : sel.add(k); b.classList.toggle('on'); sfx('tick'); } }, k); b.dataset.k = k; grid.append(b); });
      panel.append(grid, h('button.btn.primary', { html: icon('play') + 'Çalıştır', onclick: run }));
    }
  }
  render();
}

// 8) DEDEKTİF — metinde hatalı ifadeyi yakala, doğrusuyla değiştir
const CASES = [
  { f: 'Dosya 1 · Oksijen', t: 'Fotosentezde [klorofil] ışık enerjisini yakalar. Açığa çıkan O₂ {CO₂} molekülünden gelir. Bu O₂’nin bir kısmı [stomalardan] atmosfere geçer.', a: 'su', o: ['su', 'glikoz', 'ATP'], w: 'Oksijen, suyun parçalanmasıyla (fotoliz) oluşur.' },
  { f: 'Dosya 2 · Tepkime Yeri', t: 'Işığın kullanıldığı tepkimeler {stromada} gerçekleşir. Burada [ATP] ve [NADPH] üretilir. Bu ürünler daha sonra Calvin döngüsünde kullanılır.', a: 'tilakoit zarında', o: ['tilakoit zarında', 'dış zarda', 'çekirdekte'], w: 'Işığın kullanıldığı tepkimeler tilakoit zarında, kullanılmadığı tepkimeler stromada olur.' },
  { f: 'Dosya 3 · Renkler', t: 'Bitkiler [yeşil] görünür. Çünkü klorofil en çok {yeşil ışığı} soğurur. [Kırmızı] ışık ise fotosentezde kullanılır.', a: 'mavi-mor ve kırmızı ışığı', o: ['mavi-mor ve kırmızı ışığı', 'yalnızca sarı ışığı', 'yalnızca yeşil ve sarı ışığı'], w: 'Yeşil ışık büyük oranda yansır; bu yüzden yaprak yeşil görünür.' },
  { f: 'Dosya 4 · Calvin', t: 'Calvin döngüsü [stromada] gerçekleşir. Bu tepkimelerde [CO₂] kullanılır. Döngünün sonunda {oksijen} oluşur.', a: 'glikoz', o: ['glikoz', 'su', 'klorofil'], w: 'Calvin döngüsünün ürünü glikozdur. Oksijen ise fotolizde oluşur.' },
  { f: 'Dosya 5 · İki Evre', t: 'Işığın kullanılmadığı tepkimeler [ATP] ve [NADPH] kullanır. Bu maddeler {köklerde} üretilir. Üretilen glikoz bitkide kullanılır.', a: 'ışığın kullanıldığı tepkimelerde', o: ['ışığın kullanıldığı tepkimelerde', 'hücre çekirdeğinde', 'stomalarda'], w: 'İki evre birbirine bağlıdır: birinin ürünleri diğerinde kullanılır.' },
  { f: 'Dosya 6 · Solunum', t: 'Bitkiler ışıkta [fotosentez] yapar. {Bitkiler yalnızca gece} solunum yapar. Solunumla [ATP] üretilir.', a: 'Bitkiler gece ve gündüz', o: ['Bitkiler gece ve gündüz', 'Bitkiler hiçbir zaman', 'Bitkiler yalnızca kışın'], w: 'Canlı bitki hücreleri sürekli solunum yapar.' },
  { f: 'Dosya 7 · Van Helmont', t: 'Van Helmont, saksıya [söğüt fidanı] dikip yalnızca [su] verdi. Ağaç büyüdü, topraktaki azalma ise {çok fazla} oldu.', a: 'çok az', o: ['çok az', 'iki katı', 'tamamı'], w: 'Toprak çok az azaldı; yani bitki kütlesinin kaynağı toprak değildi.' },
  { f: 'Dosya 8 · Fotoliz', t: 'Fotolizde [su] parçalanır. Açığa çıkan [elektronlar] {doğrudan glikoza} aktarılır. Oluşan [oksijen] atmosfere verilebilir.', a: 'elektron taşıma sistemine', o: ['elektron taşıma sistemine', 'atmosfere', 'çekirdeğe'], w: 'Elektronlar, ışığın kullanıldığı tepkimelerde elektron taşıma sistemine geçer.' },
  { f: 'Dosya 9 · Yapı', t: 'Kloroplast [çift zarlıdır]. Tilakoitlerin üst üste yığılmasıyla {stroma} oluşur. [Klorofil] tilakoit zarında bulunur.', a: 'granum', o: ['granum', 'lizozom', 'ribozom'], w: 'Yığılmış tilakoitlere granum denir. Stroma ise iç zarın çevrelediği sıvıdır.' },
  { f: 'Dosya 10 · Faktörler', t: 'Işık şiddeti arttıkça hız bir noktaya kadar artar. Sonra [sabit] kalır. {Sıcaklık sınırsız artsa bile} [enzimler] hızlanmaya devam eder.', a: 'Sıcaklık en uygun değere ulaşana kadar', o: ['Sıcaklık en uygun değere ulaşana kadar', 'Sıcaklık donma noktasının altındayken', 'Sıcaklık 100 °C’yi geçince'], w: 'En uygun sıcaklık aşılınca enzimler iyi çalışamaz, hız düşer.' },
  { f: 'Dosya 11 · Priestley', t: 'Priestley, kapalı kaba [yanan mum] ve [nane bitkisi] koydu. Bitki, mumun bozduğu havayı {daha da bozdu}.', a: 'yeniledi', o: ['yeniledi', 'yok etti', 'dondurdu'], w: 'Bitkinin havayı yenilediğini sonradan oksijen üretimi açıkladı.' },
  { f: 'Dosya 12 · Ingenhousz', t: 'Ingenhousz, bitkilerin havayı yenilemesi için [ışığın] gerektiğini gösterdi. Bu olay yalnızca {karanlıkta} görülür. [Yeşil] kısımlar bunu sağlar.', a: 'aydınlıkta', o: ['aydınlıkta', 'köklerde', 'kışın'], w: 'Bitkilerin yeşil kısımları ışıkta oksijen üretir.' },
  { f: 'Dosya 13 · Pigmentler', t: 'Yapraklarda [klorofil] bulunur. Sonbaharda görülen sarı ve turuncu renkler {suyun rengidir}. Bu [pigmentler] ışığı yakalamaya yardım eder.', a: 'ksantofil ve karoten pigmentlerinden gelir', o: ['ksantofil ve karoten pigmentlerinden gelir', 'CO₂ gazından gelir', 'oksijenden gelir'], w: 'Klorofil azalınca ksantofil ve karotenin renkleri belirginleşir.' },
];
export function dedektif(ctx) {
  const list = shuffle([...CASES]).slice(0, 6); let i = 0, lives = 3;
  const wrap = h('div.det'); ctx.root.append(wrap);
  const per = 1000 / 6;
  function show() {
    const cs = list[i]; ctx.dbg = { cs }; wrap.innerHTML = ''; let gain = per;
    const hearts = h('div.det-lives', { html: Array.from({ length: 3 }, (_, k) => `<span class="${k < lives ? 'on' : ''}">${icon('lens', 22)}</span>`).join('') });
    const para = h('p.det-text');
    cs.t.split(/(\[[^\]]+\]|\{[^}]+\})/).forEach(part => {
      if (part.startsWith('[')) para.append(h('button.det-w', { onclick: e => wrongTap(e.currentTarget) }, part.slice(1, -1)));
      else if (part.startsWith('{')) para.append(h('button.det-w', { onclick: e => rightTap(e.currentTarget) }, part.slice(1, -1)));
      else para.append(part);
    });
    const opts = h('div.det-opts');
    wrap.append(h('div.det-head', steps(6, i), hearts), h('div.det-file', h('div.chip', cs.f), h('h3', 'Sahte bilgi hangisi?'), para, opts));
    function wrongTap(b) { b.classList.add('nope'); b.disabled = true; hit('Bu ifade doğru, masum birini suçladın!'); gain -= 50; }
    function hit(t) { lives--; ctx.bad(t); hearts.innerHTML = Array.from({ length: 3 }, (_, k) => `<span class="${k < lives ? 'on' : ''}">${icon('lens', 22)}</span>`).join(''); if (lives <= 0) ctx.finish({ success: false, score: ctx.score, note: 'Üç yanlış suçlama, dava kapandı! Vurgulu ifadeleri öğrendiklerinle karşılaştır.' }); }
    function rightTap(b) {
      if (opts.children.length) return; sfx('good'); b.classList.add('caught'); para.querySelectorAll('button').forEach(x => { x.disabled = true; });
      opts.append(h('b', 'Doğrusu hangisi?'));
      shuffle([...cs.o]).forEach(o => opts.append(h('button.tile', { onclick: e => {
        if (o === cs.a) {
          ctx.add(Math.max(40, gain)); ctx.good(); b.textContent = cs.a; b.classList.replace('caught', 'fixed');
          opts.innerHTML = ''; opts.append(h('div.det-why', { html: icon('book', 18) + cs.w }), h('button.btn.primary', { onclick: () => { i++; i >= list.length ? ctx.finish({ success: true, score: ctx.score, note: 'Bütün sahte bilgileri ortaya çıkardın.' }) : show(); } }, i + 1 >= list.length ? 'Davayı kapat' : 'Sonraki dosya'));
        } else { e.currentTarget.disabled = true; gain -= 40; hit('Bu da doğru değil, tekrar düşün.'); }
      } }, o)));
    }
  }
  show();
}

// 10) MOLEKÜL EŞLEŞTİRME — hafıza oyunu
const PAIRS = [
  ['H₂O', 'Fotolizde parçalanan madde'], ['CO₂', 'Glikoz yapımında karbon kaynağı'], ['O₂', 'Fotolizde açığa çıkan gaz'], ['ATP', 'Enerji taşıyan molekül'],
  ['NADPH', 'Hidrojen ve elektron taşıyan molekül'], ['Klorofil', 'Işığı yakalayan yeşil pigment'], ['Glikoz', 'Fotosentezde üretilen besin'], ['Karoten', 'Turuncu renkli pigment'],
];
export function molekul(ctx) {
  const deck = shuffle(PAIRS.flatMap(([m, r], i) => [{ i, t: m, big: true }, { i, t: r }]));
  const grid = h('div.mem'); ctx.root.append(grid);
  let open = [], lock = false, found = 0, combo = 0, moves = 0;
  const timer = ctx.countdown(100, () => ctx.finish({ success: false, score: ctx.score, note: `${found}/8 çift bulundu. Molekülün görevini hatırlamaya odaklan.` }));
  deck.forEach(d => {
    const b = h('button.mem-c', h('span.f', { html: icon('leaf', 26) }), h('span.b' + (d.big ? '.big' : ''), d.t));
    b.dataset.i = d.i;
    b.onclick = () => {
      if (lock || b.classList.contains('up')) return;
      b.classList.add('up'); sfx('tick'); open.push([b, d]);
      if (open.length < 2) return;
      moves++; lock = true; const [[a, x], [c, y]] = open; open = [];
      if (x.i === y.i) {
        combo++; found++; ctx.add(70 + combo * 12); sfx('collect');
        a.classList.add('ok'); c.classList.add('ok'); lock = false; if (combo > 1) ctx.toast(`Seri x${combo}!`, 'good', 900);
        if (found === 8) { timer.stop = true; ctx.add(timer.left * 1.5); ctx.finish({ success: true, score: ctx.score, note: `${moves} hamlede bütün çiftleri buldun.` }); }
      } else { combo = 0; ctx.after(850, () => { a.classList.remove('up'); c.classList.remove('up'); lock = false; }); }
    };
    grid.append(b);
  });
}

// 12) PUZZLE — denklem kurma, atom dengesi, ürün-yer eşleştirme
export function puzzle(ctx) {
  const wrap = h('div.pz'); ctx.root.append(wrap); let stage = 0, err = 0;
  // Sürükle-bırak + dokun-yerleştir
  function dnd(tiles, slots, onPlace) {
    let sel = null, ghost = null;
    const clear = () => { sel?.classList.remove('sel'); sel = null; };
    const put = (tile, slot) => { clear(); onPlace(tile, slot); };
    tiles.forEach(t => {
      t.addEventListener('pointerdown', e => {
        if (t.disabled) return; e.preventDefault(); clear(); sel = t; t.classList.add('sel'); const sx = e.clientX, sy = e.clientY; let moved = false;
        const mv = ev => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { moved = true; ghost = t.cloneNode(true); ghost.classList.add('ghost'); document.body.append(ghost); } if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; } };
        const upf = ev => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', upf); removeEventListener('pointercancel', upf);
          if (ghost) { ghost.remove(); ghost = null; }
          if (moved) { const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.pz-slot'); if (el && slots.includes(el)) put(t, el); else clear(); }
        };
        addEventListener('pointermove', mv); addEventListener('pointerup', upf); addEventListener('pointercancel', upf);
      });
    });
    slots.forEach(s => { s.onclick = () => { if (sel) put(sel, s); }; });
  }
  function stage1() {
    stage = 0; wrap.innerHTML = '';
    const eq = [['6CO₂'], '+', ['6H₂O'], 'ışık', ['C₆H₁₂O₆'], '+', ['6O₂']];
    const row = h('div.pz-eq'); const slots = [];
    eq.forEach(p => {
      if (Array.isArray(p)) { const s = h('div.pz-slot'); s.dataset.a = p[0]; slots.push(s); row.append(s); }
      else if (p === 'ışık') row.append(h('div.pz-arrow', h('small', 'ışık + klorofil'), h('i', '→')));
      else row.append(h('b', p));
    });
    const names = ['6CO₂', '6H₂O', 'C₆H₁₂O₆', '6O₂', '6N₂', 'C₃H₆O₃'];
    const pool = h('div.pz-pool'); const tiles = shuffle(names).map(n => { const t = h('button.pz-tile', n); t.dataset.a = n; pool.append(t); return t; });
    wrap.append(h('div.pz-head', steps(3, 0), h('h3', 'Fotosentez denklemini kur'), h('p', 'Girenler solda, ürünler sağda. İki parça fazla!')), row, pool);
    let left = 4;
    dnd(tiles, slots, (t, s) => {
      if (s.classList.contains('full')) return;
      if (t.dataset.a === s.dataset.a) { s.textContent = t.dataset.a; s.classList.add('full'); t.disabled = true; t.style.visibility = 'hidden'; sfx('collect'); ctx.add(75); if (--left === 0) ctx.after(800, stage2); }
      else if (['6N₂', 'C₃H₆O₃'].includes(t.dataset.a)) { err++; ctx.add(-25); ctx.bad(t.dataset.a === '6N₂' ? 'Azot gazı denklemde yer almaz.' : 'Fotosentezin genel ürünü glikozdur (C₆H₁₂O₆).'); }
      else { err++; ctx.add(-25); ctx.bad('Bu parça başka yuvaya ait: tepkimeye girenlerle ürünleri ayır.'); }
    });
  }
  function stage2() {
    wrap.innerHTML = '';
    const v = { CO2: 1, H2O: 1, O2: 1, G: 1 };
    const scales = h('div.pz-scales');
    const mol = (k, lb) => { const n = h('b', '1'); return h('div.pz-co', h('button.round.sm', { onclick: () => { v[k] = Math.max(1, v[k] - 1); n.textContent = v[k]; upd(); sfx('tick'); } }, '−'), n, h('button.round.sm', { onclick: () => { v[k] = Math.min(12, v[k] + 1); n.textContent = v[k]; upd(); sfx('tick'); } }, '+'), h('span', lb)); };
    const row = h('div.pz-bal', mol('CO2', 'CO₂'), h('i', '+'), mol('H2O', 'H₂O'), h('i', '→'), h('div.pz-co.fix', h('b', '1'), h('span', 'C₆H₁₂O₆')), h('i', '+'), mol('O2', 'O₂'));
    const check = h('button.btn.primary', { html: icon('bolt') + 'Dengeyi Doğrula', onclick: () => {
      const a = atoms();
      if (a.every(x => x[1] === x[2])) { sfx('win'); ctx.add(300); ctx.toast('Denge tamam: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂', 'good', 2600); ctx.after(1200, stage3); }
      else { err++; ctx.add(-25); ctx.bad('Atom sayıları eşit değil. Önce karbonu, sonra hidrojeni, en son oksijeni dengele.'); }
    } });
    const atoms = () => [['C', v.CO2, 6], ['H', v.H2O * 2, 12], ['O', v.CO2 * 2 + v.H2O, 6 + v.O2 * 2]];
    function upd() { scales.innerHTML = ''; atoms().forEach(([k, l, r]) => { const dt = clamp((l - r) * 3, -22, 22); scales.append(h('div.scale' + (l === r ? '.eq' : ''), h('small', k), h('div.beam', { style: { transform: `rotate(${dt}deg)` } }, h('span', String(l)), h('span', String(r))))); }); }
    wrap.append(h('div.pz-head', steps(3, 1), h('h3', 'Atom terazisini dengele'), h('p', 'Sol taraf girenler, sağ taraf ürünler. Üç terazi de düz olmalı.')), row, scales, check); upd();
  }
  function stage3() {
    wrap.innerHTML = '';
    const zones = [{ id: 'T', n: 'Tilakoit zarı (ışığın kullanıldığı tepkimeler)' }, { id: 'S', n: 'Stroma (ışığın kullanılmadığı tepkimeler)' }];
    const items = [['O₂ oluşumu', 'T'], ['ATP üretimi', 'T'], ['NADPH üretimi', 'T'], ['Suyun parçalanması', 'T'], ['Glikoz oluşumu', 'S'], ['CO₂ kullanımı', 'S'], ['Calvin döngüsü', 'S']];
    const slots = zones.map(z => { const s = h('div.pz-slot.zone', h('small', z.n)); s.dataset.z = z.id; return s; });
    const pool = h('div.pz-pool'); const tiles = shuffle(items).map(([n, z]) => { const t = h('button.pz-tile', n); t.dataset.z = z; pool.append(t); return t; });
    wrap.append(h('div.pz-head', steps(3, 2), h('h3', 'Kim nerede oluşur?'), h('p', 'Olayları ve ürünleri kloroplastın doğru bölgesine yerleştir.')), h('div.pz-zones', ...slots), pool);
    let left = items.length;
    dnd(tiles, slots, (t, s) => {
      if (t.dataset.z === s.dataset.z) { s.append(h('span.pz-in', t.textContent)); t.disabled = true; t.style.display = 'none'; sfx('collect'); ctx.add(1000 / 3 / items.length); if (--left === 0) ctx.after(600, () => ctx.finish({ success: true, score: ctx.score + 34, note: err ? `${err} hata ile tamamladın.` : 'Hatasız! Fotosentezin haritası artık aklında.' })); }
      else { err++; ctx.add(-25); ctx.bad(t.dataset.z === 'T' ? 'Bu, ışığın kullanıldığı tepkimelerde olur: tilakoit zarı.' : 'Bu, ışığın kullanılmadığı tepkimelerde olur: stroma.'); }
    });
  }
  stage1();
}

// 13) FAKTÖRLER ARENASI — hipotez, ölçüm, grafik yorumu
const sat = (x, k, max) => { const q = x / k; return max * (q >= 1.15 ? 1 : q < .85 ? q : .85 + (1 - Math.pow(1.15 - q, 2) / .09) * .15); };
const EXP = [
  { k: 'Işık şiddeti', u: '%', min: 0, max: 100, f: x => sat(x, 55, 80), shape: 0, q: 'Grafikte hızın artmayı bıraktığı yere dokun.', goal: 57, tol: 20, ok: 'Doğru! Işık artsa da hız artmıyor; artık CO₂ gibi başka bir faktör yetersiz kalıyor.', note: 'Bağımsız değişken: ışık · Bağımlı değişken: hız · Sabit: CO₂, sıcaklık' },
  { k: 'CO₂ derişimi', u: ' birim', min: 0, max: 100, f: x => sat(x, 45, 72), shape: 0, q: 'Grafikte hızın artmayı bıraktığı yere dokun.', goal: 47, tol: 20, ok: 'Doğru! CO₂ artsa da hız artmıyor; artık ışık gibi başka bir faktör yetersiz kalıyor.', note: 'Bağımsız değişken: CO₂ · Bağımlı değişken: hız · Sabit: ışık, sıcaklık' },
  { k: 'Sıcaklık', u: '°C', min: 0, max: 50, f: x => 80 * Math.exp(-(((x - 30) / (x > 30 ? 8 : 15)) ** 2)), shape: 1, q: 'Grafikte hızın en yüksek olduğu sıcaklığa dokun.', goal: 30, tol: 8, ok: 'Doğru! Bu en uygun (optimum) sıcaklıktır. Daha sıcakta enzimler bozulur, hız düşer.', note: 'Bağımsız değişken: sıcaklık · Bağımlı değişken: hız · Sabit: ışık, CO₂' },
];
const SHAPES = [
  { n: 'Artar, sonra sabitlenir', d: 'M6 54C20 20 30 14 44 12H94' },
  { n: 'Hep doğrusal artar', d: 'M6 56L94 8' },
  { n: 'Artar, tepe yapar, düşer', d: 'M6 54C30 30 44 8 58 8C70 8 74 36 94 56' },
];
export function faktor(ctx) {
  const wrap = h('div.fx'); ctx.root.append(wrap); let idx = 0;
  function run() {
    const E = EXP[idx]; let pts = [], val = (E.min + E.max) / 2, predicted = false, tapped = false, bubbles = 0, bub = [];
    wrap.innerHTML = '';
    const chartHost = h('div.fx-chart'); const c = ctx.canvas(chartHost);
    const panel = h('div.fx-panel');
    wrap.append(h('div.fx-left', h('div.fx-tt', steps(3, idx), h('b', `Deney ${idx + 1}: ${E.k}`), h('small', E.note)), chartHost), panel);
    const X = v => 44 + (c.w - 58) * (v - E.min) / (E.max - E.min), Y = r => c.h - 34 - (c.h - 50) * r / 90;
    const draw = () => {
      if (!c.cv.isConnected) return;
      const { x, w, h: H } = c; x.clearRect(0, 0, w, H);
      x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1; for (let i = 0; i <= 4; i++) { const y = Y(i * 22.5); x.beginPath(); x.moveTo(44, y); x.lineTo(w - 14, y); x.stroke(); }
      x.strokeStyle = '#d7efe8'; x.lineWidth = 2; x.beginPath(); x.moveTo(44, 12); x.lineTo(44, H - 34); x.lineTo(w - 10, H - 34); x.stroke();
      x.fillStyle = '#d7efe8'; x.font = '700 11px Nunito,sans-serif'; x.textAlign = 'center';
      for (let i = 0; i <= 5; i++) { const v = E.min + (E.max - E.min) * i / 5; x.fillText(Math.round(v), X(v), H - 19); }
      x.fillText(E.k + (E.u.trim() ? ` (${E.u.trim()})` : ''), w / 2, H - 5);
      x.save(); x.translate(13, H / 2 - 12); x.rotate(-1.5708); x.fillText('Hız (O₂ kabarcığı/dk)', 0, 0); x.restore();
      const sorted = [...pts].sort((a, b) => a.v - b.v);
      if (sorted.length > 1) { x.strokeStyle = '#ffd24c'; x.lineWidth = 3; x.beginPath(); sorted.forEach((p, i) => i ? x.lineTo(X(p.v), Y(p.r)) : x.moveTo(X(p.v), Y(p.r))); x.stroke(); }
      for (const p of sorted) { x.fillStyle = '#fff'; x.beginPath(); x.arc(X(p.v), Y(p.r), 5, 0, 7); x.fill(); x.strokeStyle = '#ffb02e'; x.lineWidth = 2; x.stroke(); }
      if (!tapped) { x.strokeStyle = 'rgba(111,232,255,.6)'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(X(val), 12); x.lineTo(X(val), H - 34); x.stroke(); x.setLineDash([]); }
    };
    ctx.loop(draw);
    function hypo() {
      panel.innerHTML = ''; panel.append(h('div.chip', '1 · Tahmin'), h('h3', `${E.k} artarsa hız nasıl değişir?`));
      SHAPES.forEach((s, i) => panel.append(h('button.fx-sh', { html: `<svg viewBox="0 0 100 62"><path d="M6 4V56H96" class="ax"/><path d="${s.d}" class="cv"/></svg><span>${s.n}</span>`, onclick: () => {
        predicted = i === E.shape; if (predicted) { ctx.good('Tahminin doğru görünüyor. +60'); ctx.add(60); } else { sfx('tick'); ctx.toast('Tahminini kaydettik. Bakalım deney ne diyecek!', 'info'); }
        measure();
      } })));
    }
    function measure() {
      panel.innerHTML = '';
      const vtxt = h('b'), count = h('b.fx-count', '–'); const tankC = h('div.fx-tank'); const tank = ctx.canvas(tankC);
      const input = h('input.slider', { type: 'range', min: E.min, max: E.max, value: val, step: 1, 'aria-label': E.k, style: { '--c': '#ffd24c' }, oninput: e => { val = +e.target.value; vtxt.textContent = val + E.u; } }); vtxt.textContent = val + E.u;
      const uniq = () => new Set(pts.map(p => Math.round(p.v / ((E.max - E.min) / 25)))).size;
      const mbtn = h('button.btn.primary', { html: icon('bubble') + 'Ölç', onclick: () => {
        const r = Math.max(0, E.f(val) + rnd(-1.2, 1.2));
        pts = pts.filter(p => Math.abs(p.v - val) > (E.max - E.min) / 50); pts.push({ v: val, r }); bubbles = r; count.textContent = Math.round(r) + ' kabarcık/dk'; sfx('collect'); ctx.add(8);
        pr.textContent = `Ölçüm: ${pts.length}/5`;
        if (pts.length >= 5) { next.disabled = false; next.classList.add('pulse'); }
      } });
      const pr = h('small', 'Ölçüm: 0/5');
      const next = h('button.btn', { disabled: true, html: icon('chart') + 'Grafiği yorumla', onclick: read });
      panel.append(h('div.chip', '2 · Ölçüm'), tankC, h('div.fx-v', E.k + ': ', vtxt), input, h('div.fx-m', count, pr), h('div.fx-bt', mbtn, next));
      ctx.loop((dt, t) => {
        if (!tank.cv.isConnected) return; const { x, w, h: H } = tank; x.clearRect(0, 0, w, H); x.fillStyle = '#134e4a'; x.fillRect(0, 0, w, H);
        x.fillStyle = '#3fa45b'; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(w / 2 + (i % 2 ? 12 : -12), H - 12 - i * 11, 15, 5, (i % 2 ? -.5 : .5), 0, 7); x.fill(); }
        if (Math.random() < bubbles / 90 * dt * 12) bub.push({ x: w / 2 + rnd(-14, 14), y: H - 18 - rnd(45), r: rnd(1.5, 3.5) });
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.2; for (let i = bub.length - 1; i >= 0; i--) { const b = bub[i]; b.y -= 34 * dt; x.beginPath(); x.arc(b.x, b.y, b.r, 0, 7); x.stroke(); if (b.y < 0) bub.splice(i, 1); }
      });
    }
    function read() {
      panel.innerHTML = ''; tapped = true; let tries = 0;
      panel.append(h('div.chip', '3 · Yorum'), h('h3', 'Grafikte işaretle'), h('p', E.q));
      c.cv.classList.add('tapme');
      const f = e => {
        const r = c.cv.getBoundingClientRect(), v = E.min + (e.clientX - r.left - 44) / (c.w - 58) * (E.max - E.min);
        if (Math.abs(v - E.goal) <= E.tol) {
          c.cv.removeEventListener('pointerdown', f); c.cv.classList.remove('tapme'); ctx.add(Math.max(90, 240 - tries * 50)); ctx.good(); panel.append(h('div.det-why', { html: icon('book', 18) + E.ok }));
          panel.append(h('button.btn.primary', { onclick: () => { idx++; if (idx >= 3) ctx.finish({ success: true, score: ctx.score, note: 'Üç faktörü de deneyle test ettin. Her deneyde yalnızca bir faktörü değiştirdin.' }); else run(); } }, idx < 2 ? 'Sonraki deney' : 'Sonuçlar'));
        } else { tries++; ctx.bad('Eğrinin biçimine tekrar bak.'); ctx.add(-10); }
      };
      c.cv.addEventListener('pointerdown', f);
    }
    hypo();
  }
  run();
}

// BONUS — mağara: kaydırarak canlı ayırma
const ORG = [['Kavak ağacı', 1, 'Kloroplastlı bitki.'], ['Şapkalı mantar', 0, 'Mantarlar hazır organik madde alır.'], ['Siyanobakteri', 1, 'Kloroplastı yoktur ama klorofili vardır.'], ['Nitrit bakterisi', 0, 'Işık yerine kimyasal enerji kullanır: kemosentez.'], ['Öglena', 1, 'Tek hücreli ve kloroplastlıdır.'], ['Amip', 0, 'Besinini dışarıdan alır.'], ['Yosun', 1, 'Fotosentez yapan basit bitki.'], ['Maya', 0, 'Bir mantardır.'], ['Yarasa', 0, 'Omurgalı bir hayvandır.'], ['Deniz marulu', 1, 'Yeşil bir algdir.'], ['Eğrelti otu', 1, 'Damarlı bir bitkidir.'], ['Küf', 0, 'Bir mantardır.'], ['Kırmızı alg', 1, 'Rengi farklı olsa da klorofil içerir.']];
export function magara(ctx) {
  const list = shuffle([...ORG]).slice(0, 10); let i = 0, errs = 0;
  const card = h('div.sw-card'); const wrap = h('div.sw', h('div.sw-lbl', h('span.l', '← Yapar'), h('span.r', 'Yapmaz →')), card,
    h('div.sw-btns', h('button.btn.primary', { onclick: () => ans(1) }, 'Fotosentez yapar'), h('button.btn', { onclick: () => ans(0) }, 'Yapmaz'))); ctx.root.append(wrap);
  ctx.countdown(40, () => ctx.finish({ success: false, score: ctx.score, note: 'Bekçi Totem daha hızlı karar vermeni istiyor.' }));
  ctx.dbg = { cur: () => list[i], ans };
  const show = () => { card.textContent = list[i][0]; card.style.transform = ''; card.classList.remove('sw-in'); void card.offsetWidth; card.classList.add('sw-in'); };
  function ans(a) {
    const [, y, why] = list[i];
    if (a === y) { ctx.add(100); ctx.good(why); } else { errs++; ctx.bad(why); if (errs > 3) return ctx.finish({ success: false, score: ctx.score, note: 'Dört hata: totem gözlerini kapattı.' }); }
    i++; if (i >= list.length) return ctx.finish({ success: true, score: ctx.score, note: 'Bekçi Totem başını eğip seni selamlıyor.' }); show();
  }
  let sx = null; card.onpointerdown = e => { sx = e.clientX; card.setPointerCapture(e.pointerId); };
  card.onpointermove = e => { if (sx !== null) card.style.transform = `translateX(${e.clientX - sx}px) rotate(${(e.clientX - sx) * .05}deg)`; };
  card.onpointerup = e => { if (sx === null) return; const d = e.clientX - sx; sx = null; if (Math.abs(d) > 70) ans(d < 0 ? 1 : 0); else card.style.transform = ''; };
  ctx.on(window, 'keydown', e => { if (e.key === 'ArrowLeft') ans(1); if (e.key === 'ArrowRight') ans(0); });
  show();
}
