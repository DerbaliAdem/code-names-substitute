// Profile pictures: pulp-comic spy gear, drawn as objects only (no people, no faces).
// The protocol still stores the old badge symbol (★, ☾ …); each symbol maps to one icon here,
// so the backend and older clients keep working unchanged.
import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import { INK } from '../theme';

const GOLD = '#ffd23c', W = '#fff', RED = '#d8322b', STEEL = '#b8c4d6', LEATHER = '#7a4a24', CREAM = '#f6ecd0';
const s = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { ...s, strokeWidth: 2.5 };

/** Comic burst behind every icon. */
const BURST = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 30 : 46, a = (i / 24) * Math.PI * 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
})();
/** Little "speed" ticks for motion. */
const ticks = (x: number, y: number) => <Path d={`M${x} ${y} l-8 -4 M${x} ${y + 8} l-10 0 M${x} ${y + 16} l-8 4`} {...thin} />;

type HeroDef = { name: string; draw: () => React.ReactNode };

export const HEROES: Record<string, HeroDef> = {
  '★': { name: 'The Badge', draw: () => <G>
    <Path d="M50 12 L60 34 L84 36 L66 52 L72 76 L50 64 L28 76 L34 52 L16 36 L40 34 Z" fill={GOLD} {...s} />
    <Circle cx={50} cy={48} r={11} fill="#f0b81c" {...thin} />
    <Path d="M45 48 L49 52 L56 44" fill="none" {...thin} />
    <Rect x={34} y={78} width={32} height={12} fill={RED} {...thin} />
  </G> },
  '☾': { name: 'Moon Hat', draw: () => <G>
    <Path d="M50 10 Q58 36 76 70 L24 70 Q42 36 50 10 Z" fill="#2a3f8f" {...s} />
    <Path d="M56 30 A8 8 0 1 1 48 22 A6 6 0 1 0 56 30 Z" fill={GOLD} {...thin} />
    <Path d="M38 52 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0 Z" fill={GOLD} {...thin} />
    <Ellipse cx={50} cy={74} rx={38} ry={10} fill="#2a3f8f" {...s} />
  </G> },
  '✦': { name: 'The Lens', draw: () => <G>
    <Path d="M60 60 L84 84" {...s} strokeWidth={12} />
    <Path d="M60 60 L84 84" stroke={LEATHER} strokeWidth={6} strokeLinecap="round" />
    <Circle cx={42} cy={42} r={26} fill="#dff4ff" {...s} strokeWidth={5} />
    <Path d="M28 36 Q32 26 42 24" fill="none" stroke={W} strokeWidth={4} strokeLinecap="round" />
    <Path d="M32 50 L52 34" stroke="#9fd0ee" strokeWidth={3} strokeLinecap="round" />
  </G> },
  '◆': { name: 'The Case', draw: () => <G>
    <Path d="M38 30 L38 22 L62 22 L62 30" fill="none" {...s} strokeWidth={5} />
    <Rect x={14} y={30} width={72} height={50} rx={5} fill={LEATHER} {...s} />
    <Path d="M14 48 L86 48" {...thin} />
    <Rect x={44} y={42} width={12} height={12} fill={GOLD} {...thin} />
    <Rect x={20} y={60} width={34} height={12} fill={RED} {...thin} transform="rotate(-8 37 66)" />
    <Path d="M26 64 L46 61" stroke={W} strokeWidth={2.5} />
  </G> },
  '☀': { name: 'The Rocket', draw: () => <G>
    <Path d="M42 74 Q50 98 58 74 Z" fill="#ff8a1c" {...thin} />
    <Path d="M30 68 L38 50 L38 74 Z M70 68 L62 50 L62 74 Z" fill={RED} {...s} />
    <Path d="M50 8 Q66 26 62 74 L38 74 Q34 26 50 8 Z" fill={W} {...s} />
    <Circle cx={50} cy={40} r={8} fill="#7ad0ff" {...thin} />
    <Path d="M50 8 Q58 16 60 24 L40 24 Q42 16 50 8 Z" fill={RED} {...thin} />
  </G> },
  '♠': { name: 'Spy Camera', draw: () => <G>
    <Rect x={30} y={24} width={16} height={10} fill={INK} />
    <Rect x={12} y={32} width={76} height={46} rx={6} fill="#3a3a44" {...s} />
    <Rect x={12} y={44} width={76} height={6} fill={STEEL} />
    <Circle cx={52} cy={56} r={17} fill={STEEL} {...s} />
    <Circle cx={52} cy={56} r={9} fill="#1c2a44" {...thin} />
    <Circle cx={48} cy={52} r={3} fill={W} />
    <Circle cx={78} cy={40} r={4} fill={GOLD} {...thin} />
  </G> },
  '⚓': { name: 'The Anchor', draw: () => <G>
    <Circle cx={50} cy={18} r={8} fill="none" {...s} strokeWidth={5} />
    <Path d="M50 26 L50 82" {...s} strokeWidth={7} />
    <Path d="M34 40 L66 40" {...s} strokeWidth={6} />
    <Path d="M18 60 Q22 86 50 86 Q78 86 82 60" fill="none" {...s} strokeWidth={7} />
    <Path d="M12 64 L18 54 L26 62 Z M88 64 L82 54 L74 62 Z" fill={INK} {...thin} />
    <Path d="M50 26 L50 82 M34 40 L66 40" stroke={STEEL} strokeWidth={2} />
  </G> },
  '♫': { name: 'Gadget Watch', draw: () => <G>
    <Rect x={38} y={6} width={24} height={22} fill={LEATHER} {...s} />
    <Rect x={38} y={72} width={24} height={22} fill={LEATHER} {...s} />
    <Circle cx={50} cy={50} r={26} fill={GOLD} {...s} />
    <Circle cx={50} cy={50} r={19} fill={CREAM} {...thin} />
    <Path d="M50 50 L50 36 M50 50 L60 56" {...s} strokeWidth={3} />
    <Rect x={74} y={46} width={8} height={8} fill={RED} {...thin} />
    <Path d="M68 30 l6 -6 M72 36 l8 -3" stroke={RED} strokeWidth={3} strokeLinecap="round" />
  </G> },
  '☂': { name: 'The Fedora', draw: () => <G>
    <Ellipse cx={50} cy={66} rx={42} ry={12} fill="#4a3b2a" {...s} />
    <Path d="M26 64 Q24 30 38 26 Q50 32 62 26 Q76 30 74 64 Z" fill="#5a4630" {...s} />
    <Path d="M27 54 Q50 60 73 54 L74 62 Q50 68 26 62 Z" fill={RED} {...thin} />
    <Path d="M40 30 Q50 36 60 30" fill="none" {...thin} />
    <Path d="M84 22 l6 -6 M86 32 l9 -2" stroke={W} strokeWidth={3} strokeLinecap="round" />
  </G> },
  '⚙': { name: 'The Gear', draw: () => <G>
    <Path d="M50 46 L50 10" {...thin} />
    <Circle cx={50} cy={10} r={4} fill={RED} {...thin} />
    {Array.from({ length: 8 }, (_, i) => (
      <Rect key={i} x={44} y={26} width={12} height={14} fill={STEEL} {...thin} transform={`rotate(${i * 45} 50 58)`} />
    ))}
    <Circle cx={50} cy={58} r={22} fill={STEEL} {...s} />
    <Circle cx={50} cy={58} r={8} fill="#5a6474" {...thin} />
  </G> },
  '♣': { name: 'Dark Shades', draw: () => <G>
    <Path d="M10 40 L90 40" {...s} strokeWidth={5} />
    <Path d="M14 40 L46 40 L44 58 Q30 66 18 58 Z" fill="#1c1c24" {...s} />
    <Path d="M54 40 L86 40 L82 58 Q70 66 56 58 Z" fill="#1c1c24" {...s} />
    <Path d="M22 46 L32 46 M62 46 L72 46" stroke="#7ad0ff" strokeWidth={3} strokeLinecap="round" />
    <Path d="M46 44 Q50 40 54 44" fill="none" {...thin} />
    <Path d="M30 78 L70 78" stroke={W} strokeWidth={3} strokeDasharray="6 6" />
  </G> },
  '✪': { name: 'Skeleton Key', draw: () => <G>
    <Circle cx={30} cy={36} r={16} fill="none" {...s} strokeWidth={9} />
    <Circle cx={30} cy={36} r={16} fill="none" stroke={GOLD} strokeWidth={4} />
    <Path d="M42 48 L80 86" {...s} strokeWidth={10} />
    <Path d="M42 48 L80 86" stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
    <Path d="M66 72 L58 80 L64 86 M74 80 L68 86" fill="none" {...s} strokeWidth={5} />
  </G> },
  '✧': { name: 'Top Secret', draw: () => <G>
    <Rect x={12} y={26} width={76} height={50} fill={CREAM} {...s} />
    <Path d="M12 26 L50 56 L88 26" fill="none" {...s} />
    <Circle cx={50} cy={56} r={9} fill={RED} {...thin} />
    <Rect x={18} y={64} width={64} height={11} fill="none" stroke={RED} strokeWidth={3} transform="rotate(-6 50 70)" />
    <Path d="M26 70 L74 65" stroke={RED} strokeWidth={2} strokeDasharray="5 3" />
    {ticks(10, 80)}
  </G> },
};

export const heroFor = (badge: string) => HEROES[badge] ?? HEROES['☂'];

/** Square picture: agent colour + halftone dots + comic burst behind the gear; the ink border is drawn by the caller. */
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
      <Polygon points={BURST} fill={W} opacity={0.28} />
      {heroFor(badge).draw()}
    </Svg>
  );
}
