import { h, isTouch, clamp } from '../core/dom.js';
import { icon } from './icons.js';
import { sfx, setAudio } from '../core/audio.js';
import { ACHIEVEMENTS, ALL_CARDS, MAIN_GAMES, GAME } from '../core/data.js';
import { save, persist, resetSave, levelInfo, totalScore, starCount, progress, doneCount, isUnlocked, onChange } from '../core/store.js';
import { height, PONDS } from '../world/terrain.js';
import { stars } from '../games/shell.js';
import { OnlineUI } from './online.js';

export class UI {
  constructor(root, app) {
    this.root = root; this.app = app; this.touch = isTouch(); this.panelEl = null; this.dlg = null;
    root.append(
      h('div#boot.boot', h('div.logo', Logo()), h('div.boot-bar', h('i')), h('small', 'Ada yetiştiriliyor…')),
      this.hud = h('div.hud', { hidden: true }),
      this.ctl = h('div.ctl', { hidden: true }),
      h('div#gm-host'),
      this.toasts = h('div.toasts'),
      this.fader = h('div.fader'),
    );
    this.buildHud(); this.buildControls(); this.online = new OnlineUI(this, app);
    onChange(n => n && this.toast(n));
    addEventListener('keydown', e => {
      if (this.app.mode !== 'explore' || this.app.shell?.active && !this.app.mission) return;
      if (e.code === 'Escape') { if (this.dlg) this.closeDialog(); else if (this.panelEl) this.closePanel(); else this.openPanel('quests'); }
      if (e.code === 'KeyE' && this.dlg) { this.closeDialog(); e.stopPropagation(); }
      if (this.dlg || this.app.mission) return;
      if (/^Digit[1-4]$/.test(e.code) && this.app.net?.inRoom && !this.app.shell.active && !this.panelEl) this.app.net.emote(+e.code[5] - 1);
      if (e.code === 'KeyM') this.togglePanel('map'); if (e.code === 'KeyJ' || e.code === 'KeyQ') this.togglePanel('quests'); if (e.code === 'KeyC') this.togglePanel('cards');
    }, true);
  }
  blocked() { return !!(this.dlg || this.panelEl || this.fading || this.online.isOpen || this.online.lostOpen); }

  // --- ANA MENÜ ---
  showMenu() {
    const hasSave = save.started;
    const m = h('div.menu',
      h('div.menu-in',
        h('div.logo.big', Logo()),
        h('p.tag', 'Küçük bir adada büyük bir sır: Enerji Çekirdeği söndü. Fotosentezin sırlarını öğren, adayı yeniden canlandır.'),
        hasSave ? h('div.menu-prog', h('span', `Seviye ${levelInfo().level}`), h('div.bar.green', h('i', { style: { width: progress() + '%' } })), h('span', `%${progress()}`)) : null,
        h('div.menu-btns',
          h('button.btn.primary.big', { html: icon('play') + (hasSave ? 'Maceraya Devam Et' : 'Maceraya Başla'), onclick: () => go() }),
          h('button.btn.online.big', { html: icon('globe') + 'Online Oyna', onclick: () => { sfx('tick'); this.online.open(); } }),
          h('div.menu-sub',
            h('button.btn', { html: icon('hand') + 'Nasıl Oynanır', onclick: () => this.dialog('Nasıl Oynanır', this.touch
              ? 'Sol alttaki joystick: yürü.\nEkranın herhangi bir yerinde parmağını sürükle: bakış açısını çevir.\nYeşil düğme: etkileşim. Sarı düğme: zıpla.\n\nİstasyonlara yürü, mini oyunları oyna, XP kazan. Gözlerini dört aç: adanın gizli köşeleri var!'
              : 'WASD veya oklar: yürü · Shift: koş · Boşluk: zıpla\nSağ tık basılı tutup sürükle: bakış açısı · Tekerlek: yakınlaş\nE: etkileşim\nM: harita · J: görevler · C: koleksiyon · Esc: defter\n\nİstasyonlara yürü, mini oyunları oyna, XP kazan. Gözlerini dört aç: adanın gizli köşeleri var!', 'hand') }),
            h('button.btn', { html: icon('gear') + 'Ayarlar', onclick: () => this.openPanel('settings') }))),
        h('small.menu-foot', 'PC · Tablet · Telefon · İlerlemen bu cihazda otomatik kaydedilir'),
      ));
    const go = () => {
      sfx('good'); this.enterWorld(); this.onStart?.();
      if (!hasSave) setTimeout(() => this.dialog('Hoş geldin, Kâşif!', 'Adanın Enerji Çekirdeği söndü ve bitkiler yardım bekliyor.\n\nParlayan kristalli istasyonlara yürü, oyunları tamamla ve fotosentezin sırlarını öğren. On oyun bitirince Çekirdeği yeniden yakacak büyük görev açılır.\n\nYoldan ayrılmaktan korkma: ada bazı sırlarını yalnızca meraklılara gösterir.', 'leaf'), 700);
    };
    this.root.append(m); this.menu = m;
  }

