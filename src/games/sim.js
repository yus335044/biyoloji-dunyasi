import { h, clamp, rnd, pick, shuffle, lerp } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';

// 1) FOTOSENTEZ LABORATUVARI — sınırlayıcı faktör simülasyonu
export function lab(ctx) {
  const F = [{ k: 'Işık', ic: 'sun', c: '#ffc93c' }, { k: 'Su', ic: 'drop', c: '#42b4ff' }, { k: 'CO₂', ic: 'co2', c: '#9aa8ff' }];
  const sl = [34, 34, 34], base = [34, 34, 34], baseT = [34, 34, 34];
  let glu = 0, en = 100, rate = 0;
  const vis = h('div.lab-vis'); const c = ctx.canvas(vis);
  const glBar = h('i'), enBar = h('i'), rateTxt = h('b'), evTxt = h('div.lab-ev', 'Hava açık, koşullar normal.');
  const rows = F.map((f, i) => {
    const input = h('input.slider', { type: 'range', min: 0, max: 100, value: sl[i], style: { '--c': f.c }, 'aria-label': f.k + ' desteği', oninput: e => { sl[i] = +e.target.value; } });
    const eff = h('i'), val = h('b');
    const row = h('div.lab-row', h('div.lab-lb', h('span', { html: icon(f.ic, 18), style: { color: f.c } }), f.k, val), input, h('div.lab-eff', eff));
    return { row, eff, val, f };
  });
  ctx.root.append(h('div.lab',
    vis,
    h('div.lab-side',
      evTxt,
      h('div.meter', h('label', 'Glikoz hedefi'), h('div.bar.green', glBar)),
      h('div.meter', h('label', 'Laboratuvar enerjisi'), h('div.bar.amber', enBar)),
      h('div.lab-rate', 'Fotosentez hızı: ', rateTxt),
      ...rows.map(r => r.row))));
  const EV = [
    ['Bulutlar geldi: doğal ışık azaldı!', 0, 8], ['Güneş açtı: doğal ışık bol.', 0, 62],
    ['Kuraklık başladı: toprak suyu azaldı!', 1, 8], ['Yağmur yağdı: su bol.', 1, 62],
    ['Sera kapalı: CO₂ azaldı!', 2, 8], ['Havalandırma açıldı: CO₂ arttı.', 2, 62],
  ];
  let evT = 4;
  const bub = [];
  ctx.countdown(40, () => end());
  function end() {
    const ok = glu >= 100;
    const sc = clamp(glu, 0, 100) * 7 + (ok ? en * 3 : 0);
    ctx.finish({ success: ok, score: sc, note: ok ? `Glikoz hedefine ulaştın; ${Math.round(en)} enerji arttı.` : 'Hedefe ulaşamadın. Kırmızı yanan faktör hızı sınırlıyordu; önce onu desteklemeyi dene.' });
  }
  ctx.loop((dt, t) => {
    evT -= dt;
    if (evT <= 0) { const e = pick(EV); baseT[e[1]] = e[2]; evTxt.textContent = e[0]; evTxt.classList.remove('flash'); void evTxt.offsetWidth; evTxt.classList.add('flash'); sfx('tick'); evT = rnd(4, 7); }
    let eff = F.map((_, i) => { base[i] = lerp(base[i], baseT[i], dt * 1.4); const s = en > 0 ? sl[i] : 0; return clamp(base[i] + s, 0, 100); });
    rate = Math.min(...eff); const lim = eff.indexOf(rate);
    glu += rate / 100 * 4 * dt; en = Math.max(0, en - (sl[0] + sl[1] + sl[2]) * .0185 * dt);
    ctx.score = clamp(glu, 0, 100) * 7;
    glBar.style.width = Math.min(100, glu) + '%'; enBar.style.width = en + '%'; rateTxt.textContent = Math.round(rate) + '%';
    rows.forEach((r, i) => { r.eff.style.width = eff[i] + '%'; r.val.textContent = Math.round(eff[i]) + '%'; r.row.classList.toggle('limit', i === lim && rate < 90); });
    if (glu >= 100 && !ctx.__w) { ctx.__w = 1; ctx.good('Hedef tamam! Enerjini koru, süre bitince bonus alırsın.'); }
    // Görsel: büyüyen bitki ve O₂ kabarcıkları
    const { x, w, h: H } = c; x.clearRect(0, 0, w, H);
    const g = x.createLinearGradient(0, 0, 0, H); const L = eff[0] / 100; g.addColorStop(0, `rgba(${90 + 150 * L},${150 + 90 * L},${190},.9)`); g.addColorStop(1, '#10362e'); x.fillStyle = g; x.fillRect(0, 0, w, H);
    x.fillStyle = `rgba(255,220,100,${.25 + L * .75})`; x.beginPath(); x.arc(w * .82, H * .16, 18 + L * 12, 0, 7); x.fill();
    const cx = w / 2, gy = H * .92, ph = H * (.3 + .35 * Math.min(1, glu / 100));
    x.fillStyle = '#6f4a2b'; x.fillRect(0, gy, w, H - gy);
    x.strokeStyle = '#3d9a4c'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, gy); x.quadraticCurveTo(cx + Math.sin(t) * 6, gy - ph / 2, cx, gy - ph); x.stroke();
    const col = `hsl(${60 + rate * .6},70%,${38 + rate * .15}%)`;
    for (let i = 0; i < 6; i++) { const y = gy - ph * (.3 + i * .13), sd = i % 2 ? 1 : -1, l = 38 - i * 2; x.fillStyle = col; x.beginPath(); x.ellipse(cx + sd * l * .8, y + Math.sin(t * 2 + i) * 2, l * .85, 11, sd * -.45, 0, 7); x.fill(); }
    if (Math.random() < rate / 100 * dt * 9) bub.push({ x: cx + rnd(-40, 40), y: gy - ph * rnd(.3, 1), r: rnd(3, 7) });
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.5; x.font = '700 9px Nunito,sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff';
    for (let i = bub.length - 1; i >= 0; i--) { const b = bub[i]; b.y -= 42 * dt; b.x += Math.sin(t * 3 + i) * .4; x.beginPath(); x.arc(b.x, b.y, b.r + 4, 0, 7); x.stroke(); x.fillText('O₂', b.x, b.y + 3); if (b.y < -12) bub.splice(i, 1); }
  });
}

