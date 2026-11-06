import * as THREE from 'three';
import { GAME } from './core/data.js';
import { save, persist, isUnlocked, markSeen, onChange } from './core/store.js';
import { setAudio, unlockAudio, sfx } from './core/audio.js';
import { isTouch } from './core/dom.js';
import { buildWorld } from './world/world.js';
import { Input, Player, FollowCam } from './world/player.js';
import { buildYusuf, buildCave, buildLeaf } from './world/interiors.js';
import { height } from './world/terrain.js';
import { Shell } from './games/shell.js';
import { lab, isik, karbon, oksijen } from './games/sim.js';
import { su, calvin, dedektif, molekul, puzzle, faktor, magara } from './games/logic.js';
import { kloroplast, kurtar, parkur, kasif, final } from './games/three.js';
import { UI } from './ui/ui.js';
import { Net } from './net/client.js';

const GAMES_RUN = { lab, isik, karbon, oksijen, su, calvin, dedektif, molekul, puzzle, faktor, magara, kloroplast, kurtar, parkur, kasif, final };

// Kalite: mobilde pil ve FPS için otomatik düşer
const mobile = isTouch() && Math.min(innerWidth, innerHeight) < 820;
const lowMem = (navigator.deviceMemory || 8) <= 3;
const tier = save.quality === 'auto' ? (mobile ? (lowMem ? 'low' : 'mid') : 'high') : save.quality === 'low' ? 'low' : 'high';
const Q = {
  high: { seg: 150, waterSeg: 150, trees: 190, grass: 2600, flowers: 700, butterflies: 12, particles: 180, shadow: true, shadowSize: 2048, pr: 2, low: false },
  mid: { seg: 120, waterSeg: 110, trees: 130, grass: 1100, flowers: 320, butterflies: 7, particles: 90, shadow: true, shadowSize: 1024, pr: 1.5, low: false },
  low: { seg: 90, waterSeg: 80, trees: 80, grass: 350, flowers: 160, butterflies: 4, particles: 40, shadow: false, shadowSize: 512, pr: 1, low: true },
}[tier];

const canvas = document.getElementById('gl'), uiRoot = document.getElementById('ui');
setAudio(save.sound, save.music);
addEventListener('pointerdown', unlockAudio); addEventListener('keydown', unlockAudio);

const app = {
  canvas, Q, input: new Input(canvas), player: new Player(), world: null, shell: null, ui: null, view: null, level: null, mission: null,
  mode: 'menu', frozen: false,
  setView(v) { app.view = v; },
  setGameMode(on) {
    app.ui.setInGame(on); app.net?.busy(on ? app.shell.meta?.id : null); if (!on) { app.input.clear(); app.world.refresh(); app.saveNow(); }
  },
  setTouchControls(on, jump) { app.ui.setControls(on, jump); },
  setMission(m) { app.mission = m; app.ui.setControls(!!m, !!m); if (!m) app.ui.prompt(null); },
  onGameStart(id) { app.net?.begin(id); },
  onGameResult(id, ok, score) { app.world.refresh(); app.net?.result(id, score, ok); },
  saveNow() { if (app.net?.inRoom) return; if (app.level === app.world) { save.pos = [app.player.pos.x, app.player.pos.z]; persist(); } },
  dialog(title, text, ic) { app.ui.dialog(title, text, ic); },
  openGame(id) {
    const m = GAME[id];
    if (id !== 'magara' && !isUnlocked(m.need)) { sfx('bad'); app.ui.flash(`Bu oyun için önce ${m.need} oyun tamamlamalısın.`); return; }
    app.shell.open(m);
  },
  teleportTo(id) {
    const st = app.world.stations[id]; if (!st) return;
    app.ui.fade(() => {
      if (app.level !== app.world) switchLevel(app.world);
      const p = st.spot; app.player.teleport(p.x, height(p.x, p.z), p.z); cam.first = true; app.net?.tp(id, p.x, p.z);
      cam.yaw = Math.atan2(p.x - st.g.position.x, p.z - st.g.position.z); sfx('teleport');
    });
  },
};
window.__app = app;

let cam, renderer, camera, interiors = {}, returnPos = null;
const switchLevel = lv => { app.level?.scene.remove(app.player.obj); app.level = lv; lv.scene.add(app.player.obj); app.net?.onLevel(lv); };
app.enterOnline = (x, y, z) => { if (app.level !== app.world) switchLevel(app.world); app.player.teleport(x, y, z); app.player.yaw = Math.PI; app.mode = 'explore'; save.started = true; persist(); cam.first = true; cam.yaw = 0; };

