import { beforeEach, describe, expect, it } from 'vitest';
import { giveClue, guess } from '../src/game.js';
import { RoomStore, type PlayerInternal, type Room } from '../src/rooms.js';
import { buildView } from '../src/view.js';
import { fakeClock, profile } from './helpers.js';

const NOW = 5_000;
let store: RoomStore;
let room: Room;
let rs: PlayerInternal;
let ra: PlayerInternal;
let bs: PlayerInternal;
let ba: PlayerInternal;
let spectator: PlayerInternal;

const view = (p: PlayerInternal) => buildView(room, p.id, NOW);
const everyone = () => [rs, ra, bs, ba, spectator];

beforeEach(() => {
  const clock = fakeClock();
  store = new RoomStore({ now: clock.now, schedule: clock.schedule });
  ({ room, player: rs } = store.create(profile('rs'), 's0'));
  ra = store.join(room.code, profile('ra'), 's1').player;
  bs = store.join(room.code, profile('bs'), 's2').player;
  ba = store.join(room.code, profile('ba'), 's3').player;
  spectator = store.join(room.code, profile('sp'), 's4').player;
  store.takeSeat(room, rs.id, 'r', 'spymaster');
  store.takeSeat(room, ra.id, 'r', 'agent');
  store.takeSeat(room, bs.id, 'b', 'spymaster');
  store.takeSeat(room, ba.id, 'b', 'agent');
});

function finish() {
  store.start(room, rs.id);
  const [spy, agent] = room.game.turn === 'r' ? [rs, ra] : [bs, ba];
  store.setGame(room, giveClue(room.game, spy, 'zzz', 1));
  store.setGame(room, guess(room.game, agent, room.game.key.indexOf('x')).state);
}

describe('buildView', () => {
  it('hides the key from everyone in the lobby, spymasters included', () => {
    for (const p of everyone()) expect(view(p).key).toBeNull();
  });

  it('shows the key only to spymasters during play', () => {
    store.start(room, rs.id);
    for (const p of [rs, bs]) expect(view(p).key).toEqual(room.game.key);
    for (const p of [ra, ba, spectator]) expect(view(p).key).toBeNull();
    expect(buildView(room, 'stranger', NOW).key).toBeNull();
  });

  it('shows the key and the stats to everyone after the game', () => {
    finish();
    for (const p of everyone()) {
      expect(view(p).key).toEqual(room.game.key);
      expect(view(p).stats).toMatchObject({ turns: 1, found: { r: 0, b: 0 } });
      expect(view(p).over?.reason).toBe('assassin');
    }
  });

  it('hides the new key again after a rematch', () => {
    finish();
    store.rematch(room, rs.id);
    for (const p of everyone()) expect(view(p)).toMatchObject({ key: null, stats: null, over: null, revealed: {} });
  });

  it('never contains a token or a socket id', () => {
    store.start(room, rs.id);
    const json = JSON.stringify(view(ra));
    for (const p of room.players.values()) expect(json).not.toContain(p.token);
    expect(json).not.toContain('"sockets"');
    expect(json).not.toMatch(/"s\d"/);
  });

  it('tells each player who they are and who the host is, in join order', () => {
    expect(view(ba).you).toBe(ba.id);
    expect(view(ba).players.map((p) => p.name)).toEqual(['rs', 'ra', 'bs', 'ba', 'sp']);
    expect(view(ba).players.map((p) => p.isHost)).toEqual([true, false, false, false, false]);
  });

  it('reports connection state', () => {
    store.detach(room, ra.id, 's1');
    expect(view(rs).players[1]).toMatchObject({ id: ra.id, connected: false });
  });

  it('has exactly the fields of the contract', () => {
    const fields =
      'clue code first guessesThisTurn key log over phase players remaining revealed serverNow settings stats ' +
      'turn turnEndsAt turnNo words you';
    expect(Object.keys(view(ra)).sort()).toEqual(fields.split(' '));
    expect(Object.keys(view(ra).players[0]!).sort()).toEqual(
      'alias badge color connected id isHost name role team'.split(' '),
    );
  });

  it('carries the server clock and JSON-safe revealed cards', () => {
    finish();
    const v = view(ra);
    expect(v.serverNow).toBe(NOW);
    expect(JSON.parse(JSON.stringify(v.revealed))).toEqual({
      [room.game.key.indexOf('x')]: { type: 'x', team: room.game.turn, by: v.over!.by, clueId: 'c1' },
    });
  });
});