// 3) IŞIK AVCISI — renkleri ayıran yakalama oyunu
export function isik(ctx) {
  const c = ctx.canvas();
  let px = .5, energy = 0, pairs = 0, combo = 0, spawn = 0, T = 0, target = .5; const items = []; const fx = [];
  const set = e => { const r = c.cv.getBoundingClientRect(); target = clamp((e.clientX - r.left) / r.width, .05, .95); };
  ctx.on(c.cv, 'pointerdown', set); ctx.on(c.cv, 'pointermove', e => { if (e.pressure > 0 || e.pointerType === 'mouse') set(e); });
  const GOAL = 4;
  ctx.countdown(40, () => ctx.finish({ success: pairs >= GOAL, score: ctx.score, note: pairs >= GOAL ? `${pairs} ATP + NADPH ürettin.` : `Hedef ${GOAL} çift ATP + NADPH idi, ${pairs} ürettin. Kırmızı ve mavi ışığa odaklan.` }));
  ctx.dbg = { items, aim: v => { target = v; } };
  const K = { r: ['#ff5a4d', 'Kırmızı'], b: ['#5a8bff', 'Mavi'], g: ['#58e070', 'Yeşil'] };
  ctx.loop((dt, t) => {
    T += dt; const keys = ctx.input.keys, spd = dt * 1.3;
    if (keys.KeyA || keys.ArrowLeft) target = clamp(target - spd, .05, .95); if (keys.KeyD || keys.ArrowRight) target = clamp(target + spd, .05, .95);
    px = lerp(px, target, 1 - Math.exp(-dt * 16));
    const { x, w, h: H } = c, py = H - 62, lw = Math.min(70, w * .14);
    spawn -= dt;
    if (spawn <= 0) { spawn = Math.max(.22, .58 - T * .008); const r = Math.random(); items.push({ k: r < .36 ? 'r' : r < .72 ? 'b' : 'g', x: rnd(.04, .96) * w, y: -14, v: rnd(135, 195) + T * 3, ph: rnd(6) }); }
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c2a4a'); g.addColorStop(.7, '#124c44'); g.addColorStop(1, '#1d6b4a'); x.fillStyle = g; x.fillRect(0, 0, w, H);
    x.fillStyle = 'rgba(255,214,90,.12)'; x.beginPath(); x.moveTo(w * .5 - 40, 0); x.lineTo(w * .5 + 40, 0); x.lineTo(w, H); x.lineTo(0, H); x.fill();
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i]; p.y += p.v * dt;
      x.strokeStyle = K[p.k][0]; x.lineWidth = 3; x.beginPath(); for (let k = 0; k <= 10; k++) { const yy = p.y - k * 3.6, xx = p.x + Math.sin(k * .9 + p.ph + t * 8) * 5; k ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke();
      x.fillStyle = K[p.k][0]; x.shadowColor = K[p.k][0]; x.shadowBlur = 14; x.beginPath(); x.arc(p.x, p.y, 9, 0, 7); x.fill(); x.shadowBlur = 0;
      if (p.y > py - 12 && p.y < py + 20 && Math.abs(p.x - px * w) < lw + 8) {
        items.splice(i, 1);
        if (p.k === 'g') { combo = 0; energy = Math.max(0, energy - 14); ctx.bad('Yeşil ışık büyük oranda yansır, enerji kazandırmaz!'); fx.push({ x: p.x, y: py, t: 1, s: '-enerji', c: '#ff8a8a' }); }
        else { combo++; energy += 10 + Math.min(combo, 5); ctx.add(12 + Math.min(combo, 8)); sfx('collect'); fx.push({ x: p.x, y: py, t: 1, s: combo > 2 ? `x${combo}` : '+e⁻', c: K[p.k][0] }); }
        if (energy >= 100) { energy -= 100; pairs++; ctx.add(60); sfx('level'); ctx.toast(`ATP + NADPH üretildi (${pairs}/${GOAL})`, 'good'); }
      } else if (p.y > H + 20) items.splice(i, 1);
    }
    // Klorofil yaprağı
    const lx = px * w; x.fillStyle = '#4fbf4a'; x.beginPath(); x.ellipse(lx, py + 6, lw, 22, 0, 0, 7); x.fill();
    x.strokeStyle = '#2b7f3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(lx - lw, py + 6); x.lineTo(lx + lw, py + 6); for (let i = -2; i <= 2; i++) { x.moveTo(lx + i * lw * .35, py + 6); x.lineTo(lx + i * lw * .35 + 12, py - 8); } x.stroke();
    // Enerji çubuğu
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.roundRect(14, H - 22, w - 28, 12, 6); x.fill();
    const eg = x.createLinearGradient(14, 0, w - 14, 0); eg.addColorStop(0, '#5a8bff'); eg.addColorStop(1, '#ff5a4d'); x.fillStyle = eg; x.beginPath(); x.roundRect(14, H - 22, (w - 28) * energy / 100, 12, 6); x.fill();
    x.fillStyle = '#fff'; x.font = '800 14px Nunito,sans-serif'; x.textAlign = 'left'; x.fillText(`ATP + NADPH  ${pairs}/${GOAL}`, 16, 28);
    x.textAlign = 'center';
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t -= dt * 1.6; x.globalAlpha = Math.max(0, f.t); x.fillStyle = f.c; x.fillText(f.s, f.x, f.y - (1 - f.t) * 44); x.globalAlpha = 1; if (f.t <= 0) fx.splice(i, 1); }
  });
}

