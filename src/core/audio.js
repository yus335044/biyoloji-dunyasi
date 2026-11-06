// Tüm sesler WebAudio ile üretilir; dosya kullanılmaz.
let ac = null;
let master;
let soundOn = true, musicOn = true;
let musicTimer = 0;

export function unlockAudio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    startMusic();
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setAudio(sound, music) { soundOn = sound; musicOn = music; }

function tone(f, t = 0.15, type = 'sine', vol = 0.3, delay = 0, slide = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), s = ac.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f, s);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), s + t);
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(vol, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + t);
  o.connect(g); g.connect(master); o.start(s); o.stop(s + t + 0.02);
}
const seq = (n, gap = 0.09, t = 0.2, type = 'triangle', v = 0.25) => n.forEach((f, i) => tone(f, t, type, v, i * gap));

const lib = {
  tick: () => tone(700, 0.05, 'triangle', 0.12),
  good: () => seq([660, 880], 0.07, 0.15),
  bad: () => tone(200, 0.22, 'sawtooth', 0.12, 0, -90),
  collect: () => seq([880, 1320], 0.05, 0.12, 'sine', 0.2),
  jump: () => tone(320, 0.16, 'sine', 0.13, 0, 340),
  win: () => seq([523, 659, 784, 1047, 1319], 0.1, 0.32),
  lose: () => seq([392, 330, 262], 0.16, 0.3, 'triangle', 0.2),
  level: () => seq([587, 740, 880, 1175, 1480], 0.08, 0.3, 'triangle', 0.25),
  secret: () => seq([1047, 880, 1175, 988, 1319, 1568], 0.11, 0.42, 'sine', 0.18),
  teleport: () => tone(220, 0.5, 'sine', 0.2, 0, 900),
};
export function sfx(n) { if (soundOn && ac) lib[n](); }

// Pentatonik, seyrek ve dinlendirici bir ortam ezgisi + kuş cıvıltısı
function startMusic() {
  const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
  let i = 2;
  const step = () => {
    if (musicOn && ac && ac.state === 'running' && !document.hidden) {
      i = Math.max(0, Math.min(scale.length - 1, i + Math.floor(Math.random() * 5) - 2));
      tone(scale[i], 1.6, 'sine', 0.045);
      if (Math.random() < 0.35) tone(scale[i] / 2, 2.2, 'sine', 0.035);
      if (Math.random() < 0.18) { const b = 2200 + Math.random() * 1400; tone(b, 0.08, 'sine', 0.02, 0, 500); tone(b, 0.08, 'sine', 0.02, 0.13, 700); }
    }
    musicTimer = window.setTimeout(step, 700 + Math.random() * 900);
  };
  clearTimeout(musicTimer); step();
}