  enterWorld() {
    if (this.menu) { const m = this.menu; this.menu = null; m.classList.add('out'); setTimeout(() => m.remove(), 500); }
    this.hud.hidden = false; this.setControls(true, true); this.refresh();
  }

  // --- HUD ---
  buildHud() {
    this.hud.append(
      h('div.hud-l',
        h('button.pf', { 'aria-label': 'Kâşif Defteri', onclick: () => this.openPanel('quests') },
          this.ringEl = h('div.ring', h('b', '1')),
          h('div.pf-in', h('span', 'Kâşif'), this.xpEl = h('div.bar.xp', h('i')), this.xpT = h('small', '0 / 150 XP'))),
        this.netPill = h('button.net-pill', { hidden: true, onclick: () => this.openPanel('room') }),
        this.goal = h('button.goal', { onclick: () => this.openPanel('quests') }, this.goalA = h('span.goal-a', { html: icon('up', 16) }), this.goalT = h('span', ''))),
      h('div.hud-r',
        this.scEl = h('div.pill', { html: '' }),
        h('button.round', { html: icon('map'), 'aria-label': 'Harita', onclick: () => this.openPanel('map') }),
        h('button.round', { html: icon('book'), 'aria-label': 'Görevler', onclick: () => this.openPanel('quests') }),
        h('button.round', { html: icon('gear'), 'aria-label': 'Ayarlar', onclick: () => this.openPanel('settings') })),
    );
    if (!this.touch && !save.started) { const hint = h('div.hint', 'WASD yürü · Sağ tık + sürükle: bakış açısı · Boşluk zıpla · E etkileşim · M harita'); this.hud.append(hint); setTimeout(() => hint.remove(), 30000); }
  }
  buildControls() {
    this.promptEl = h('button.prompt', { hidden: true, onclick: () => { this.app.input.act = true; } });
    this.jumpB = h('button.pad.jump', { html: icon('up', 30), 'aria-label': 'Zıpla' });
    this.jumpB.addEventListener('pointerdown', e => { e.preventDefault(); this.app.input.jump = true; });
    this.actB = h('button.pad.act', { html: icon('hand', 30), 'aria-label': 'Etkileşim', onclick: () => { this.app.input.act = true; } });
    this.joy = h('div.joy', { hidden: !this.touch }, this.knob = h('i'));
    this.ctl.append(this.promptEl, this.joy);
    if (this.touch) this.ctl.append(this.jumpB, this.actB);
    this.app.input.onJoy = (k, dx, dy) => { this.knob.style.transform = k === 'move' ? `translate(${dx}px,${dy}px)` : ''; };
    // Joystick köşede sabittir; kontroller gizliyken dokunuşlar kameraya gider
    this.app.input.joyCenter = () => { if (this.ctl.hidden || this.joy.hidden) return null; const r = this.joy.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  }
  setControls(on, jump) { this.ctl.hidden = !on; this.jumpB.hidden = !jump; if (!on) this.promptEl.hidden = true; }
  setInGame(on) { this.hud.hidden = on; if (on) { this.setControls(false); } else { this.setControls(true, true); } }
  prompt(it) {
    const key = it ? it.label() : '';
    if (key === this._pk) return; this._pk = key;
    this.promptEl.hidden = !it; this.actB.classList.toggle('on', !!it);
    if (it) { this.promptEl.innerHTML = `${this.touch ? '' : '<kbd>E</kbd>'}${icon(it.icon || 'hand', 18)}<span>${key}</span>`; sfx('tick'); }
  }
  refresh() {
    const lv = levelInfo();
    this.ringEl.firstChild.textContent = lv.level; this.ringEl.style.setProperty('--p', lv.cur / lv.need * 100);
    this.xpEl.firstChild.style.width = lv.cur / lv.need * 100 + '%'; this.xpT.textContent = `${lv.cur} / ${lv.need} XP`;
    this.scEl.innerHTML = `${icon('bolt', 16)}<b>${totalScore()}</b><span class="d"></span>${icon('star', 16)}<b>${starCount()}</b><span class="d"></span><b>%${progress()}</b>`;
    this.online.refreshPill();
  }
  tick(cam, player, level) {
    if (!this.hud || this.hud.hidden) return;
    if (level.name !== 'world') { this.goal.hidden = true; return; }
    this.goal.hidden = false;
    let best = null, bd = 1e9; const pp = player.pos;
    for (const g of MAIN_GAMES) { if (!isUnlocked(g.need) || save.games[g.id]?.done) continue; const d = Math.hypot(g.pos[0] - pp.x, g.pos[1] - pp.z); if (d < bd) { bd = d; best = g; } }
    if (!best) { this.goalT.textContent = 'Bütün görevler tamam! Gizli köşeleri aradın mı?'; this.goalA.hidden = true; return; }
    this.goalA.hidden = false;
    const a = Math.atan2(best.pos[0] - pp.x, best.pos[1] - pp.z) - cam.yaw + Math.PI;
    this.goalA.style.transform = `rotate(${-a}rad)`;
    const txt = `${best.title} · ${Math.round(bd)} m`; if (txt !== this._gt) { this._gt = txt; this.goalT.textContent = txt; }
  }
  flash(t) { this.toast({ kind: 'info', title: 'Kilitli', text: t, icon: 'lock' }); }
  toast({ kind, title, text, icon: ic }) {
    const t = h('div.toast.' + kind, h('span.t-ic', { html: icon(ic || 'leaf', 24) }), h('div', h('small', { ach: 'BAŞARIM', card: 'YENİ KART', level: 'SEVİYE ATLADIN', info: 'BİLGİ' }[kind]), h('b', title), h('span', text)));
    this.toasts.append(t); if (kind === 'ach' || kind === 'level') sfx('level'); else if (kind === 'card') sfx('collect');
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4300);
  }
  fade(cb) { this.fading = true; this.fader.classList.add('on'); setTimeout(() => { cb(); this.fader.classList.remove('on'); setTimeout(() => { this.fading = false; }, 300); }, 300); }