// 4) KARBON AVCILARI — stoma aç/kapa zamanlama oyunu
export function karbon(ctx) {
  const c = ctx.canvas();
  let water = 100, got = 0, spawn = 0, gust = 0, gustT = 9, T = 0, wasted = 0; const GOAL = 18;
  const st = []; const mols = []; ctx.dbg = { st, mols };
  const layout = () => { const { w, h: H } = c, n = w < 520 ? 4 : 5; if (st.length !== n) { st.length = 0; for (let i = 0; i < n; i++) st.push({ i, open: false, a: 0 }); } st.forEach((s, i) => { s.x = w * (i + .5) / n; s.y = H * (i % 2 ? .73 : .63); }); };
  ctx.on(c.cv, 'pointerdown', e => {
    const r = c.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; layout();
    let best = null, bd = 1e9; st.forEach(s => { const d = Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; best = s; } });
    if (best && bd < 90) { best.open = !best.open; sfx('tick'); }
  });
  ctx.on(window, 'keydown', e => { const n = +e.key - 1; if (st[n]) { st[n].open = !st[n].open; sfx('tick'); } });
  const finish = ok => ctx.finish({ success: ok, score: ctx.score + (ok ? water * 3 : 0), note: ok ? `${got} CO₂ aldın, %${Math.round(water)} su korudun.` : water <= 0 ? 'Yaprak suyunu kaybetti! Bitkiler su kaybını azaltmak için stomalarını kapatır.' : `Hedef ${GOAL} CO₂ idi, ${got} aldın.` });
  ctx.countdown(45, () => finish(got >= GOAL));
  ctx.loop((dt, t) => {
    T += dt; layout(); const { x, w, h: H } = c;
    spawn -= dt;
    if (spawn <= 0) { spawn = Math.max(.55, 1.15 - T * .012); const s = pick(st); mols.push({ s, x: s.x + rnd(-30, 30), y: -20, v: rnd(70, 95) + T * .8, rot: rnd(6), o2: Math.random() < .18 }); }
    gustT -= dt; if (gustT <= 0) { gust = 4; gustT = rnd(9, 13); ctx.toast('Sıcak rüzgâr! Stomaları kapat: su kaybı üç kat.', 'bad'); sfx('bad'); }
    gust = Math.max(0, gust - dt);
    const open = st.filter(s => s.open).length, loss = open * 1.6 * (gust > 0 ? 3 : 1);
    water = clamp(water + (open ? -loss : 3.4) * dt, 0, 100);
    if (water <= 0) return finish(false);
    // Arka plan
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, gust > 0 ? '#c56a3c' : '#6fc6e8'); g.addColorStop(.48, gust > 0 ? '#e8ad6b' : '#c4ecd8'); g.addColorStop(.5, '#4fae48'); g.addColorStop(1, '#2d7f3e'); x.fillStyle = g; x.fillRect(0, 0, w, H);
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 9; i++) x.fillRect(0, H * .5 + i * H * .06, w, 1.5);
    // Moleküller
    for (let i = mols.length - 1; i >= 0; i--) {
      const m = mols[i]; m.y += m.v * dt; m.rot += dt; const s = m.s, near = Math.abs(m.y - s.y) < 34;
      if (near && s.open && !m.o2) { mols.splice(i, 1); got++; ctx.add(40); sfx('collect'); ctx.toast(`CO₂ içeride: ${got}/${GOAL}`, 'good', 700); if (got >= GOAL) return finish(true); continue; }
      if (m.y > s.y + 8) { if (!m.o2) wasted++; mols.splice(i, 1); continue; }
      molecule(x, m.x + (s.x - m.x) * clamp(m.y / s.y) * .9, m.y, m.rot, m.o2);
    }
    // Stomalar
    st.forEach((s, i) => {
      s.a = lerp(s.a, s.open ? 1 : 0, 1 - Math.exp(-dt * 14));
      x.fillStyle = s.open ? '#0c3d22' : '#2d7f3e'; x.beginPath(); x.ellipse(s.x, s.y, 13 + s.a * 15, 36, 0, 0, 7); x.fill();
      for (const sd of [-1, 1]) { x.fillStyle = '#b6ef4f'; x.strokeStyle = '#2b7f3a'; x.lineWidth = 2; x.beginPath(); x.ellipse(s.x + sd * (15 + s.a * 15), s.y, 15, 40, sd * -.08, 0, 7); x.fill(); x.stroke(); }
      x.fillStyle = '#fff'; x.font = '800 12px Nunito,sans-serif'; x.textAlign = 'center'; x.fillText(s.open ? 'AÇIK' : 'KAPALI', s.x, s.y + 60);
    });
    // Su göstergesi
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.roundRect(14, 14, Math.min(220, w * .5), 16, 8); x.fill();
    x.fillStyle = water < 30 ? '#ff6b5a' : '#42b4ff'; x.beginPath(); x.roundRect(14, 14, Math.min(220, w * .5) * water / 100, 16, 8); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.font = '800 12px Nunito,sans-serif'; x.fillText('Yaprak suyu', 20, 26);
    x.textAlign = 'right'; x.font = '800 15px Nunito,sans-serif'; x.fillText(`CO₂ ${got}/${GOAL}`, w - 14, 28);
  });
}
function molecule(x, px, py, rot, o2) {
  const dx = Math.cos(rot) * 15, dy = Math.sin(rot) * 15;
  x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.9)';
  if (o2) { for (const s of [-.5, .5]) { x.fillStyle = '#ff6d62'; x.beginPath(); x.arc(px + dx * s, py + dy * s, 8, 0, 7); x.fill(); x.stroke(); } return; }
  for (const s of [-1, 1]) { x.fillStyle = '#ff6d62'; x.beginPath(); x.arc(px + dx * s, py + dy * s, 7.5, 0, 7); x.fill(); x.stroke(); }
  x.fillStyle = '#28323c'; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); x.stroke();
}

