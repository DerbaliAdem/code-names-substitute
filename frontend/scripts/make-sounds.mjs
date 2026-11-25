// Generates the game's sound effects as small WAV files (same synth recipes as the original web prototype).
// Run: node scripts/make-sounds.mjs   → writes assets/sounds/*.wav
import { writeFileSync, mkdirSync } from 'node:fs';
const RATE = 22050;
const osc = { sine: (p) => Math.sin(2 * Math.PI * p), square: (p) => (p % 1 < 0.5 ? 1 : -1), triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5), sawtooth: (p) => 2 * (p % 1) - 1 };
// tone(freq, dur, type, vol, startOffset, slideTo)
function render(tones) {
  const len = Math.ceil(RATE * Math.max(...tones.map((t) => (t[4] || 0) + t[1] + 0.03)));
  const buf = new Float32Array(len);
  for (const [f, d, ty = 'square', v = 0.12, t0 = 0, to] of tones) {
    let phase = 0; const s0 = Math.floor(t0 * RATE), n = Math.floor(d * RATE);
    for (let i = 0; i < n; i++) {
      const k = i / n, freq = to ? f * Math.pow(to / f, k) : f;
      phase += freq / RATE;
      const env = v * Math.pow(0.0001 / v, k) * Math.min(1, i / 40);
      buf[s0 + i] += osc[ty](phase) * env;
    }
  }
  const out = Buffer.alloc(44 + len * 2);
  out.write('RIFF', 0); out.writeUInt32LE(36 + len * 2, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(RATE, 24);
  out.writeUInt32LE(RATE * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(len * 2, 40);
  for (let i = 0; i < len; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * 2)) * 32767), 44 + i * 2);
  return out;
}
const SFX = {
  good: [[520, 0.1, 'triangle', 0.2], [780, 0.18, 'triangle', 0.2, 0.09]],
  neutral: [[180, 0.18, 'sine', 0.28, 0, 110]],
  bad: [[160, 0.32, 'sawtooth', 0.14, 0, 80]],
  boom: [[320, 0.8, 'sawtooth', 0.18, 0, 40], [60, 0.8, 'sine', 0.3]],
  clue: [[880, 0.25, 'sine', 0.18], [1320, 0.2, 'sine', 0.12, 0.12]],
  win: [523, 659, 784, 1047].map((f, i) => [f, 0.28, 'triangle', 0.2, i * 0.12]),
  tick: [[1200, 0.04, 'square', 0.07]],
  // cackling "ha-ha-ha-ha-HA": falling chirps, last one longer
  laugh: [620, 600, 570, 540, 500, 470].flatMap((f, i) => [[f, i === 5 ? 0.3 : 0.11, 'sawtooth', 0.16, i * 0.15, f * 0.7], [f * 1.5, i === 5 ? 0.3 : 0.11, 'triangle', 0.1, i * 0.15, f]]),
};
const dir = new URL('../assets/sounds/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, tones] of Object.entries(SFX)) writeFileSync(new URL(name + '.wav', dir), render(tones));
console.log('wrote', Object.keys(SFX).join(', '));
