// WebAudio synth effects (from the prototype). Driven by diffing consecutive RoomViews.
import { ls } from './store.js';

let ac = null;
export const snd = { on: ls.get('cnSound', true) };

function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, d, ty = 'square', v = 0.12, t0 = 0, to) {
  const c = ctx(); if (!c || !snd.on) return;
  const t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
  o.type = ty; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.03);
}
export const sfx = {
  good() { tone(520, 0.1, 'triangle', 0.2); tone(780, 0.18, 'triangle', 0.2, 0.09); },
  neutral() { tone(180, 0.18, 'sine', 0.28, 0, 110); },
  bad() { tone(160, 0.32, 'sawtooth', 0.14, 0, 80); },
  boom() { tone(320, 0.8, 'sawtooth', 0.18, 0, 40); tone(60, 0.8, 'sine', 0.3); },
  clue() { tone(880, 0.25, 'sine', 0.18); tone(1320, 0.2, 'sine', 0.12, 0.12); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, i * 0.12)); },
  tick() { tone(1200, 0.04, 'square', 0.07); },
};
export const unlockAudio = () => ctx();
export function toggleSound() { snd.on = !snd.on; ls.set('cnSound', snd.on); ctx(); if (snd.on) sfx.good(); }

/** Play effects for what changed between two views of the same room. */
export function playDiff(a, b) {
  if (!a || !b || a.code !== b.code) return;
  for (const k of Object.keys(b.revealed || {})) {
    if (a.revealed?.[k]) continue;
    const r = b.revealed[k];
    (r.type === 'x' ? sfx.boom : r.type === 'n' ? sfx.neutral : r.type === r.team ? sfx.good : sfx.bad)();
  }
  if ((b.log?.length || 0) > (a.log?.length || 0)) sfx.clue();
  if (a.phase !== 'over' && b.phase === 'over') setTimeout(sfx.win, b.over?.reason === 'assassin' ? 700 : 0);
}