  // --- DİYALOG ---
  dialog(title, text, ic = 'flask') {
    this.closeDialog();
    this.dlg = h('div.modal.fade', { onclick: e => { if (e.target === this.dlg) this.closeDialog(); } }, h('div.dlg.pop',
      h('div.gm-badge.sm', { html: icon(ic, 30) }), h('h2', title), h('div.dlg-t', ...text.split('\n').map(l => l ? h('p', l) : null)),
      h('button.btn.primary', { html: 'Tamam', onclick: () => this.closeDialog() })));
    this.root.append(this.dlg);
  }
  closeDialog() { if (this.dlg) { this.dlg.remove(); this.dlg = null; this.app.input.clear(); } }

  // --- KÂŞİF DEFTERİ ---
  togglePanel(t) { if (this.panelEl && this.panelTab === t) this.closePanel(); else this.openPanel(t); }
  closePanel() { this.panelEl?.remove(); this.panelEl = null; cancelAnimationFrame(this._mapR); this.app.input.clear(); }
  openPanel(tab) {
    this.closePanel(); sfx('tick'); this.panelTab = tab;
    const TABS = [...(this.app.net?.inRoom ? [['room', 'Oda', 'users']] : []), ['quests', 'Görevler', 'book'], ['map', 'Harita', 'map'], ['cards', 'Koleksiyon', 'card'], ['ach', 'Başarımlar', 'crown'], ['settings', 'Ayarlar', 'gear']];
    const body = h('div.pn-body');
    const p = h('div.modal.fade', h('div.panel.pop',
      h('div.pn-head',
        h('div.pn-title', h('small', 'KÂŞİF DEFTERİ'), h('h2', TABS.find(t => t[0] === tab)[1])),
        h('button.round', { html: icon('close'), 'aria-label': 'Kapat', onclick: () => this.closePanel() })),
      h('div.pn-tabs', ...TABS.map(([id, n, ic]) => h('button' + (id === tab ? '.on' : ''), { html: icon(ic, 18) + `<span>${n}</span>`, onclick: () => this.openPanel(id) }))),
      body));
    p.onclick = e => { if (e.target === p) this.closePanel(); };
    this.root.append(p); this.panelEl = p;
    ({ room: () => this.online.roomPanel(body), quests: () => this.pQuests(body), map: () => this.pMap(body), cards: () => this.pCards(body), ach: () => this.pAch(body), settings: () => this.pSettings(body) })[tab]();
  }
  pQuests(b) {
    b.append(h('div.sum', h('div', h('b', `${doneCount()}/15`), h('small', 'Oyun')), h('div', h('b', totalScore()), h('small', 'Toplam puan')), h('div', h('b', starCount()), h('small', 'Yıldız')), h('div', h('b', `%${progress()}`), h('small', 'İlerleme'))));
    const g = h('div.qgrid');
    MAIN_GAMES.forEach((m, i) => {
      const r = save.games[m.id], open = isUnlocked(m.need);
      g.append(h('div.q' + (open ? '' : '.locked') + (r?.done ? '.done' : ''), { style: { '--c': m.color, animationDelay: i * 25 + 'ms' } },
        h('div.q-ic', { html: icon(open ? m.icon : 'lock', 26) }),
        h('div.q-t', h('small', `${m.region} · ${m.mech}`), h('b', m.title), r ? h('div.q-st', { html: stars(r.stars, 14) + `<em>${r.best} puan</em>` }) : h('span', open ? 'Henüz oynanmadı' : `${m.need} oyun bitirince açılır`)),
        open ? h('button.btn.sm', { html: icon('compass', 16) + 'Işınlan', onclick: () => { this.closePanel(); this.app.teleportTo(m.id); } }) : null));
    });
    b.append(g);
  }
  pMap(b) {
    const cv = h('canvas.map'), name = h('div.map-t', 'Bir istasyona dokunarak ışınlan.'); b.append(h('div.map-w', cv), name);
    const S = 560; cv.width = cv.height = S; const x = cv.getContext('2d'), W = 250, sc = S / W;
    const bg = this._mapBg || (this._mapBg = (() => {
      const c = document.createElement('canvas'), n = 150; c.width = c.height = n; const m = c.getContext('2d'), d = m.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const X = (i / n - .5) * W, Z = (j / n - .5) * W, y = height(X, Z), o = (j * n + i) * 4;
        const [r, g, bl] = y < -.2 ? [46, 150, 170] : y < .9 ? [236, 220, 160] : y > 7 ? [150, 160, 145] : [96 + y * 3, 180 - y * 4, 76];
        d.data[o] = r; d.data[o + 1] = g; d.data[o + 2] = bl; d.data[o + 3] = 255;
      }
      m.putImageData(d, 0, 0); return c;
    })());
    const px = v => (v + W / 2) * sc;
    const draw = () => {
      this._mapR = requestAnimationFrame(draw); x.imageSmoothingEnabled = true; x.drawImage(bg, 0, 0, S, S);
      x.strokeStyle = 'rgba(255,255,255,.12)'; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(i * S / 5, 0); x.lineTo(i * S / 5, S); x.moveTo(0, i * S / 5); x.lineTo(S, i * S / 5); x.stroke(); }
      x.font = '700 15px Fredoka,sans-serif'; x.textAlign = 'center';
      [['ORMAN', -60, 2], ['GÖL', 60, -2], ['LABORATUVAR', 4, 42], ['DEV BİTKİLER', 6, -72], ['MERKEZ', 0, 8]].forEach(([t, a, c]) => { x.fillStyle = 'rgba(12,44,36,.75)'; x.fillText(t, px(a), px(c)); });
      MAIN_GAMES.forEach(m => {
        const open = isUnlocked(m.need), done = save.games[m.id]?.done;
        x.beginPath(); x.arc(px(m.pos[0]), px(m.pos[1]), 11, 0, 7); x.fillStyle = !open ? '#65706c' : done ? '#ffd24c' : m.color; x.fill(); x.lineWidth = 3; x.strokeStyle = '#0d2b25'; x.stroke();
        x.fillStyle = '#0d2b25'; x.font = '800 11px Nunito,sans-serif'; x.fillText(String(MAIN_GAMES.indexOf(m) + 1), px(m.pos[0]), px(m.pos[1]) + 4);
      });
      if (this.app.level === this.app.world) {
        const p = this.app.player, t = performance.now() * .004; x.save(); x.translate(px(p.pos.x), px(p.pos.z)); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(0, 0, 18 + Math.sin(t) * 3, 0, 7); x.fill();
        x.rotate(-p.yaw + Math.PI); x.fillStyle = '#fff'; x.strokeStyle = '#ff5a4d'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 9); x.lineTo(0, 4); x.lineTo(-8, 9); x.closePath(); x.fill(); x.stroke(); x.restore();
      }
    };
    draw();
    const hit = e => { const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * S, my = (e.clientY - r.top) / r.height * S; let b0 = null, bd = 26; for (const m of MAIN_GAMES) { const d = Math.hypot(px(m.pos[0]) - mx, px(m.pos[1]) - my); if (d < bd) { bd = d; b0 = m; } } return b0; };
    cv.onpointermove = e => { const m = hit(e); name.textContent = m ? `${MAIN_GAMES.indexOf(m) + 1}. ${m.title}${isUnlocked(m.need) ? '' : ' (kilitli)'}` : 'Bir istasyona dokunarak ışınlan.'; };
    cv.onclick = e => { const m = hit(e); if (m && this.app.mode === 'explore') { this.closePanel(); this.app.teleportTo(m.id); } };
  }
  pCards(b) {
    b.append(h('div.sum', h('div', h('b', `${save.cards.length}/${ALL_CARDS.length}`), h('small', 'Kart')), h('div', h('b', 'İpucu'), h('small', 'Kartların bir kısmı oyunlardan, bir kısmı adanın gizli köşelerinden çıkar.'))));
    const g = h('div.cgrid');
    ALL_CARDS.forEach((c, i) => { const own = save.cards.includes(c.id);
      g.append(h('div.ccard' + (own ? '.own' : ''), { style: { animationDelay: i * 18 + 'ms' } }, h('div.cc-ic', { html: icon(own ? 'card' : 'lock', 26) }), h('b', own ? c.name : '? ? ?'), h('small', own ? c.fact : 'Henüz bulunmadı.')));
    });
    b.append(g);
  }
  pAch(b) {
    const g = h('div.qgrid');
    ACHIEVEMENTS.forEach((a, i) => { const own = save.ach.includes(a.id), secret = a.secret && !own;
      g.append(h('div.q' + (own ? '.done' : '.locked'), { style: { '--c': '#ffd24c', animationDelay: i * 20 + 'ms' } }, h('div.q-ic', { html: icon(own ? a.icon : 'lock', 26) }), h('div.q-t', h('small', a.secret ? 'GİZLİ BAŞARIM' : 'BAŞARIM'), h('b', secret ? '? ? ?' : a.name), h('span', secret ? 'Bu başarımı keşfederek açarsın.' : a.desc))));
    });
    b.append(h('div.sum', h('div', h('b', `${save.ach.length}/${ACHIEVEMENTS.length}`), h('small', 'Başarım')), h('div', h('b', `Sv. ${levelInfo().level}`), h('small', `${save.xp} toplam XP`))), g);
  }
  pSettings(b) {
    const tg = (n, get, set) => { const el = h('button.tgl' + (get() ? '.on' : ''), { 'aria-label': n, onclick: () => { set(!get()); el.classList.toggle('on', get()); persist(); setAudio(save.sound, save.music); sfx('tick'); } }, h('i')); return h('div.set', h('span', n), el); };
    b.append(
      tg('Ses efektleri', () => save.sound, v => { save.sound = v; }),
      tg('Ortam müziği', () => save.music, v => { save.music = v; }),
      h('div.set', h('span', 'Grafik kalitesi'), h('div.seg', ...[['auto', 'Otomatik'], ['high', 'Yüksek'], ['low', 'Düşük']].map(([k, n]) => h('button' + (save.quality === k ? '.on' : ''), { onclick: () => { save.quality = k; persist(); location.reload(); } }, n)))),
      h('div.set', h('span', 'Tam ekran'), h('button.btn.sm', { onclick: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}) }, 'Aç / Kapat')),
      h('div.set', h('span', 'Ana menüye dön'), h('button.btn.sm', { onclick: () => { this.app.saveNow(); this.app.net?.quit(); location.reload(); } }, 'Çık')),
      h('div.set.danger', h('span', 'İlerlemeyi sıfırla'), h('button.btn.sm', { onclick: e => { if (e.target.dataset.c) resetSave(); else { e.target.dataset.c = 1; e.target.textContent = 'Emin misin? Tekrar dokun'; } } }, 'Sıfırla')),
      h('small.about', 'Photosynthesis World · 3D modeller, görseller ve sesler tamamen kodla üretilmiştir.'),
    );
  }
}

function Logo() {
  const f = document.createDocumentFragment();
  f.append(h('div.logo-m', { html: icon('leaf', 40) }), h('div', h('h1', 'Photosynthesis', h('span', ' World')), h('small', 'BİYOLOJİ OYUNU')));
  return f;
}
