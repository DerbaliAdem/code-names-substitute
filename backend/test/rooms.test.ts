import { beforeEach, describe, expect, it, vi } from 'vitest';
import { giveClue, guess } from '../src/game.js';
import { RoomStore, type PlayerInternal, type Room } from '../src/rooms.js';
import { codeOf, fakeClock, profile } from './helpers.js';

const MIN = 60_000;
let clock: ReturnType<typeof fakeClock>;
let onTimeout: ReturnType<typeof vi.fn<(room: Room) => void>>;
let store: RoomStore;
let sockets = 0;

beforeEach(() => {
  clock = fakeClock();
  onTimeout = vi.fn<(room: Room) => void>();
  store = new RoomStore({ now: clock.now, schedule: clock.schedule, onTimeout, maxRooms: 3, maxPlayers: 6 });
});

const sid = () => `s${sockets++}`;
const create = (name = 'Host') => store.create(profile(name), sid());
const join = (code: string, name = 'Guest', token?: string) => store.join(code, profile(name), sid(), token);

function dropAll(room: Room, player: PlayerInternal) {
  for (const s of [...player.sockets]) store.detach(room, player.id, s);
}

function seatedRoom() {
  const { room, player: rs } = create();
  const ra = join(room.code, 'ra').player;
  const bs = join(room.code, 'bs').player;
  const ba = join(room.code, 'ba').player;
  store.takeSeat(room, rs.id, 'r', 'spymaster');
  store.takeSeat(room, ra.id, 'r', 'agent');
  store.takeSeat(room, bs.id, 'b', 'spymaster');
  store.takeSeat(room, ba.id, 'b', 'agent');
  return { room, rs, ra, bs, ba };
}

function startedRoom(timer: 0 | 45 = 0) {
  const seated = seatedRoom();
  store.updateSettings(seated.room, seated.rs.id, { timer });
  store.start(seated.room, seated.rs.id);
  return seated;
}

function tapAssassin({ room, rs, ra, bs, ba }: ReturnType<typeof seatedRoom>) {
  const [spy, agent] = room.game.turn === 'r' ? [rs, ra] : [bs, ba];
  store.setGame(room, giveClue(room.game, spy, 'zzz', 1));
  store.setGame(room, guess(room.game, agent, room.game.key.indexOf('x')).state);
}

