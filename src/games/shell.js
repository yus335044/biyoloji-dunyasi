import { h } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../core/audio.js';
import { recordGame, save } from '../core/store.js';

/** Her mini oyunun ortak kabuğu: başlangıç ekranı, üst şerit, sonuç ve tekrar oynama. */
export class Shell {
  constructor(host, app, games) { this.host = host; this.app = app; this.games = games; this.cur = null; }
  get active() { return !!this.cur; }

  open(meta) {
    this.close(true);
    const el = h('div.gm.fade', { style: { '--c': meta.color } });
    this.host.append(el); this.el = el; this.meta = meta; this.cur = { intro: true };
    this.app.setGameMode(true);
    const rec = save.games[meta.id];
    el.append(h('div.gm-intro',
      h('div.gm-card.pop',
        h('button.round.gm-x', { html: icon('close'), 'aria-label': 'Kapat', onclick: () => this.close() }),
        h('div.gm-badge', { html: icon(meta.icon, 44) }),
        h('div.gm-mech', meta.mech),
        h('h2', meta.title),
        h('p.gm-desc', meta.desc),
        h('ul.gm-how', ...meta.how.map((t, i) => h('li', h('b', String(i + 1)), h('span', t)))),
        rec ? h('div.gm-best', `En iyi puan: ${rec.best}`, h('span.stars', { html: stars(rec.stars, 16) })) : null,
        h('button.btn.primary.big', { html: icon('play') + 'Başla', onclick: () => { sfx('good'); this.start(); } }),
      )));
  }
  start() {
    const meta = this.meta, el = this.el; el.innerHTML = ''; el.classList.remove('pass');
    this.app.onGameStart?.(meta.id);
    let score = 0;
    const top = h('div.gm-top',
      h('button.round', { html: icon('close'), 'aria-label': 'Oyundan çık', onclick: () => this.close() }),
      h('div.gm-title', h('span.gm-ic', { html: icon(meta.icon, 18) }), h('span', meta.title)),
      h('div.gm-stat.tm', { hidden: true }),
      h('div.gm-stat.sc', h('small', 'PUAN'), h('b', '0')));
    const stage = h('div.gm-stage'); const hud = h('div.gm-toasts');
    el.append(top, stage, hud);
    const sEl = top.querySelector('.sc b'), tEl = top.querySelector('.tm');
    const cl = { loops: [], offs: [], timers: [], view: null, done: false };
    this.cur = cl;
    const ctx = {
      root: stage, app: this.app, input: this.app.input, meta,
      get score() { return score; },
      set score(v) { score = Math.max(0, Math.round(v)); sEl.textContent = score; sEl.parentElement.classList.remove('bump'); void sEl.parentElement.offsetWidth; sEl.parentElement.classList.add('bump'); },
      add(d) { ctx.score = score + d; },
      loop(f) { cl.loops.push(f); },
      on(t, e, f, o) { t.addEventListener(e, f, o); cl.offs.push(() => t.removeEventListener(e, f, o)); },
      after(ms, f) { const id = setTimeout(() => { if (!cl.done) f(); }, ms); cl.timers.push(id); return id; },
      /** Süre sayacı: geri kalanı döndürür, sıfırda onEnd çağrılır */
      countdown(sec, onEnd) {
        const c = { left: sec, stop: false }; tEl.hidden = false;
        const draw = () => { const s = Math.ceil(c.left); tEl.innerHTML = `<small>SÜRE</small><b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b>`; tEl.classList.toggle('warn', c.left < 10); };
        draw(); let last = -1;
        ctx.loop(dt => { if (c.stop) return; c.left -= dt; const s = Math.ceil(c.left); if (s !== last) { last = s; draw(); } if (c.left <= 0) { c.left = 0; c.stop = true; draw(); onEnd(); } });
        return c;
      },
      toast(text, kind = 'info', ms = 1900) {
        const t = h('div.gm-toast.' + kind, text); hud.append(t); while (hud.children.length > 2) hud.firstChild.remove();
        setTimeout(() => t.remove(), ms);
      },
      good(text) { sfx('good'); if (text) ctx.toast(text, 'good'); },
      bad(text) { sfx('bad'); if (text) ctx.toast(text, 'bad', 2600); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); },
      /** Sahneyi kaplayan 2D tuval */
      canvas(parent = stage) {
        const cv = h('canvas.gm-canvas'); parent.append(cv); const x = cv.getContext('2d'); const o = { cv, x, w: 1, h: 1 };
        const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d); o.w = r.width; o.h = r.height; x.setTransform(d, 0, 0, d, 0, 0); };
        fit(); ctx.on(window, 'resize', fit); const ro = new ResizeObserver(fit); ro.observe(cv); cl.offs.push(() => ro.disconnect()); ctx.after(0, fit); ctx.after(120, fit); return o;
      },
      use3D(view) { cl.view = view; el.classList.add('three'); this.app.setView(view); },
      /** Tuval ve dokunmaları alttaki canvas'a bırakır */
      passthrough() { el.classList.add('pass'); },
      finish: r => this.result(r),
    };
    this.ctx = ctx; this.games[meta.id](ctx);
  }
  tick(dt, t) { if (this.cur?.loops) for (const f of [...this.cur.loops]) { f(dt, t); if (!this.cur?.loops) break; } }
  stop() {
    const c = this.cur; if (!c || !c.loops) return;
    c.done = true; c.offs.forEach(f => f()); c.timers.forEach(clearTimeout); c.onStop?.();
    c.loops = null; this.app.setView(null);
    if (this.el) this.el.classList.remove('three');
  }
  result({ success, score, note }) {
    if (!this.cur?.loops) return;
    const meta = this.meta; this.stop(); this.cur = { result: true };
    score = Math.max(0, Math.min(1000, Math.round(score)));
    const isBonus = meta.id === 'magara';
    const r = recordGame(meta.id, score, success);
    sfx(success ? 'win' : 'lose');
    const el = this.el; el.className = 'gm fade'; el.style.setProperty('--c', meta.color); el.innerHTML = '';
    el.append(h('div.gm-intro', h('div.gm-card.pop.result' + (success ? '.win' : '.fail'),
      success ? confetti() : null,
      h('div.gm-mech', success ? 'Görev başarılı' : 'Görev tamamlanamadı'),
      h('h2', success ? meta.title : 'Bir daha deneyelim!'),
      h('div.res-stars', { html: stars(r.stars, 40) }),
      h('div.res-nums',
        h('div', h('small', 'PUAN'), h('b', String(score))),
        h('div', h('small', 'KAZANILAN XP'), h('b', '+' + r.xp)),
        h('div', h('small', 'EN İYİ'), h('b', String(save.games[meta.id].best)))),
      note ? h('p.gm-desc', note) : null,
      h('div.learn', h('h3', { html: icon('book', 18) + 'Bu oyunda öğrendiklerin' }), h('ul', ...meta.learn.map(l => h('li', l)))),
      h('div.res-btns',
        h('button.btn', { html: icon('refresh') + 'Tekrar Oyna', onclick: () => { sfx('tick'); this.start(); el.className = 'gm fade'; } }),
        h('button.btn.primary', { html: icon('back') + (isBonus ? 'Mağaraya Dön' : 'Dünyaya Dön'), onclick: () => this.close() })),
    )));
    this.app.onGameResult?.(meta.id, success, score);
  }
  close(silent) {
    if (this.cur?.loops) this.stop();
    if (this.el) { this.el.remove(); this.el = null; }
    const was = this.cur; this.cur = null;
    if (!silent && was) this.app.setGameMode(false);
  }
}

export function stars(n, size = 22) {
  return [1, 2, 3].map(i => `<span class="st ${i <= n ? 'on' : ''}" style="animation-delay:${i * .18}s">${icon('star', size)}</span>`).join('');
}
function confetti() {
  const w = h('div.confetti');
  for (let i = 0; i < 26; i++) w.append(h('i', { style: { left: Math.random() * 100 + '%', background: ['#ffd24c', '#8fe35b', '#42b4ff', '#ff7fb4', '#fff'][i % 5], animationDelay: Math.random() * .8 + 's', animationDuration: 1.6 + Math.random() * 1.4 + 's' } }));
  return w;
}
/** Küçük aşama göstergesi */
export const steps = (n, cur) => h('div.steps', ...Array.from({ length: n }, (_, i) => h('i' + (i < cur ? '.done' : i === cur ? '.on' : ''))));
