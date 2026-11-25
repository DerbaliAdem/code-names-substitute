// Pulp comic palette (from docs/design/prototype.html) for light and dark.
import { useColorScheme } from 'react-native';
import { useApp } from './store';

export const INK = '#16130e';
export const HL = '#ffd23c';

const light = { bg: '#f6e7a8', dot: '#e8c94f', ink: INK, panel: '#fff9e0', red: '#e03a2e', blue: '#2a6bd6', tan: '#d9c79a', hl: HL };
const dark = { bg: '#1c1a17', dot: '#2a2722', ink: '#f6ecc8', panel: '#2b2823', red: '#ff5a4a', blue: '#5b94f5', tan: '#4a4333', hl: HL };
export type Palette = typeof light;

export const FONT = {
  display: 'Bangers_400Regular',
  body: 'BarlowCondensed_600SemiBold',
  bold: 'BarlowCondensed_800ExtraBold',
};

export const COLORS = ['#e03a2e', '#2a6bd6', '#2e9e5b', '#8a4fd0', '#e08a1e'];
export const BADGES = ['★', '⚡', '☾', '✦', '◆', '☀', '♠', '✿', '⚓', '♫', '☂', '⚙', '♥', '♣', '✪', '☘', '✧', '♦', '⚔', '⚗', '✈'];
export const ALIASES = ['The Falcon', 'Night Owl', 'Red Fox', 'Quiet Wolf', 'Iron Mole'];

export function useTheme(): { c: Palette; dark: boolean } {
  const sys = useColorScheme();
  const { themePref } = useApp();
  const isDark = themePref === 'auto' ? sys === 'dark' : themePref === 'dark';
  return { c: isDark ? dark : light, dark: isDark };
}