describe('create and join', () => {
  it('creates a room whose creator is the connected host', () => {
    const { room, player } = create();
    expect(room.code).toMatch(/^[A-HJ-NP-Z]{5}$/);
    expect(room.hostId).toBe(player.id);
    expect(player.id).toMatch(/^p_[A-Za-z0-9]{8}$/);
    expect(player.token.length).toBeGreaterThanOrEqual(32);
    expect(player.sockets.size).toBe(1);
    expect(room.game.phase).toBe('lobby');
    expect(store.get(room.code)).toBe(room);
  });

  it('never reuses a live code', () => {
    const codes = ['AAAAA', 'AAAAA', 'BBBBB'];
    const s = new RoomStore({ now: clock.now, schedule: clock.schedule, makeCode: () => codes.shift()! });
    expect(s.create(profile(), 'a').room.code).toBe('AAAAA');
    expect(s.create(profile(), 'b').room.code).toBe('BBBBB');
  });

  it('adds players in join order, without a seat', () => {
    const { room, player } = create();
    const guest = join(room.code).player;
    expect([...room.players.keys()]).toEqual([player.id, guest.id]);
    expect(guest).toMatchObject({ team: null, role: null });
  });

  it('accepts a code in any case and with stray separators', () => {
    const { room } = create();
    const typed = ` ${room.code.slice(0, 2).toLowerCase()}-${room.code.slice(2)} `;
    expect(join(typed).room).toBe(room);
  });

  it('reattaches to the same player with a valid token, keeping the seat', () => {
    const { room, player } = create();
    store.takeSeat(room, player.id, 'r', 'spymaster');
    dropAll(room, player);
    const back = join(room.code, 'New name', player.token);
    expect(back.player).toBe(player);
    expect(room.players.size).toBe(1);
    expect(player).toMatchObject({ name: 'New name', team: 'r', role: 'spymaster' });
    expect(player.sockets.size).toBe(1);
  });

  it('adds a new player when the token is wrong or from another room', () => {
    const a = create();
    const b = create();
    expect(join(a.room.code, 'x', 'nope').player.id).not.toBe(a.player.id);
    expect(join(a.room.code, 'x', b.player.token).player.id).not.toBe(b.player.id);
    expect(a.room.players.size).toBe(3);
  });

  it('refuses unknown rooms', () => {
    expect(codeOf(() => join('ZZZZZ'))).toBe('ROOM_NOT_FOUND');
    expect(codeOf(() => join('!!'))).toBe('ROOM_NOT_FOUND');
  });

  it('lets a new player watch a running game without a seat', () => {
    const { room } = startedRoom();
    expect(join(room.code).player.team).toBeNull();
  });

  it('refuses a full room, but always lets a known player back in', () => {
    const { room, player } = create();
    for (let i = 0; i < 5; i++) join(room.code);
    expect(codeOf(() => join(room.code))).toBe('ROOM_FULL');
    store.takeSeat(room, player.id, 'r', 'agent');
    dropAll(room, player);
    expect(codeOf(() => join(room.code))).toBe('ROOM_FULL');
    expect(join(room.code, 'x', player.token).player).toBe(player);
  });

  it('makes space in a full room by dropping a disconnected player without a seat', () => {
    const { room } = create();
    const ghosts = Array.from({ length: 5 }, () => join(room.code).player);
    dropAll(room, ghosts[2]!);
    const late = join(room.code).player;
    expect(room.players.has(ghosts[2]!.id)).toBe(false);
    expect(room.players.has(late.id)).toBe(true);
  });

  it('refuses to create past the room limit while every room is in use', () => {
    for (let i = 0; i < 3; i++) create();
    expect(codeOf(() => create())).toBe('SERVER_FULL');
  });

  it('evicts the longest-abandoned room when at the limit', () => {
    const [a, b] = [create(), create()];
    create();
    dropAll(b.room, b.player);
    clock.advance(1000);
    dropAll(a.room, a.player);
    const { room } = create();
    expect(store.get(b.room.code)).toBeUndefined();
    expect(store.get(a.room.code)).toBe(a.room);
    expect(store.get(room.code)).toBe(room);
  });
});

describe('connections', () => {
  it('stays connected while any socket is left', () => {
    const { room, player } = create();
    const second = sid();
    store.join(room.code, profile(), second, player.token);
    store.detach(room, player.id, second);
    expect(player.sockets.size).toBe(1);
    expect(room.emptySince).toBeNull();
  });

  it('records when the last player disconnects and clears it on return', () => {
    const { room, player } = create();
    dropAll(room, player);
    expect(room.emptySince).toBe(clock.now());
    join(room.code, 'x', player.token);
    expect(room.emptySince).toBeNull();
  });
});

describe('leave and host', () => {
  it('passes the host to the next player in join order', () => {
    const { room, player } = create();
    const [g1, g2] = [join(room.code).player, join(room.code).player];
    store.leave(room, player.id);
    expect(room.hostId).toBe(g1.id);
    store.leave(room, g1.id);
    expect(room.hostId).toBe(g2.id);
  });

  it('prefers a connected player as the next host', () => {
    const { room, player } = create();
    const [g1, g2] = [join(room.code).player, join(room.code).player];
    dropAll(room, g1);
    store.leave(room, player.id);
    expect(room.hostId).toBe(g2.id);
  });

  it('deletes the room when the last player leaves', () => {
    const { room, player } = create();
    store.leave(room, player.id);
    expect(store.get(room.code)).toBeUndefined();
  });

  it('starts the abandonment clock when the only connected player leaves', () => {
    const { room, player } = create();
    dropAll(room, join(room.code).player);
    store.leave(room, player.id);
    expect(room.emptySince).toBe(clock.now());
  });

  it('frees the seat of the leaver', () => {
    const { room, player } = create();
    const g = join(room.code).player;
    store.takeSeat(room, player.id, 'r', 'spymaster');
    store.leave(room, player.id);
    store.takeSeat(room, g.id, 'r', 'spymaster');
    expect(g.role).toBe('spymaster');
  });

  it('returns a running game to the lobby when a team can no longer play', () => {
    const { room, bs, rs } = startedRoom(45);
    const oldKey = room.game.key;
    const { aborted } = store.leave(room, bs.id);
    expect(aborted).toMatch(/blue.*spymaster/i);
    expect(room.game.phase).toBe('lobby');
    expect(room.game.key).not.toBe(oldKey);
    expect(room.turnEndsAt).toBeNull();
    expect(clock.pending()).toBe(0);
    expect(rs).toMatchObject({ team: 'r', role: 'spymaster' });
  });

  it('keeps the game running when a spectator or a spare agent leaves', () => {
    const { room, rs, ra } = seatedRoom();
    const spare = join(room.code).player;
    const spectator = join(room.code).player;
    store.takeSeat(room, spare.id, 'r', 'agent');
    store.start(room, rs.id);
    expect(store.leave(room, ra.id).aborted).toBeNull();
    expect(store.leave(room, spectator.id).aborted).toBeNull();
    expect(room.game.phase).toBe('play');
  });
});

