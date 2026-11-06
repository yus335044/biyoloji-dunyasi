// Online Oyna ekranları: oda listesi, oda kurma, kodla katılma, lobi, bağlantı durumu ve oda paneli.
import { h } from '../core/dom.js';
import { icon } from './icons.js';
import { sfx } from '../core/audio.js';
import { stars } from '../games/shell.js';
import { GAME } from '../core/data.js';

const NAME_KEY = 'pw-name';
const EMOTES = ['👋', '👏', '🎉', '🌱'];
const STATUS = { off: ['Bağlı değil', 'off'], connecting: ['Bağlanıyor…', 'wait'], online: ['Bağlı', 'on'], retry: ['Yeniden bağlanıyor…', 'wait'], fail: ['Bağlantı yok', 'off'] };

export class OnlineUI {
  constructor(ui, app) {
    this.ui = ui; this.app = app; this.el = null; this.tab = 'list'; this.lostOpen = false;
    this.banner = h('div.net-banner', { hidden: true }); ui.root.append(this.banner);
    this.emoBar = h('div.emo', { hidden: true }, ...EMOTES.map((e, i) => h('button', { 'aria-label': `İfade ${e}`, onclick: () => { this.app.net.emote(i); sfx('tick'); } }, e)));
    ui.ctl.append(this.emoBar);
  }
  get net() { return this.app.net; }
  get isOpen() { return !!this.el; }
  name() { let v = this.nameEl?.value; if (v === undefined) try { v = localStorage.getItem(NAME_KEY); } catch { v = ''; } return (v || '').trim(); }
  nameOk() {
    const n = this.name(); if (n.length >= 2) { try { localStorage.setItem(NAME_KEY, n); } catch { /* */ } return true; }
    this.error({ msg: 'Önce en az 2 harfli bir isim yaz.' }); this.nameEl?.focus(); return false;
  }

