import { $, go, avatar, COLS, BADGES } from '../store.js';
import { state, saveProfile, emit } from '../state.js';
import { request, session } from '../net.js';

let pushTimer = null;
function changed() {
  saveProfile();
  emit();
  // Live-update the server profile while in a room (debounced).
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { if (state.view) request('profile:update', { profile: state.profile }); }, 400);
}

export function initProfile() {
  const p = state.profile;
  $('fCol').innerHTML = COLS.map((c) => `<button role="radio" data-v="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('');
  $('fBadge').innerHTML = BADGES.map((b) => `<button role="radio" data-v="${b}" aria-label="Badge ${b}">${b}</button>`).join('');
  $('fName').value = p.name;
  $('fAlias').value = p.alias;
  $('fName').oninput = (e) => { p.name = e.target.value; changed(); };
  $('fAlias').onchange = (e) => { p.alias = e.target.value; changed(); };
  $('fCol').onclick = (e) => { const b = e.target.closest('button'); if (b) { p.color = b.dataset.v; changed(); } };
  $('fBadge').onclick = (e) => { const b = e.target.closest('button'); if (b) { p.badge = b.dataset.v; changed(); } };
  $('enter').onclick = async () => {
    if (state.view) { await request('profile:update', { profile: state.profile }); go('lobby'); return; }
    const res = await request('room:create', { profile: state.profile });
    if (res.ok) { session.set({ code: res.code, playerId: res.playerId, token: res.token }); go('lobby'); }
    else $('enter').textContent = res.error.message;
  };
}

export function renderProfile({ view, profile: p }) {
  const n = p.name.trim() || 'Agent';
  $('pAv').innerHTML = avatar(n, p.color, p.badge);
  $('pNm').textContent = n;
  $('pAl').textContent = p.alias;
  [...$('fCol').children].forEach((b) => b.setAttribute('aria-checked', b.dataset.v === p.color));
  [...$('fBadge').children].forEach((b) => b.setAttribute('aria-checked', b.dataset.v === p.badge));
  $('enter').textContent = view ? 'Enter the hideout' : 'Create a room';
}
