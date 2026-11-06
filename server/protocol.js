// Paket doğrulama: istemciden gelen hiçbir değere körü körüne güvenilmez.
export const MAX_CAP = 30;
export const EMOTES = ['👋', '👏', '🎉', '🌱'];
export const LEVELS = ['world', 'yusuf', 'cave', 'plant'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function cleanName(v, fallback = '') {
  if (typeof v !== 'string') return fallback;
  const s = v.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s.length >= 2 ? s : fallback;
}
export function makeCode(taken) {
  for (;;) {
    let c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!taken.has(c)) return c;
  }
}
export const cleanCode = v => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) : '');
export const round = v => Math.round(v * 100) / 100;
