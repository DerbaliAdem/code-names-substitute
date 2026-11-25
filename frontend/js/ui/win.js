import { $, esc, note, TEAM } from '../store.js';
import { me, playerName } from '../state.js';
import { request } from '../net.js';

export function initWin() {
  $('bRematch').onclick = async () => { const res = await request('game:rematch'); note('winNote', res.ok ? '' : res.error.message); };
}

export function renderWin({ view: v }) {
  const o = v?.phase === 'over' ? v.over : null;
  $('winMain').hidden = !o;
  $('winEmpty').hidden = !!o;
  if (!o) { $('winH').textContent = 'NO WINNER YET'; $('winP').textContent = 'Finish a game to see the report'; $('winBurst').className = 'burst'; return; }
  $('winBurst').className = 'burst w' + o.winner;
  $('winH').textContent = TEAM[o.winner].n.toUpperCase() + ' WINS!';
  $('winP').textContent = o.reason === 'assassin' ? `${playerName(o.by)} tapped the assassin` : 'Every word found';
  const s = v.stats || { turns: v.turnNo, found: { r: 0, b: 0 }, topFinders: [], bestClue: null };
  $('stT').textContent = s.turns;
  $('stR').textContent = s.found.r;
  $('stB').textContent = s.found.b;
  $('mvp').innerHTML = s.topFinders.length ? s.topFinders.map((f, k) =>
    `<div class="p${k ? '' : ' you'}"><span>${esc(playerName(f.playerId))}</span><span class="tag">${f.count} word${f.count === 1 ? '' : 's'}</span></div>`).join('')
    : '<span class="cap">Nobody found a word</span>';
  const b = s.bestClue;
  $('best').innerHTML = b && b.hits ? `<div class="p you"><span>${TEAM[b.team].g} ${esc(b.word)} · ${b.number}</span><span class="tag">${b.hits} hit${b.hits === 1 ? '' : 's'} · ${esc(playerName(b.by))}</span></div>`
    : '<span class="cap">No clue scored</span>';
  const host = !!me()?.isHost;
  $('bRematch').disabled = !host;
  $('bRematch').textContent = host ? 'Rematch, same room' : 'Waiting for the host to rematch';
}
