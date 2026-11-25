// Entry point: router, top bar, connection banner, render loop.
import { $, note, go } from './store.js';
import { state, subscribe, setView } from './state.js';
import { connect, onRoomClosed } from './net.js';
import { snd, toggleSound, unlockAudio, playDiff } from './sound.js';
import { applyTheme, cycleTheme, theme } from './theme.js';
import { initHome, renderHome } from './ui/home.js';
import { initProfile, renderProfile } from './ui/profile.js';
import { initLobby, renderLobby } from './ui/lobby.js';
import { initBoard, renderBoard } from './ui/board.js';
import { initWin, renderWin } from './ui/win.js';

const sections = [...document.querySelectorAll('section')];
const tabs = [...document.querySelectorAll('.tabs a')];

function show() {
  const h = (location.hash || '#home').slice(1);
  const id = sections.some((s) => s.id === h) ? h : 'home';
  sections.forEach((s) => s.classList.toggle('on', s.id === id));
  tabs.forEach((a) => (a.getAttribute('href') === '#' + id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}

function renderBar() {
  const t = theme();
  $('tSnd').textContent = 'Sound: ' + (snd.on ? 'On' : 'Off');
  $('tSnd').setAttribute('aria-pressed', snd.on);
  $('tThm').textContent = 'Theme: ' + t[0].toUpperCase() + t.slice(1);
}

const BANNER = {
  connecting: '',
  waking: 'Waking the server… the first visit can take up to a minute',
  reconnecting: 'Connection lost. Reconnecting…',
  online: '',
};

/** Follow phase changes: lobby→play to board, play→over to victory, over→lobby to lobby. */
function route(a, b) {
  if (!b) return;
  const joined = !a || a.code !== b.code;
  if (joined) { if (b.phase === 'play') go('board'); else if (b.phase === 'over') go('win'); return; }
  if (a.phase === b.phase) return;
  if (b.phase === 'play') go('board');
  else if (b.phase === 'over') go('win');
  else if (b.phase === 'lobby') go('lobby');
}

let lastView = null;
function render(s) {
  if (s.view !== lastView) { playDiff(lastView, s.view); route(lastView, s.view); lastView = s.view; }
  const msg = BANNER[s.conn] || '';
  $('banner').hidden = !msg;
  $('banner').textContent = msg;
  renderBar(); renderHome(s); renderProfile(s); renderLobby(s); renderBoard(s); renderWin(s);
}

applyTheme();
initHome(); initProfile(); initLobby(); initBoard(); initWin();
$('tSnd').onclick = () => { toggleSound(); renderBar(); };
$('tThm').onclick = () => { cycleTheme(); renderBar(); };
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('hashchange', show);
onRoomClosed((reason) => { go('home'); note('homeNote', 'The room was closed' + (reason ? ': ' + reason : '.')); });
subscribe(render);
show();
render(state);
connect();

// Debug hook for testing the UI without a backend: window.cn.setView(fakeRoomView)
window.cn = { state, setView };
