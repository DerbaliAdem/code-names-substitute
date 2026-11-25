// localStorage wrapper that never throws (private windows, blocked storage).
export const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const note = (id, t) => { const el = $(id); if (el) el.textContent = t || ''; };
export const go = (h) => { if (location.hash !== '#' + h) location.hash = h; };

export const TEAM = { r: { n: 'Red', g: '▲' }, b: { n: 'Blue', g: '●' } };
export const MK = { r: '▲', b: '●', n: '–', x: '✖' };
export const COLS = ['#e03a2e', '#2a6bd6', '#2e9e5b', '#8a4fd0', '#e08a1e'];
export const BADGES = ['★', '⚡', '☾', '✦', '◆', '☀', '♠', '✿', '⚓', '♫', '☂', '⚙'];

export const avatar = (name, color, badge, cls = '') =>
  `<div class="av ${cls}" style="background:${esc(/^#[0-9a-f]{6}$/i.test(color) ? color : '#888888')}">${esc((name || '?')[0].toUpperCase())}<em>${esc(badge)}</em></div>`;