describe('seats and settings', () => {
  it('allows one spymaster per team and many agents', () => {
    const { room, player } = create();
    const g = join(room.code).player;
    store.takeSeat(room, player.id, 'r', 'spymaster');
    expect(codeOf(() => store.takeSeat(room, g.id, 'r', 'spymaster'))).toBe('SEAT_TAKEN');
    store.takeSeat(room, g.id, 'b', 'spymaster');
    store.takeSeat(room, player.id, 'b', 'agent');
    store.takeSeat(room, g.id, 'b', 'agent');
    expect(player).toMatchObject({ team: 'b', role: 'agent' });
    expect(g).toMatchObject({ team: 'b', role: 'agent' });
  });

  it('lets a spymaster take the same seat again', () => {
    const { room, player } = create();
    store.takeSeat(room, player.id, 'r', 'spymaster');
    expect(codeOf(() => store.takeSeat(room, player.id, 'r', 'spymaster'))).toBe('none');
  });

  it('leaves a seat', () => {
    const { room, player } = create();
    store.takeSeat(room, player.id, 'r', 'agent');
    store.leaveSeat(room, player.id);
    expect(player).toMatchObject({ team: null, role: null });
  });

  it('locks seats and settings once the game runs', () => {
    const { room, rs, ra } = startedRoom();
    expect(codeOf(() => store.takeSeat(room, ra.id, 'b', 'agent'))).toBe('WRONG_PHASE');
    expect(codeOf(() => store.leaveSeat(room, ra.id))).toBe('WRONG_PHASE');
    expect(codeOf(() => store.updateSettings(room, rs.id, { timer: 45 }))).toBe('WRONG_PHASE');
  });

  it('only lets the host change settings, start, abort and rematch', () => {
    const { room, rs, ra } = seatedRoom();
    expect(codeOf(() => store.updateSettings(room, ra.id, { timer: 45 }))).toBe('NOT_HOST');
    expect(codeOf(() => store.start(room, ra.id))).toBe('NOT_HOST');
    store.start(room, rs.id);
    expect(codeOf(() => store.abort(room, ra.id))).toBe('NOT_HOST');
    expect(codeOf(() => store.rematch(room, ra.id))).toBe('NOT_HOST');
  });

  it('does not start an incomplete game', () => {
    const { room, player } = create();
    expect(codeOf(() => store.start(room, player.id))).toBe('NOT_READY');
  });
});

describe('abort and rematch', () => {
  it('aborts only a running game', () => {
    const { room, rs } = seatedRoom();
    expect(codeOf(() => store.abort(room, rs.id))).toBe('WRONG_PHASE');
    store.start(room, rs.id);
    store.abort(room, rs.id);
    expect(room.game.phase).toBe('lobby');
  });

  it('rematches only a finished game, with a new board and the same seats', () => {
    const seated = startedRoom();
    const { room, rs, ra } = seated;
    expect(codeOf(() => store.rematch(room, rs.id))).toBe('WRONG_PHASE');
    tapAssassin(seated);
    const oldWords = room.game.words;
    store.rematch(room, rs.id);
    expect(room.game).toMatchObject({ phase: 'lobby', turnNo: 1, over: null, log: [] });
    expect(room.game.words).not.toEqual(oldWords);
    expect(ra).toMatchObject({ team: 'r', role: 'agent' });
  });
});