  open(code) {
    if (!this.net.canOnline) { this.ui.dialog('Online Oyna', 'Online oynamak için oyunu bağlantısından açmalısın. Bu tek dosyalık sürüm yalnızca tek kişilik çalışır.', 'globe'); return; }
    if (this.el) return;
    this.el = h('div.modal.fade', h('div.panel.ol.pop', this.body = h('div.ol-in')));
    this.ui.root.append(this.el);
    this.pendingCode = code || null; if (code) this.tab = 'join';
    this.net.room ? this.showLobby() : this.showBrowse();
    this.net.connect();
    if (this.net.ws?.readyState === 1) this.net.send({ t: 'list' });
  }
  close(keep) {
    if (!this.el) return;
    this.el.remove(); this.el = null; this.nameEl = undefined; this.mode = null; this.errEl = null; this.statusEl = null;
    if (!keep && this.net.room) this.net.leave();
  }
  head(title, sub, onBack) {
    return h('div.pn-head',
      h('div.pn-title', h('small', sub), h('h2', title)),
      h('div.ol-hr', this.statusEl = h('div.net-st'), h('button.round', { html: icon(onBack ? 'back' : 'close'), 'aria-label': 'Kapat', onclick: onBack || (() => this.close()) })));
  }
  statusChanged() {
    if (this.statusEl) { const [t, c] = STATUS[this.net.status]; this.statusEl.className = 'net-st ' + c; this.statusEl.innerHTML = `<i></i>${t}${this.net.status === 'fail' ? ' · ' : ''}`; if (this.net.status === 'fail') this.statusEl.append(h('button.lnk', { onclick: () => this.net.retryNow() }, 'Tekrar dene')); }
    const s = this.net.status, show = this.net.entered && s === 'retry';
    this.banner.hidden = !show; if (show) this.banner.textContent = 'Bağlantı koptu · yeniden bağlanılıyor…';
    if (s === 'online' && this.lostOpen) this.dismissLost();
    this.refreshPill();
    if (s === 'online' && this.el && !this.net.room) this.net.send({ t: 'list' });
  }
  showBrowse() {
    if (!this.el) return;
    this.mode = 'browse'; this.body.innerHTML = '';
    const saved = this.name();
    this.nameEl = h('input.inp', { value: saved, maxLength: 16, placeholder: 'Oyuncu adın', autocomplete: 'off', 'aria-label': 'Oyuncu adı' });
    const tabs = [['list', 'Açık Odalar', 'users'], ['create', 'Oda Oluştur', 'plant'], ['join', 'Kodla Katıl', 'lock']];
    this.errEl = h('div.ol-err', { hidden: true });
    const pane = h('div.ol-pane');
    const tb = h('div.pn-tabs', ...tabs.map(([id, n, ic]) => h('button' + (id === this.tab ? '.on' : ''), { html: icon(ic, 18) + `<span>${n}</span>`, onclick: () => { this.tab = id; this.showBrowse(); } })));
    this.body.append(this.head('Online Oyna', 'ÇOK OYUNCULU'), h('div.ol-name', h('label', 'Oyuncu adın'), this.nameEl), tb, this.errEl, pane);
    this.statusChanged();
    if (this.tab === 'list') { this.listEl = pane; this.roomsChanged(); }
    if (this.tab === 'create') this.createPane(pane);
    if (this.tab === 'join') this.joinPane(pane);
  }
  roomsChanged() {
    if (!this.el || this.mode !== 'browse' || this.tab !== 'list' || !this.listEl) return;
    const rs = this.net.rooms; this.listEl.innerHTML = '';
    if (!rs.length) { this.listEl.append(h('div.ol-empty', { html: icon('users', 34) }, h('b', 'Henüz açık oda yok'), h('span', 'İlk odayı sen kur, arkadaşların katılsın.'), h('button.btn.primary', { onclick: () => { this.tab = 'create'; this.showBrowse(); } }, 'Oda Oluştur'))); return; }
    for (const r of rs) this.listEl.append(h('div.ol-row', h('div.ol-rt', h('b', r.name), h('small', `${r.started ? 'Oyun sürüyor' : 'Lobide bekliyor'} · ${r.n}/${r.cap} oyuncu`)), h('button.btn.sm', { onclick: () => { if (this.nameOk()) this.net.join(r.code); } }, 'Katıl')));
  }
  createPane(p) {
    const name = h('input.inp', { maxLength: 16, placeholder: 'Oda adı (ör. 10-A Biyoloji)', 'aria-label': 'Oda adı' });
    const capV = h('b', '12'), cap = h('input.slider', { type: 'range', min: 2, max: 30, value: 12, style: { '--c': '#a4ff5c' }, 'aria-label': 'Oyuncu kapasitesi', oninput: e => { capV.textContent = e.target.value; } });
    let priv = false; const tg = h('button.tgl', { 'aria-label': 'Özel oda', onclick: () => { priv = !priv; tg.classList.toggle('on', priv); } }, h('i'));
    p.append(h('label.ol-f', 'Oda adı', name), h('div.ol-f', h('div.ol-cap', 'Oyuncu kapasitesi', capV), cap),
      h('div.set', h('span', h('b', 'Özel oda'), h('small.ol-hint', 'Listede görünmez, yalnızca kodla katılınır')), tg),
      h('button.btn.primary.big', { html: icon('play') + 'Odayı Kur', onclick: () => { if (this.nameOk()) this.net.create({ name: name.value, cap: +cap.value, priv }); } }));
  }
  joinPane(p) {
    const code = h('input.inp.code', { maxLength: 5, placeholder: 'KOD', value: this.pendingCode || '', autocapitalize: 'characters', autocomplete: 'off', 'aria-label': 'Oda kodu', oninput: e => { e.target.value = e.target.value.toUpperCase(); } });
    const go = () => { if (code.value.length !== 5) return this.error({ msg: 'Oda kodu 5 karakterlidir.' }); if (this.nameOk()) this.net.join(code.value); };
    code.onkeydown = e => { if (e.key === 'Enter') go(); };
    p.append(h('label.ol-f', 'Oda kodu', code), h('button.btn.primary.big', { html: icon('play') + 'Odaya Katıl', onclick: go }));
  }
  showLobby() {
    if (!this.el) { this.el = h('div.modal.fade', h('div.panel.ol.pop', this.body = h('div.ol-in'))); this.ui.root.append(this.el); }
    if (this.mode === 'lobby') { this.roomChanged(); return; }
    this.mode = 'lobby'; this.body.innerHTML = ''; this.nameEl = undefined;
    this.lobby = h('div.ol-pane'); this.errEl = h('div.ol-err', { hidden: true });
    this.body.append(this.head('Lobi', 'ÇOK OYUNCULU', () => { this.net.leave(); }), this.errEl, this.lobby);
    this.statusChanged(); this.roomChanged();
  }
  roomChanged() {
    const r = this.net.room; if (!r) return;
    this.refreshPill();
    if (this.ui.panelEl && this.ui.panelTab === 'room' && this.panelBody) { this.panelBody.innerHTML = ''; this.roomPanel(this.panelBody); }
    if (!this.el || this.mode !== 'lobby') return;
    const me = r.players.find(p => p.id === this.net.id), isHost = r.host === this.net.id;
    const others = r.players.filter(p => p.id !== r.host), waiting = others.filter(p => !p.ready).length;
    const link = `${location.origin}${location.pathname}?oda=${r.code}`;
    const copy = (t, el) => {
      const done = () => { el.classList.add('ok'); setTimeout(() => el.classList.remove('ok'), 1200); };
      // Wi-Fi'daki http adresinde pano arayüzü kapalıdır; eski yöntemle kopyalanır
      const legacy = () => { const f = h('textarea', { value: t, style: { position: 'fixed', opacity: 0 } }); document.body.append(f); f.select(); const ok = document.execCommand('copy'); f.remove(); if (ok) done(); else this.error({ msg: `Kopyalanamadı: ${t}` }); };
      navigator.clipboard ? navigator.clipboard.writeText(t).then(done, legacy) : legacy();
    };
    this.lobby.innerHTML = '';
    this.lobby.append(
      h('div.lb-code', h('div', h('small', r.priv ? 'ÖZEL ODA KODU' : 'ODA KODU'), h('b', r.code), h('span', r.name)),
        h('div.lb-cp', h('button.btn.sm', { html: icon('copy', 16) + 'Kodu kopyala', onclick: e => copy(r.code, e.currentTarget) }), h('button.btn.sm', { html: icon('copy', 16) + 'Davet linki', onclick: e => copy(link, e.currentTarget) }))),
      h('div.lb-n', { html: icon('users', 18) + `<b>${r.players.length}</b> / ${r.cap} oyuncu` }),
      h('div.lb-list', ...r.players.map(p => h('div.lb-p' + (p.online ? '' : '.off'),
        h('i.lb-av', p.name[0].toUpperCase()),
        h('div.lb-t', h('b', p.name + (p.id === this.net.id ? ' (sen)' : '')), h('small', !p.online ? 'bağlantı koptu' : p.id === r.host ? 'Oda sahibi' : 'Oyuncu')),
        p.id === r.host ? h('span.lb-c', { html: icon('crown', 18), title: 'Oda sahibi' }) : h('span.chip' + (p.ready ? '' : '.no'), p.ready ? 'Hazır' : 'Hazır değil')))),
      h('div.lb-act',
        isHost
          ? h('button.btn.primary.big', { disabled: waiting > 0, html: icon('play') + (waiting ? `${waiting} oyuncu bekleniyor` : 'Oyunu Başlat'), onclick: () => this.net.start() })
          : h('button.btn.big' + (me?.ready ? '' : '.primary'), { onclick: () => { this.net.ready(!me?.ready); sfx('tick'); } }, me?.ready ? 'Hazırım · vazgeç' : 'Hazırım'),
        h('button.btn', { html: icon('back') + 'Odadan Ayrıl', onclick: () => this.net.leave() })));
  }
  error(m) {
    if (['result', 'locked'].includes(m.code)) return;   // Oyun içinde akışı bölmez; puan sayılmaz
    sfx('bad');
    if (this.errEl && this.el) { this.errEl.hidden = false; this.errEl.textContent = m.msg; clearTimeout(this.errT); this.errT = setTimeout(() => { if (this.errEl) this.errEl.hidden = true; }, 4500); }
  }
  eventToast(m) {
    const ic = { join: 'users', leave: 'users', host: 'crown', game: 'star', core: 'sun' }[m.kind] || 'globe';
    const t = h('div.net-ev' + (m.kind === 'core' ? '.core' : ''), { html: icon(ic, 16) }); t.append(h('span', m.text));
    this.feed().append(t); while (this.feedEl.children.length > 4) this.feedEl.firstChild.remove();
    setTimeout(() => t.remove(), 5000);
  }
  feed() { if (!this.feedEl) { this.feedEl = h('div.net-feed'); this.ui.root.append(this.feedEl); } return this.feedEl; }
  refreshPill() {
    const pill = this.ui.netPill; if (!pill) return;
    const n = this.net, r = n?.room, on = !!r && n.entered; pill.hidden = !on; this.emoBar.hidden = !on;
    if (!on) return;
    const [, c] = STATUS[n.status];
    pill.innerHTML = `<i class="dot ${c}"></i>${icon('users', 15)}<b>${r.players.filter(p => p.online).length}/${r.cap}</b>${n.status === 'online' && n.latency ? `<span>${n.latency} ms</span>` : ''}<span class="cd">${r.code}</span>`;
  }
  roomPanel(b) {
    this.panelBody = b; const r = this.net.room; if (!r) return;
    const rows = [...r.players].sort((a, c) => c.score - a.score);
    b.append(h('div.sum', h('div', h('b', r.code), h('small', r.name)), h('div', h('b', `${r.players.length}/${r.cap}`), h('small', 'Oyuncu')), h('div', h('b', `${this.net.latency || '–'} ms`), h('small', 'Gecikme'))));
    b.append(h('div.lb-list', ...rows.map((p, i) => h('div.lb-p' + (p.online ? '' : '.off') + (p.id === this.net.id ? '.me' : ''),
      h('i.lb-av', String(i + 1)),
      h('div.lb-t', h('b', p.name + (p.id === this.net.id ? ' (sen)' : '')), h('small', !p.online ? 'bağlantı koptu' : p.busy ? `Oynuyor: ${GAME[p.busy]?.title || ''}` : `${p.done} oyun tamamladı`)),
      p.id === r.host ? h('span.lb-c', { html: icon('crown', 16) }) : null,
      h('div.lb-sc', h('b', String(p.score)), h('small', { html: `${icon('star', 11)} ${p.stars}` }))))));
    b.append(h('small.about', 'Puan tablosu, bu odada kazanılan en iyi puanları gösterir. XP, kart ve başarımlar kendi cihazında kalır.'),
      h('button.btn', { html: icon('back') + 'Odadan Ayrıl', onclick: () => { this.net.quit(); location.reload(); } }));
  }
  lost(msg, canRetry) {
    if (this.lostOpen) return; this.lostOpen = true; this.banner.hidden = true;
    this.lostEl = h('div.modal.fade.top', h('div.dlg.pop',
      h('div.gm-badge.sm', { html: icon('globe', 30) }), h('h2', 'Bağlantı kesildi'), h('div.dlg-t', h('p', msg)),
      h('div.res-btns', canRetry ? h('button.btn.primary', { onclick: () => { this.dismissLost(); this.net.retryNow(); } }, 'Tekrar Dene') : null,
        h('button.btn', { onclick: () => { this.net.quit(); location.href = location.pathname; } }, 'Ana Menüye Dön'))));
    this.ui.root.append(this.lostEl);
  }
  dismissLost() { this.lostEl?.remove(); this.lostEl = null; this.lostOpen = false; }
}
