// Original pulp-comic hero portraits used as profile pictures.
// The protocol still stores the old badge symbol (★, ⚡ …); each symbol simply maps to a hero here,
// so the backend and older clients keep working unchanged.
import React from 'react';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { INK } from '../theme';

const SKIN = '#f3cf9f', GOLD = '#ffd23c', W = '#fff';
const s = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const face = (cy = 56, r = 19) => <Circle cx={50} cy={cy} r={r} fill={SKIN} {...s} />;
const eyes = (y = 55, dx = 7) => <G><Circle cx={50 - dx} cy={y} r={2.4} fill={INK} /><Circle cx={50 + dx} cy={y} r={2.4} fill={INK} /></G>;
const body = (fill: string) => <Path d="M14 104 Q16 78 50 76 Q84 78 86 104 Z" fill={fill} {...s} />;


type HeroDef = { name: string; draw: () => React.ReactNode };

export const HEROES: Record<string, HeroDef> = {
  '★': { name: 'Captain Comet', draw: () => <G>
    <Path d="M-4 30 L34 46 M-4 42 L30 52" stroke={W} strokeWidth={4} />
    {body('#2f6fd6')}
    <Path d="M50 80 L54 89 L64 89 L56 95 L59 104 L50 98 L41 104 L44 95 L36 89 L46 89 Z" fill={GOLD} {...s} strokeWidth={2.5} />
    {face()}
    <Path d="M31 50 Q50 40 69 50 L69 58 Q50 52 31 58 Z" fill="#c0262d" {...s} />
    {eyes(54)}
    <Path d="M44 66 Q50 70 56 66" fill="none" {...s} strokeWidth={2.5} />
  </G> },
  '☾': { name: 'Night Owl', draw: () => <G>
    <Circle cx={80} cy={20} r={10} fill="#fff6d0" {...s} strokeWidth={2.5} />
    <Path d="M6 104 L22 70 L50 78 L78 70 L94 104 Z" fill="#2a2440" {...s} />
    <Path d="M30 72 L30 26 L40 40 L60 40 L70 26 L70 72 Q50 82 30 72 Z" fill="#3a3358" {...s} />
    <Path d="M36 64 Q50 74 64 64 L64 72 Q50 80 36 72 Z" fill={SKIN} {...s} strokeWidth={2.5} />
    <Path d="M36 52 L46 50 L46 56 L36 56 Z M54 50 L64 52 L64 56 L54 56 Z" fill={W} {...s} strokeWidth={2} />
  </G> },
  '✦': { name: 'Doctor Enigma', draw: () => <G>
    <Path d="M10 104 L24 40 Q50 4 76 40 L90 104 Z" fill="#6b2a6e" {...s} />
    <Path d="M32 70 Q32 40 50 38 Q68 40 68 70 Q50 80 32 70 Z" fill="#1a1020" {...s} />
    <Circle cx={50} cy={48} r={6} fill="#7ef0d0" {...s} strokeWidth={2.5} />
    <Circle cx={50} cy={48} r={2} fill={INK} />
    <Path d="M40 60 L46 60 M54 60 L60 60" stroke="#7ef0d0" strokeWidth={4} strokeLinecap="round" />
    <Path d="M42 92 L50 84 L58 92 L50 100 Z" fill={GOLD} {...s} strokeWidth={2.5} />
  </G> },
  '◆': { name: 'Iron Sentinel', draw: () => <G>
    {body('#9b2a22')}
    <Circle cx={50} cy={90} r={7} fill="#9ff3ff" {...s} strokeWidth={2.5} />
    <Path d="M30 40 Q30 22 50 22 Q70 22 70 40 L70 64 Q60 76 50 76 Q40 76 30 64 Z" fill="#c0392b" {...s} />
    <Path d="M37 46 Q50 42 63 46 L63 70 Q50 78 37 70 Z" fill={GOLD} {...s} strokeWidth={2.5} />
    <Path d="M40 52 L47 54 M53 54 L60 52" stroke="#9ff3ff" strokeWidth={4} strokeLinecap="round" />
    <Path d="M44 66 L56 66" stroke={INK} strokeWidth={2.5} />
  </G> },
  '☀': { name: 'Rocket Kid', draw: () => <G>
    <Path d="M18 104 L22 74 L32 74 L30 104 Z M82 104 L78 74 L68 74 L70 104 Z" fill="#8a8f99" {...s} />
    {body('#e86a1f')}
    {face(56, 18)}
    <Path d="M31 50 Q32 30 50 30 Q68 30 69 50 Z" fill="#e86a1f" {...s} />
    <Circle cx={42} cy={52} r={6} fill="#bfe8ff" {...s} strokeWidth={2.5} />
    <Circle cx={58} cy={52} r={6} fill="#bfe8ff" {...s} strokeWidth={2.5} />
    <Path d="M42 64 Q50 72 58 64" fill={W} {...s} strokeWidth={2.5} />
  </G> },
  '♠': { name: 'Grinning Jack', draw: () => <G>
    {body('#6a2fa0')}
    <Path d="M40 78 L50 90 L60 78" fill="#3fbf4a" {...s} strokeWidth={2.5} />
    <Circle cx={50} cy={58} r={19} fill="#f6f1e4" {...s} />
    <Path d="M34 18 L66 18 L66 38 L34 38 Z" fill="#2a1a3a" {...s} />
    <Path d="M24 40 L76 40" {...s} strokeWidth={6} />
    <Path d="M42 30 L58 30" stroke="#3fbf4a" strokeWidth={4} />
    <Path d="M40 54 L46 52 M54 52 L60 54" {...s} strokeWidth={3} />
    <Path d="M36 63 Q50 78 64 63 Q50 70 36 63 Z" fill="#c0262d" {...s} strokeWidth={2.5} />
  </G> },
  '⚓': { name: 'Sky Pirate', draw: () => <G>
    {body('#7a4a24')}
    <Path d="M30 76 Q20 86 26 98 L36 82 Z" fill={W} {...s} strokeWidth={2.5} />
    {face()}
    <Path d="M30 46 Q32 32 50 32 Q68 32 70 46 Z" fill="#7a4a24" {...s} />
    <Path d="M38 44 Q42 36 48 44" fill="#bfe8ff" {...s} strokeWidth={2} />
    <Path d="M30 46 L70 58" {...s} strokeWidth={3} />
    <Circle cx={58} cy={55} r={5} fill={INK} />
    <Circle cx={43} cy={55} r={2.4} fill={INK} />
    <Path d="M42 66 Q50 72 58 65" fill="none" {...s} strokeWidth={2.5} />
  </G> },
  '♫': { name: 'The Brute', draw: () => <G>
    <Path d="M4 104 Q6 70 50 70 Q94 70 96 104 Z" fill="#3f8a2a" {...s} />
    <Path d="M28 34 L72 34 L74 70 Q50 82 26 70 Z" fill="#5fb03c" {...s} />
    <Path d="M28 34 L72 34 L70 26 L30 26 Z" fill="#1f2a18" {...s} />
    <Path d="M34 46 L46 50 M54 50 L66 46" {...s} strokeWidth={4} />
    <Circle cx={41} cy={54} r={2.4} fill={INK} /><Circle cx={59} cy={54} r={2.4} fill={INK} />
    <Path d="M38 68 L62 68" {...s} strokeWidth={4} />
    <Rect x={6} y={78} width={22} height={20} rx={6} fill="#5fb03c" {...s} />
    <Rect x={72} y={78} width={22} height={20} rx={6} fill="#5fb03c" {...s} />
  </G> },
  '☂': { name: 'Agent Zero', draw: () => <G>
    <Path d="M14 104 Q16 78 50 76 Q84 78 86 104 Z" fill="#b8925a" {...s} />
    <Path d="M34 78 L50 96 L66 78" fill="#b8925a" {...s} />
    <Path d="M46 82 L50 100 L54 82 Z" fill="#c0262d" {...s} strokeWidth={2} />
    {face(58)}
    <Path d="M30 64 Q50 80 70 64 L70 70 Q50 84 30 70 Z" fill="#3a2e22" opacity={0.25} />
    <Path d="M20 44 Q50 36 80 44 L74 48 Q50 42 26 48 Z" fill="#4a3b2a" {...s} />
    <Path d="M34 44 L36 24 Q50 18 64 24 L66 44 Z" fill="#4a3b2a" {...s} />
    <Path d="M35 38 L65 38" stroke="#c0262d" strokeWidth={4} />
    <Path d="M40 56 L46 56 M54 56 L60 56" {...s} strokeWidth={3} />
    <Path d="M44 67 L56 66" {...s} strokeWidth={2.5} />
  </G> },
  '⚙': { name: 'Robo-Rex', draw: () => <G>
    <Path d="M50 22 L50 12" {...s} /><Circle cx={50} cy={10} r={4} fill="#c0262d" {...s} strokeWidth={2} />
    <Rect x={18} y={78} width={64} height={30} rx={4} fill="#8a96a8" {...s} />
    <Rect x={28} y={22} width={44} height={50} rx={6} fill="#b8c4d6" {...s} />
    <Rect x={34} y={36} width={32} height={14} rx={3} fill={INK} />
    <Circle cx={42} cy={43} r={4} fill={GOLD} /><Circle cx={58} cy={43} r={4} fill={GOLD} />
    <Path d="M38 60 L62 60 M42 56 L42 64 M50 56 L50 64 M58 56 L58 64" {...s} strokeWidth={2.5} />
    <Circle cx={31} cy={27} r={1.8} fill={INK} /><Circle cx={69} cy={27} r={1.8} fill={INK} />
    <Path d="M40 86 L60 86 M40 94 L60 94" {...s} strokeWidth={2.5} />
  </G> },
  // ---- second cast: hitman, chief, wizard ----
  '♣': { name: 'Mr. Silencer', draw: () => <G>
    <Path d="M14 104 Q16 78 50 76 Q84 78 86 104 Z" fill="#1c1c22" {...s} />
    <Path d="M42 78 L50 104 L58 78 Z" fill={W} {...s} strokeWidth={2.5} />
    <Path d="M47 82 L50 100 L53 82 Z" fill="#c0262d" />
    <Circle cx={50} cy={52} r={20} fill={SKIN} {...s} />
    <Path d="M32 50 L68 50 L66 58 L54 58 L50 54 L46 58 L34 58 Z" fill={INK} />
    <Path d="M43 68 L57 68" {...s} strokeWidth={2.5} />
    <Path d="M64 38 Q70 40 70 46" fill="none" stroke={W} strokeWidth={2} opacity={0.7} />
  </G> },
  '✪': { name: 'The Chief', draw: () => <G>
    {body('#1f3f8a')}
    <Path d="M42 84 L50 80 L58 84 L56 94 L50 98 L44 94 Z" fill={GOLD} {...s} strokeWidth={2.5} />
    {face(58)}
    <Path d="M28 46 Q50 20 72 46 Z" fill="#1f3f8a" {...s} />
    <Path d="M26 46 L74 46 L70 52 L30 52 Z" fill={INK} />
    <Circle cx={50} cy={36} r={4} fill={GOLD} {...s} strokeWidth={2} />
    {eyes(58)}
    <Path d="M38 68 Q44 64 50 67 Q56 64 62 68 Q56 71 50 69 Q44 71 38 68 Z" fill="#5a4630" {...s} strokeWidth={2} />
  </G> },
  '✧': { name: 'Merlok the Wise', draw: () => <G>
    {body('#2a4aa0')}
    <Path d="M32 62 Q30 100 50 104 Q70 100 68 62 Z" fill="#e8e8e8" {...s} />
    {face(56, 17)}
    <Path d="M28 46 L50 0 L72 46 Z" fill="#2a4aa0" {...s} />
    <Path d="M44 22 L46 27 L51 27 L47 30 L49 35 L44 32 L40 35 L42 30 L38 27 L43 27 Z M58 36 L59 39 L62 39 L60 41 L61 44 L58 42 L55 44 L56 41 L54 39 L57 39 Z" fill={GOLD} />
    <Path d="M26 46 L74 46" {...s} strokeWidth={5} />
    <Path d="M38 52 L46 50 M54 50 L62 52" stroke="#e8e8e8" strokeWidth={4} strokeLinecap="round" />
    {eyes(56)}
  </G> },
};

export const heroFor = (badge: string) => HEROES[badge] ?? HEROES['☂'];

/** Square portrait: agent colour + halftone dots behind the hero, ink border drawn by the caller. */
export function Hero({ badge, color, size }: { badge: string; color: string; size: number }) {
  const bg = /^#[0-9a-f]{6}$/i.test(color) ? color : '#888';
  const id = 'dots' + Math.round(size);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={heroFor(badge).name}>
      <Defs>
        <Pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse">
          <Circle cx={4} cy={4} r={1.6} fill="#000" opacity={0.18} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={bg} />
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id})`} />
      {heroFor(badge).draw()}
    </Svg>
  );
}
