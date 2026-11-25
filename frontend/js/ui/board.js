import { $, esc, note, TEAM, MK } from '../store.js';
import { state, me, now, playerName } from '../state.js';
import { request } from '../net.js';
import { sfx } from '../sound.js';

let clueN = 2, lastTick = -1;

/** What the UI lets this player do. The server re-checks everything. */
export function perms(v = state.view) {
  if (!v || v.phase !== 'play') return {};
  const p = me(), mine = p && p.team === v.turn;
  return {
    guess: mine && p.role === 'agent' && !!v.clue,
    end: mine && p.role === 'agent' && v.guessesThisTurn >= 1,
    clue: mine && p.role === 'spymaster' && !v.clue,
  };
}

async function sendClue() {
  const word = $('word').value.trim().toUpperCase();
  if (!word) return note('clueMsg', 'Type a one-word clue.');
  if (/\s/.test(word)) return note('clueMsg', 'One word only.');
  note('clueMsg', 'Sending…');
  const res = await request('clue:give', { word, number: clueN });
  if (!res.ok) return note('clueMsg', res.error.message);
  note('clueMsg', ''); $('word').value = '';
}

export function initBoard() {
  $('grid').onclick = async (e) => {
    const c = e.target.closest('.card'); if (!c || c.disabled) return;
    c.disabled = true; // avoid double taps while waiting
    const res = await request('guess', { index: +c.dataset.i });
    note('boardNote', res.ok ? '' : res.error.message);
  };
  $('bEnd').onclick = async () => { const res = await request('turn:end'); note('boardNote', res.ok ? '' : res.error.message); };
  $('m').onclick = () => { clueN = Math.max(0, clueN - 1); $('n').textContent = clueN || '∞'; };
  $('pl').onclick = () => { clueN = Math.min(9, clueN + 1); $('n').textContent = clueN || '∞'; };
  $('send').onclick = sendClue;
  $('word').onkeydown = (e) => { if (e.key === 'Enter') sendClue(); };
  setInterval(tickTimer, 250);
}

export function tickTimer() {
  const v = state.view, box = $('timer');
  if (!v || v.phase !== 'play' || !v.turnEndsAt || !v.settings?.timer) { box.hidden = true; return; }
  box.hidden = false;
  const left = v.turnEndsAt - now(), total = v.settings.timer * 1000;
  $('tFill').style.width = Math.max(0, Math.min(1, left / total)) * 100 + '%';
  box.classList.toggle('low', left <= 10000);
  const s = Math.max(0, Math.ceil(left / 1000));
  $('tTxt').textContent = `${TEAM[v.turn].g} ${s}s`;
  if (left > 0 && left <= 10000 && s !== lastTick) { lastTick = s; sfx.tick(); }
}

export function renderBoard({ view: v }) {
  const live = v && v.phase !== 'lobby';
  $('boardEmpty').hidden = !!live;
  $('boardMain').style.display = live ? 'grid' : 'none';
  if (!live) return;
  const c = perms(v), p = me(), over = v.phase === 'over', key = v.key;

  $('cr').textContent = v.remaining.r;
  $('cb').textContent = v.remaining.b;
  $('grid').innerHTML = v.words.map((w, i) => {
    const r = v.revealed[i], t = r ? r.type : key ? key[i] : '';
    return `<button class="card${r ? ' rev' : ''}${key ? ' key' : ''}" data-i="${i}"${t ? ` data-t="${t}"` : ''}${!c.guess || r ? ' disabled' : ''} aria-label="${esc(w)}${t ? ', ' + ({ r: 'red', b: 'blue', n: 'neutral', x: 'assassin' }[t]) : ''}${r ? ', revealed' : ''}"><span class="mk">${t ? MK[t] : ''}</span><span class="w">${esc(w)}</span></button>`;
  }).join('');

  const cl = v.clue, t = $('turn');
  t.className = 'turn ' + (over ? '' : v.turn);
  t.textContent = over ? 'Game over' : `${TEAM[v.turn].g} ${TEAM[v.turn].n} team · ` +
    (cl ? `clue ${cl.word} ${cl.number} · ${cl.number === 0 ? 'no limit' : Math.max(0, cl.number + 1 - v.guessesThisTurn) + ' guesses left'}` : 'waiting for the spymaster');

  let rl = 'Spectating. Join a team in the lobby before the next game.';
  if (p?.team) rl = `You are the ${TEAM[p.team].n} ${p.role}. ` + (over ? '' :
    c.guess ? 'Tap a word to guess it.' : c.clue ? 'Send your clue below.' :
    p.team === v.turn ? (p.role === 'agent' ? 'Waiting for your spymaster.' : 'Your agents are guessing.') : 'The other team is playing.');
  $('roleLine').textContent = rl;

  $('bEnd').hidden = !c.end;
  $('clueForm').hidden = !c.clue;
  $('clueForm').querySelector('#send').className = 'btn ' + (v.turn || 'r');
  $('n').textContent = clueN || '∞';
  $('log').innerHTML = v.log.length ? v.log.map((e) =>
    `<div class="p"><span><span class="${e.team}-t">${TEAM[e.team].g}</span> ${esc(e.word)} · ${e.number}</span><span class="tag">${esc(playerName(e.by))} · ${e.hits} hit${e.hits === 1 ? '' : 's'}</span></div>`
  ).join('') : '<span class="cap">No clues yet</span>';
  tickTimer();
}
