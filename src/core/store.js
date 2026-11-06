import { ACHIEVEMENTS, ALL_CARDS, MAIN_GAMES } from './data.js';

const KEY = 'photosynthesis-world-v1';
const fresh = () => ({ xp: 0, games: {}, cards: [], ach: [], seen: [], sound: true, music: true, quality: 'auto', pos: null, started: false, frog: 0 });
function load() { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); } }
export const save = load();
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* gizli mod */ } }
export function resetSave() { try { localStorage.removeItem(KEY); } catch { /* */ } location.reload(); }

// Bildirim veriyolu (HUD dinler). Notice: {kind,title,text,icon}
const ls = [];
export const onChange = f => ls.push(f);
const emit = n => ls.forEach(f => f(n));

// XP eğrisi: 1→2 için 150, sonra her seviyede 60 fazla
export function levelInfo(xp = save.xp) {
  let lv = 1, need = 150, left = xp;
  while (left >= need) { left -= need; lv++; need += 60; }
  return { level: lv, cur: left, need };
}
export function addXp(n) {
  const a = levelInfo().level; save.xp += Math.round(n); const b = levelInfo().level;
  if (b > a) emit({ kind: 'level', title: `Seviye ${b}!`, text: 'Enerji seviyen yükseldi.', icon: 'bolt' });
  if (b >= 5) unlock('seviye5');
  persist(); emit();
}
export function unlock(id) {
  if (save.ach.includes(id)) return;
  save.ach.push(id); persist();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  emit({ kind: 'ach', title: a.name, text: a.desc, icon: a.icon });
  addXp(40);
}
export function giveCard(id) {
  if (save.cards.includes(id)) return false;
  save.cards.push(id); persist();
  const c = ALL_CARDS.find(x => x.id === id);
  emit({ kind: 'card', title: `Kart: ${c.name}`, text: c.fact, icon: 'card' });
  if (save.cards.length >= 10) unlock('kart10');
  return true;
}
export const notify = (title, text, icon = 'leaf') => emit({ kind: 'info', title, text, icon });

export const doneCount = () => MAIN_GAMES.filter(g => save.games[g.id]?.done).length;
export const isUnlocked = need => doneCount() >= need;
export const totalScore = () => MAIN_GAMES.reduce((s, g) => s + (save.games[g.id]?.best || 0), 0);
export const starCount = () => MAIN_GAMES.reduce((s, g) => s + (save.games[g.id]?.stars || 0), 0);
export const progress = () => Math.round(70 * doneCount() / MAIN_GAMES.length + 15 * save.cards.length / ALL_CARDS.length + 15 * save.ach.length / ACHIEVEMENTS.length);

export function recordGame(id, score, success) {
  const r = save.games[id] || (save.games[id] = { best: 0, stars: 0, plays: 0, done: false });
  r.plays++;
  const stars = !success ? 0 : score >= 900 ? 3 : score >= 650 ? 2 : 1;
  const first = success && !r.done;
  if (success) r.done = true;
  r.best = Math.max(r.best, score); r.stars = Math.max(r.stars, stars);
  const xp = Math.round((success ? 30 : 8) + score / 12 + (first ? 60 : 0));
  addXp(xp);
  if (success) {
    giveCard('g-' + id);
    const n = doneCount();
    if (n >= 1) unlock('ilk'); if (n >= 5) unlock('bes'); if (n >= 10) unlock('on'); if (n >= 15) unlock('hepsi');
    if (stars === 3) unlock('yildiz');
    if (MAIN_GAMES.filter(g => save.games[g.id]?.stars === 3).length >= 5) unlock('yildiz5');
    if (id === 'final') unlock('final');
  }
  persist(); emit();
  return { stars, xp, first };
}
export function markSeen(id) {
  if (save.seen.includes(id)) return; save.seen.push(id); persist();
  if (MAIN_GAMES.every(g => save.seen.includes(g.id))) unlock('gezgin');
}