// 6) OKSİJEN FABRİKASI — Hill gözlemi + fotoliz ayıklama bandı
export function oksijen(ctx) {
  const R = ctx.root; let errors = 0;
  // Aşama 1
  const opts = [{ t: 'Su (H₂O)', ok: true, r: 'Doğru! Işık enerjisiyle su parçalanır; buna fotoliz denir.' }, { t: 'Karbondioksit (CO₂)', ok: false, r: 'Gözlemde CO₂ yoktu; oksijen CO₂’den gelmiş olamaz.' }, { t: 'Glikoz', ok: false, r: 'Glikoz fotosentezin ürünüdür, oksijenin kaynağı değildir.' }];
  const box = h('div.ox-exp', h('div.chip', 'Bilim Tarihi · Robert Hill'), h('h3', 'Oksijen nereden geliyor?'), h('p', 'Hill, ışıkta bekleyen kloroplastların CO₂ olmadan da oksijen çıkardığını gözlemledi. Oksijen hangi maddeden gelmiş olabilir?'));
  const row = h('div.ox-choices'); box.append(row); R.append(box);
  shuffle(opts).forEach(o => row.append(h('button.tile', { onclick: () => {
    if (o.ok) { ctx.good(); ctx.add(150 - errors * 60); box.remove(); stage2(o.r); }
    else { errors++; ctx.bad(o.r); }
  } }, h('b', o.t))));
  function stage2(msg) {
    ctx.toast(msg, 'good', 3600);
    const area = h('div.ox-belt'); R.append(area);
    const c = ctx.canvas(area);
    const T = { O: { s: 'O₂', c: '#ff8a7a', n: 'Atmosfere' }, H: { s: 'H⁺', c: '#ffd24c', n: 'Tilakoide' }, E: { s: 'e⁻', c: '#6fd2ff', n: 'Taşıma sistemine' } };
    const order = ['O', 'H', 'E'];
    let q = []; for (let i = 0; i < 4; i++) q.push(...shuffle(['O', 'H', 'H', 'H', 'H', 'E', 'E', 'E', 'E'])); q = q.slice(0, 27);
    const total = q.length; let good = 0, belt = [], next = .5, speed = 78, o2 = 0;
    const sendTo = k => {
      const p = belt[0]; if (!p) return; belt.shift();
      if (p.k === k) { good++; ctx.add(850 / total); sfx('collect'); fxs.push({ x: p.x, y: p.y, k, t: 0 }); if (k === 'O') { o2++; } }
      else { errors++; ctx.bad(`${T[p.k].s} → ${T[p.k].n} gitmeliydi.`); if (errors >= 7) over(); }
      speed += 1.6;
    };
    const fxs = []; ctx.dbg = { head: () => belt[0], send: sendTo };
    const btns = h('div.ox-btns', ...order.map((k, i) => h('button.bin', { style: { '--c': T[k].c }, onclick: () => sendTo(k) }, h('b', T[k].s), h('small', `${i + 1} · ${T[k].n}`))));
    area.append(btns);
    ctx.on(window, 'keydown', e => { const n = +e.key - 1; if (order[n]) sendTo(order[n]); });
    const over = () => ctx.finish({ success: false, score: ctx.score, note: 'Çok fazla hatalı yönlendirme oldu. Unutma: su parçalanınca O₂, H⁺ ve elektron oluşur.' });
    ctx.loop((dt, t) => {
      const { x, w, h: H } = c, sensorX = w * .82, by = H * .55;
      next -= dt;
      if (next <= 0 && q.length) { belt.push({ k: q.shift(), x: -30, y: by }); next = Math.max(.75, 1.28 - (total - q.length) * .012); }
      if (!q.length && !belt.length) { ctx.finish({ success: true, score: ctx.score, note: `${o2} O₂ molekülü atmosfere verdin. Toplam ${good}/${total} parçacık doğru hatta gitti.` }); return; }
      x.clearRect(0, 0, w, H); x.fillStyle = '#123a33'; x.fillRect(0, 0, w, H);
      // Fotoliz makinesi + bant
      x.fillStyle = '#245c52'; x.fillRect(0, by + 22, w, 12);
      for (let i = 0; i < w / 24 + 1; i++) { x.fillStyle = '#3a7d6e'; x.fillRect(((i * 24 + t * speed) % (w + 24)) - 24, by + 25, 12, 6); }
      x.fillStyle = 'rgba(255,214,90,.2)'; x.fillRect(sensorX - 34, by - 40, 68, 74); x.strokeStyle = '#ffd24c'; x.lineWidth = 2; x.strokeRect(sensorX - 34, by - 40, 68, 74);
      x.fillStyle = '#ffd24c'; x.font = '800 12px Nunito,sans-serif'; x.textAlign = 'center'; x.fillText('SENSÖR', sensorX, by - 48);
      x.fillStyle = '#d7efe8'; x.font = '800 13px Nunito,sans-serif'; x.fillText('Fotoliz: su → O₂ + H⁺ + e⁻', w / 2, 24);
      for (let i = belt.length - 1; i >= 0; i--) {
        const p = belt[i]; p.x += speed * dt;
        x.fillStyle = T[p.k].c; x.beginPath(); x.arc(p.x, p.y, 20, 0, 7); x.fill(); x.strokeStyle = i === 0 ? '#fff' : 'rgba(255,255,255,.3)'; x.lineWidth = i === 0 ? 4 : 2; x.stroke();
        x.fillStyle = '#16302c'; x.font = '800 16px Fredoka,sans-serif'; x.fillText(T[p.k].s, p.x, p.y + 6);
        if (p.x > sensorX + 36) { belt.splice(i, 1); errors++; ctx.bad(`Geç kaldın: ${T[p.k].s} kayboldu.`); if (errors >= 7) return over(); }
      }
      for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; f.t += dt * 2.2; x.globalAlpha = 1 - f.t; x.fillStyle = T[f.k].c; x.beginPath(); x.arc(f.x, f.y - f.t * 80, 16, 0, 7); x.fill(); x.globalAlpha = 1; if (f.t >= 1) fxs.splice(i, 1); }
      x.fillStyle = '#fff'; x.textAlign = 'left'; x.font = '800 13px Nunito,sans-serif'; x.fillText(`Hata: ${errors}/7`, 12, H - 12); x.textAlign = 'right'; x.fillText(`O₂: ${o2}`, w - 12, H - 12);
    });
  }
}