describe('turn timer', () => {
  it('has no deadline when off', () => {
    const { room } = startedRoom(0);
    expect(room.turnEndsAt).toBeNull();
    expect(clock.pending()).toBe(0);
  });

  it('expires the turn, restarts the clock and reports it', () => {
    const { room } = startedRoom(45);
    const first = room.game.turn;
    expect(room.turnEndsAt).toBe(clock.now() + 45_000);
    clock.advance(44_999);
    expect(onTimeout).not.toHaveBeenCalled();
    clock.advance(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledWith(room);
    expect(room.game.turn).not.toBe(first);
    expect(room.game.turnNo).toBe(2);
    expect(room.turnEndsAt).toBe(clock.now() + 45_000);
    expect(clock.pending()).toBe(1);
  });

  it('covers the whole turn: a clue does not extend it', () => {
    const { room, rs, bs } = startedRoom(45);
    const deadline = room.turnEndsAt;
    clock.advance(10_000);
    store.setGame(room, giveClue(room.game, room.game.turn === 'r' ? rs : bs, 'zzz', 1));
    expect(room.turnEndsAt).toBe(deadline);
    expect(clock.pending()).toBe(1);
  });

  it('expires a late turn before any action is taken on it', () => {
    const { room } = startedRoom(45);
    clock.jump(45_000);
    store.flushExpiredTurn(room);
    expect(room.game.turnNo).toBe(2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    store.flushExpiredTurn(room);
    expect(room.game.turnNo).toBe(2);
    expect(clock.pending()).toBe(1);
  });

  it('stops when the game ends', () => {
    const seated = startedRoom(45);
    tapAssassin(seated);
    expect(seated.room.turnEndsAt).toBeNull();
    expect(clock.pending()).toBe(0);
  });

  it('stops when the rooms are deleted', () => {
    const { room } = startedRoom(45);
    store.closeAll();
    expect(store.size).toBe(0);
    expect(clock.pending()).toBe(0);
    expect(store.get(room.code)).toBeUndefined();
  });
});

describe('sweep', () => {
  it('removes lobby players disconnected for more than 10 minutes', () => {
    const { room } = create();
    const g = join(room.code).player;
    dropAll(room, g);
    clock.advance(10 * MIN);
    expect(store.sweep().changed).toEqual([]);
    clock.advance(1);
    expect(store.sweep().changed).toEqual([room]);
    expect(room.players.has(g.id)).toBe(false);
  });

  it('keeps disconnected players during play', () => {
    const { room, ra } = startedRoom();
    dropAll(room, ra);
    clock.advance(11 * MIN);
    store.sweep();
    expect(room.players.has(ra.id)).toBe(true);
  });

  it('deletes rooms without a connected player for 30 minutes', () => {
    const { room, rs, ra, bs, ba } = startedRoom();
    for (const p of [rs, ra, bs, ba]) dropAll(room, p);
    clock.advance(30 * MIN - 1);
    expect(store.sweep().closed).toEqual([]);
    clock.advance(1);
    expect(store.sweep().closed).toEqual([room]);
    expect(store.size).toBe(0);
  });

  it('deletes a lobby once its last player is removed', () => {
    const { room, player } = create();
    dropAll(room, player);
    clock.advance(10 * MIN + 1);
    expect(store.sweep()).toEqual({ changed: [], closed: [room] });
  });

  it('hands the host over after 60 seconds offline, if somebody is there to take it', () => {
    const { room, player } = create();
    const g = join(room.code).player;
    dropAll(room, player);
    clock.advance(59_999);
    store.sweep();
    expect(room.hostId).toBe(player.id);
    clock.advance(1);
    expect(store.sweep().changed).toEqual([room]);
    expect(room.hostId).toBe(g.id);
    dropAll(room, g);
    clock.advance(MIN);
    expect(store.sweep().changed).toEqual([]);
    expect(room.hostId).toBe(g.id);
  });
});
