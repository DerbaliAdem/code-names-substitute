// Draws the "Kapow keyhole" logo and exports every app icon with ImageMagick.
// Run: node scripts/make-icons.mjs   (needs `magick` on PATH)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const INK = '#16130e', RED = '#e03a2e', HL = '#ffd23c', BG = '#f6e7a8';
const star = (cx, cy, rOut, rIn, n = 8, rot = -90) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? rIn : rOut, a = ((rot + (i * 180) / n) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/** The burst + keyhole, centred at (c,c), radius ~ s. `mono` draws a white silhouette. */
function burst(c, s, mono = false) {
  const k = s / 74, sw = (w) => (w * k).toFixed(1);
  const ink = mono ? '#fff' : INK;
  const sh = 6 * k;
  return `
  <polygon points="${star(c + sh, c + sh, s, s * 0.62)}" fill="${ink}"/>
  <polygon points="${star(c, c, s, s * 0.62)}" fill="${mono ? '#fff' : RED}" stroke="${ink}" stroke-width="${sw(4)}" stroke-linejoin="round"/>
  ${mono ? '' : `<polygon points="${star(c, c, s * 0.76, s * 0.47, 8, -90 + 11.25)}" fill="${HL}" stroke="${INK}" stroke-width="${sw(3)}" stroke-linejoin="round"/>`}
  <circle cx="${c}" cy="${c - 10 * k}" r="${14 * k}" fill="${mono ? '#000' : INK}"/>
  <polygon points="${c - 7 * k},${c - 6 * k} ${c + 7 * k},${c - 6 * k} ${c + 12 * k},${c + 26 * k} ${c - 12 * k},${c + 26 * k}" fill="${mono ? '#000' : INK}"/>`;
}

const svg = (size, body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${body}</svg>`;
const dots = (size, step) => {
  let d = '';
  for (let y = step / 2; y < size; y += step) for (let x = step / 2; x < size; x += step) d += `<circle cx="${x}" cy="${y}" r="${step * 0.15}" fill="#e8c94f"/>`;
  return d;
};

const OUT = {
  'icon.png': svg(1024, dots(1024, 64) + burst(500, 400), BG),                 // iOS + default (OS rounds corners)
  'android-icon-foreground.png': svg(1024, burst(500, 300)),                   // inside the 66% safe zone
  'android-icon-background.png': svg(1024, dots(1024, 64), BG),
  'android-icon-monochrome.png': svg(1024, burst(500, 300, true)),
  'splash-icon.png': svg(1024, burst(500, 420)),
  'logo.png': svg(512, burst(250, 220)),                                       // in-app header
  'favicon.png': svg(96, burst(46, 42), BG),
};

const tmp = new URL('../.icon-build/', import.meta.url);
mkdirSync(tmp, { recursive: true });
for (const [name, content] of Object.entries(OUT)) {
  const src = new URL(name.replace('.png', '.svg'), tmp);
  writeFileSync(src, content);
  execFileSync('magick', ['-background', 'none', src.pathname, new URL('../assets/' + name, import.meta.url).pathname]);
}
console.log('wrote', Object.keys(OUT).join(', '));
