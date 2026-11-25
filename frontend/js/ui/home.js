import { $, note, go } from '../store.js';
import { state } from '../state.js';
import { request, session } from '../net.js';

const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

async function enterRoom(event, payload) {
  note('homeNote', event === 'room:create' ? 'Opening a room…' : 'Joining…');
  const res = await request(event, { ...payload, profile: state.profile });
  if (!res.ok) { note('homeNote', res.error.message); return; }
  session.set({ code: res.code, playerId: res.playerId, token: res.token });
  note('homeNote', '');
  go('profile');
}

export function initHome() {
  $('bStart').onclick = () => enterRoom('room:create', {});
  $('bJoin').onclick = () => {
    const code = cleanCode($('codeIn').value);
    if (code.length !== 5) { note('homeNote', 'Room codes have 5 letters.'); return; }
    enterRoom('room:join', { code, token: session.get()?.code === code ? session.get().token : undefined });
  };
  $('codeIn').oninput = (e) => { e.target.value = cleanCode(e.target.value); };
  $('codeIn').onkeydown = (e) => { if (e.key === 'Enter') $('bJoin').click(); };
  // Invite links: ?room=KAPOW
  const inv = cleanCode(new URLSearchParams(location.search).get('room'));
  if (inv) $('codeIn').value = inv;
}

export function renderHome({ view }) {
  $('resume').hidden = !view;
  if (view) $('resCode').textContent = view.code;
}