const hooks = {
  openGame: id => app.openGame(id), dialog: app.dialog, seen: id => markSeen(id), coreLit: () => app.net?.room?.core,
  enterInterior(name, spot) {
    app.ui.fade(() => {
      returnPos = spot.clone();
      const build = { yusuf: buildYusuf, cave: buildCave, plant: buildLeaf }[name];
      const lv = interiors[name] || (interiors[name] = build(hooks));
      lv.netName = name; switchLevel(lv); app.net?.level(name, lv.entry[0], lv.entry[1]); app.player.teleport(lv.entry[0], 0, lv.entry[1]); app.player.yaw = Math.PI; cam.yaw = 0; cam.pitch = .4; cam.dist = Math.min(cam.dist, 6.5); cam.first = true;
      lv.onEnter?.();
    });
  },
  leaveInterior() {
    app.ui.fade(() => { switchLevel(app.world); const p = returnPos; app.net?.level('world', p.x, p.z); app.player.teleport(p.x, height(p.x, p.z), p.z); cam.first = true; });
  },
};

function boot() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !Q.low, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = Q.shadow; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.renderer = renderer;
  camera = new THREE.PerspectiveCamera(58, 1, .2, 1800);
  let pr = Math.min(devicePixelRatio || 1, Q.pr);
  const resize = () => {
    const w = innerWidth, h = innerHeight; renderer.setPixelRatio(pr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (app.view?.camera) { app.view.camera.aspect = w / h; app.view.camera.updateProjectionMatrix(); }
  };
  addEventListener('resize', resize); resize();

  app.world = buildWorld(Q, hooks);
  app.shell = new Shell(document.getElementById('gm-host'), app, GAMES_RUN);
  cam = new FollowCam(camera);
  const sp = save.pos || [0, 11];
  app.player.pos.set(sp[0], height(sp[0], sp[1]), sp[1]); app.player.yaw = Math.PI;
  switchLevel(app.world);

  const clock = new THREE.Clock(); let t = 0, ftAvg = 16, ftN = 0, lastSave = 0;
  const near = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), .1); t += dt;
    // Sürekli düşük FPS'de çözünürlüğü kıs
    ftAvg = ftAvg * .97 + dt * 1000 * .03; ftN++;
    if (ftN > 240 && ftAvg > 30 && ftAvg < 90 && pr > .8) { pr = Math.max(.8, pr - .25); resize(); ftN = 0; ftAvg = 16; }
    app.shell.tick(dt, t); app.net?.tick(dt);
    if (app.view) { app.view.update(dt, t); renderer.render(app.view.scene, app.view.camera); return; }
    if (app.mode === 'menu') {
      const a = t * .06; camera.position.set(Math.sin(a) * 92, 38 + Math.sin(t * .1) * 6, Math.cos(a) * 92); camera.lookAt(0, 4, 0);
      app.world.update(t, dt, app.player, camera); renderer.render(app.world.scene, camera); return;
    }
    const inGame = app.shell.active, playing = !inGame || app.mission;
    if (playing && !app.ui.blocked()) {
      app.player.update(dt, app.input, cam.yaw, app.level, false);
      cam.update(dt, app.input, app.player, app.level);
      // Etkileşim bul
      let best = null, bd = 1e9; const pp = app.player.pos;
      const list = app.mission ? app.mission.interact() : app.level.interact;
      for (const it of list) { const d = Math.hypot(it.pos.x - pp.x, it.pos.z - pp.z); if (d < it.r && d < bd && Math.abs(it.pos.y - pp.y) < 6) { bd = d; best = it; } }
      app.ui.prompt(best);
      if (app.input.takeAct() && best) { app.input.clear(); best.act(); }
      if (t - lastSave > 5) { lastSave = t; app.saveNow(); }
    } else { app.input.clear(); if (!inGame) cam.update(dt, app.input, app.player, app.level); }
    if (!playing && !app.shell.el?.classList.contains('see')) { /* Oyun ekranı açıkken dünya dondurulur */ app.ui.tick(cam, app.player, app.level); return; }
    app.level.update(t, dt, app.player, camera);
    app.ui.tick(cam, app.player, app.level);
    renderer.render(app.level.scene, camera);
  }
  frame();
  document.getElementById('boot')?.remove();
  app.ui.showMenu(); app.net.boot();
}

// Yükleme ekranı görünsün diye dünyayı bir sonraki karede kur
app.ui = new UI(uiRoot, app);
app.net = new Net(app);
app.ui.onStart = () => { app.mode = 'explore'; save.started = true; persist(); cam.first = true; };
setTimeout(boot, 60);
onChange(() => app.ui.refresh());
