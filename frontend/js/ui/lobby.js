import { $, esc, note, go, avatar, TEAM } from '../store.js';
import { state, me, setView } from '../state.js';
import { request, session } from '../net.js';

const flash = (res) => { if (!res.ok) note('lobNote', res.error.message); };

function playerRow(p, you) {
  return `<div class="p${you ? ' you' : ''}"><span class="who${p.connected ? '' : ' off'}">${avatar(p.name, p.color, p.badge, 'sm')}<span>${esc(p.name)}${you ? ' (you)' : ''}${p.connected ? '' : ' · away'}</span>${p.isHost ? '<span class="host">HOST</span>' : ''}</span><span class="tag">${p.role ? esc(p.role.toUpperCase()) : 'WAITING'}</span></div>`;
}

/** Same checks the server does for NOT_READY, to explain a disabled Start button. */
export function notReady(view) {
  for (const k of ['r', 'b']) {
    const mem = view.players.filter((p) => p.team === k);
    if (!mem.some((p) => p.role === 'spymaster')) return `${TEAM[k].n} needs a spymaster.`;
    if (!mem.some((p) => p.role === 'agent')) return `${TEAM[k].n} needs at least one agent.`;
  }
  return '';
}

export function initLobby() {
  $('teams').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.leave) flash(await request('seat:leave'));
    else if (b.dataset.seat) { const [team, role] = b.dataset.seat.split(':'); flash(await request('seat:take', { team, role })); }
  };
  $('timerSel').onchange = async (e) => flash(await request('settings:update', { settings: { timer: +e.target.value } }));
  $('bBegin').onclick = async () => {
    const v = state.view; if (!v) return;
    if (v.phase !== 'lobby') { go('board'); return; }
    flash(await request('game:start'));
  };
  $('bLeave').onclick = async () => { await request('room:leave'); session.clear(); setView(null); go('home'); };
  $('bCopy').onclick = async () => {
    const v = state.view; if (!v) return;
    const url = `${location.origin}${location.pathname}?room=${v.code}`;
    try { await navigator.clipboard.writeText(url); note('lobNote', 'Invite link copied.'); }
    catch { note('lobNote', `Share this link: ${url}`); }
  };
}

export function renderLobby({ view }) {
  $('lobSub').textContent = view ? (view.phase === 'lobby' ? 'Waiting for agents' : 'Mission in progress') : 'No room yet';
  $('code').textContent = view ? view.code : '-----';
  $('bCopy').disabled = $('bLeave').disabled = !view;
  if (!view) {
    $('teams').innerHTML = '<div class="panel"><h3>No room yet</h3><p>Start a game or join with a code from Home.</p><a class="btn" href="#home">Go home</a></div>';
    $('uns').hidden = $('settings').hidden = $('bBegin').hidden = true;
    return;
  }
  const lobby = view.phase === 'lobby', you = me();
  $('settings').hidden = $('bBegin').hidden = false;
  $('teams').innerHTML = ['r', 'b'].map((k) => {
    const mem = view.players.filter((p) => p.team === k).sort((a, b) => (a.role === 'spymaster' ? 0 : 1) - (b.role === 'spymaster' ? 0 : 1));
    const taken = mem.some((p) => p.role === 'spymaster' && p.id !== view.you);
    let btns = '';
    if (lobby) {
      btns = you?.team === k
        ? `<button class="btn alt" data-leave="1">Leave team</button>`
        : `<button class="btn ${k}" data-seat="${k}:spymaster"${taken ? ' disabled' : ''}>${taken ? 'Spymaster seat taken' : 'Join as spymaster'}</button><button class="btn alt" data-seat="${k}:agent">Join as agent</button>`;
    }
    return `<div class="panel team ${k}"><h3>${TEAM[k].g} ${TEAM[k].n} team</h3>${mem.map((p) => playerRow(p, p.id === view.you)).join('') || '<span class="cap">Empty</span>'}${btns}</div>`;
  }).join('');
  const un = view.players.filter((p) => !p.team);
  $('uns').hidden = !un.length;
  $('unsList').innerHTML = un.map((p) => playerRow(p, p.id === view.you)).join('');

  const host = !!you?.isHost;
  $('timerSel').value = String(view.settings?.timer || 0);
  $('timerSel').disabled = !lobby || !host;
  $('hostOnly').textContent = host ? '' : '· host only';

  const why = lobby ? notReady(view) : '';
  if (lobby) {
    $('bBegin').textContent = host ? 'Begin the mission' : 'Waiting for the host to begin';
    $('bBegin').disabled = !host || !!why;
    if (!$('lobNote').dataset.sticky) note('lobNote', why || (you?.team ? '' : 'Pick a team and a role first.'));
  } else {
    $('bBegin').textContent = 'Back to the board';
    $('bBegin').disabled = false;
  }
}
