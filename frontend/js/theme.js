import { ls } from './store.js';

const ORDER = ['auto', 'light', 'dark'];
export const theme = () => ls.get('cnTheme', 'auto');
export function applyTheme() {
  const t = theme();
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
export function cycleTheme() { ls.set('cnTheme', ORDER[(ORDER.indexOf(theme()) + 1) % 3]); applyTheme(); }
