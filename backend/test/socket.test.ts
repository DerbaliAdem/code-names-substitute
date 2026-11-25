import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer, waitFor, type TestServer } from './harness.js';
import { fakeClock, profile } from './helpers.js';

let s: TestServer;
beforeEach(async () => {
  s = await startServer();
});
afterEach(async () => {
  await s.stop();
});

describe('rooms', () => {
  it('creates a room: ack with the identity first, then room:state', async () => {
    const c = await s.connect();
    const ack = await c.send('room:create', { profile: profile('Ada') });
    expect(ack).toEqual({
      ok: true,
      code: expect.stringMatching(/^[A-HJ-NP-Z]{5}$/) as string,
      playerId: expect.stringMatching(/^p_/) as string,
      token: expect.any(String) as string,
    });
    const view = await c.until((v) => v.players.length === 1);
    expect(view).toMatchObject({ code: ack.code, you: ack.playerId, phase: 'lobby', settings: { timer: 0 } });
    expect(view.players[0]).toMatchObject({ name: 'Ada', isHost: true, connected: true });
    expect(c.timeline).toEqual(['ack', 'state']);
  });

  it('works over HTTP long-polling too', async () => {
    const c = await s.connect({ transports: ['polling'] });
    expect(await c.code('room:create', { profile: profile() })).toBe('ok');
    await c.until((v) => v.players.length === 1);
  });

  it('pushes the new state to everyone when somebody joins', async () => {
    const a = await s.host();
    const b = await s.guest(a.identity.code, 'Bob');
    for (const c of [a, b]) {
      const view = await c.until((v) => v.players.length === 2);
      expect(view.players.map((p) => p.name)).toEqual(['Host', 'Bob']);
    }
    expect(a.view.you).not.toBe(b.view.you);
  });

  it('answers ROOM_NOT_FOUND and keeps the current room', async () => {
    const a = await s.host();
    expect(await a.code('room:join', { code: 'ZZZZZ', profile: profile() })).toBe('ROOM_NOT_FOUND');
    expect(await a.code('seat:take', { team: 'r', role: 'agent' })).toBe('ok');
  });

  it('reattaches a reconnecting player to the same seat', async () => {
    const { bs, rs, code } = await s.game();
    const { playerId, token } = bs.identity;
    bs.socket.disconnect();
    await rs.until((v) => v.players.some((p) => p.id === playerId && !p.connected));
    const back = await s.guest(code, 'bs', token);
    expect(back.identity.playerId).toBe(playerId);
    const view = await back.until((v) => v.phase === 'play');
    expect(view.players).toHaveLength(4);
    expect(view.key).toHaveLength(25);
    expect(view.players.find((p) => p.id === playerId)).toMatchObject({ team: 'b', role: 'spymaster', connected: true });
  });

  it('does not give a seat or the key to a stolen code with a wrong token', async () => {
    const { code } = await s.game();
    const thief = await s.guest(code, 'thief', 'not-the-token');
    const view = await thief.until((v) => v.phase === 'play');
    expect(view.key).toBeNull();
    expect(view.players.at(-1)).toMatchObject({ name: 'thief', team: null });
    expect(await thief.code('guess', { index: 0 })).toBe('NOT_YOUR_TURN');
  });

  it('joining the same room twice from one socket does not create a second player', async () => {
    const a = await s.host();
    const { playerId, code } = a.identity;
    const again = await a.send('room:join', { code, profile: profile('Renamed') });
    expect(again.playerId).toBe(playerId);
    const view = await a.until((v) => v.players[0]?.name === 'Renamed');
    expect(view.players).toHaveLength(1);
  });

  it('joining another room leaves the first one', async () => {
    const a = await s.host('A');
    const b = await s.host('B');
    const c = await s.guest(a.identity.code, 'C');
    await a.until((v) => v.players.length === 2);
    await c.send('room:join', { code: b.identity.code, profile: profile('C') });
    await a.until((v) => v.players.length === 1);
    await b.until((v) => v.players.length === 2);
    const seen = c.views.length;
    await a.send('seat:take', { team: 'r', role: 'agent' });
    await a.until((v) => v.players[0]?.team === 'r');
    expect(c.views.slice(seen).every((v) => v.code === b.identity.code)).toBe(true);
  });

  it('leaves, passes the host on and forgets the player', async () => {
    const a = await s.host('A');
    const b = await s.guest(a.identity.code, 'B');
    expect(await a.code('room:leave', {})).toBe('ok');
    const view = await b.until((v) => v.players.length === 1);
    expect(view.players[0]).toMatchObject({ name: 'B', isHost: true });
    expect(await a.code('seat:leave', {})).toBe('NOT_IN_ROOM');
    const back = await s.guest(a.identity.code, 'A', a.identity.token);
    expect(back.identity.playerId).not.toBe(a.identity.playerId);
  });

  it('keeps a player connected while another tab is open, and closes every tab on leave', async () => {
    const a = await s.host();
    const b = await s.guest(a.identity.code);
    const tab = await s.guest(a.identity.code, 'Host', a.identity.token);
    a.socket.disconnect();
    await tab.until((v) => v.players.length === 2);
    await tab.send('profile:update', { profile: profile('Still here') });
    const view = await b.until((v) => v.players[0]?.name === 'Still here');
    expect(view.players[0]?.connected).toBe(true);

    const tab2 = await s.guest(a.identity.code, 'Host', a.identity.token);
    await tab.send('room:leave', {});
    await waitFor(() => tab2.closed.length === 1);
    expect(await tab2.code('seat:leave', {})).toBe('NOT_IN_ROOM');
    expect(tab.closed).toEqual([]);
  });

  it('answers NOT_IN_ROOM to every room event before joining', async () => {
    const c = await s.connect();
    const events: [string, object][] = [
      ['room:leave', {}],
      ['profile:update', { profile: profile() }],
      ['seat:take', { team: 'r', role: 'agent' }],
      ['seat:leave', {}],
      ['settings:update', { settings: {} }],
      ['game:start', {}],
      ['game:abort', {}],
      ['game:rematch', {}],
      ['clue:give', { word: 'x', number: 1 }],
      ['guess', { index: 0 }],
      ['turn:end', {}],
    ];
    for (const [event, payload] of events) expect([event, await c.code(event, payload)]).toEqual([event, 'NOT_IN_ROOM']);
  });
});

describe('lobby', () => {
  it('updates profile, seats and settings for everyone', async () => {
    const a = await s.host();
    const b = await s.guest(a.identity.code);
    await b.send('profile:update', { profile: profile('Bea') });
    await b.send('seat:take', { team: 'b', role: 'spymaster' });
    expect(await a.code('seat:take', { team: 'b', role: 'spymaster' })).toBe('SEAT_TAKEN');
    expect(await b.code('settings:update', { settings: { timer: 90 } })).toBe('NOT_HOST');
    expect(await a.code('settings:update', { settings: { timer: 14 } })).toBe('INVALID_NUMBER');
    await a.send('settings:update', { settings: { timer: 37 } });
    await b.until((v) => v.settings.timer === 37);
    await a.send('settings:update', { settings: { timer: 90, unknown: true } });
    const view = await a.until((v) => v.settings.timer === 90);
    expect(view.settings).toEqual({ timer: 90 });
    expect(view.players[1]).toMatchObject({ name: 'Bea', team: 'b', role: 'spymaster' });
    await b.send('seat:leave', {});
    await a.until((v) => v.players[1]?.team === null);
  });

  it('keeps the timer when settings are empty', async () => {
    const a = await s.host();
    await a.send('settings:update', { settings: { timer: 45 } });
    await a.send('settings:update', { settings: {} });
    await a.send('seat:take', { team: 'r', role: 'agent' });
    expect((await a.until((v) => v.players[0]?.team === 'r')).settings.timer).toBe(45);
  });

  it('only starts a complete game, by the host', async () => {
    const a = await s.host();
    const ack = await a.send('game:start', {});
    expect(ack.error).toEqual({ code: 'NOT_READY', message: 'Red needs a spymaster.' });
    const t = await s.table();
    expect(await t.ra.code('game:start', {})).toBe('NOT_HOST');
    expect(await t.rs.code('game:start', {})).toBe('ok');
    expect(await t.rs.code('game:start', {})).toBe('WRONG_PHASE');
  });
});

describe('play', () => {
  it('sends the key to spymasters only, in every message of the game', async () => {
    const { rs, bs, ra, ba, code, spy, agent, find } = await s.game();
    const watcher = await s.guest(code, 'watcher');
    await spy.send('clue:give', { word: 'zzz', number: 2 });
    await agent.until((v) => v.clue !== null);
    await agent.send('guess', { index: find(agent.view.turn) });
    await watcher.until((v) => v.guessesThisTurn === 1);
    for (const c of [rs, bs]) expect(c.view.key).toHaveLength(25);
    for (const c of [ra, ba, watcher]) expect(c.views.every((v) => v.key === null)).toBe(true);
  });

  it('runs a turn: clue, guess, voluntary end; each hint comes right before its state', async () => {
    const { spy, agent, otherAgent, otherSpy, find } = await s.game();
    const team = spy.view.turn;
    expect(agent.events.at(-1)).toEqual({ kind: 'start', data: { first: spy.view.first } });
    agent.timeline = [];

    expect(await spy.code('clue:give', { word: ' zzz ', number: 2 })).toBe('ok');
    await agent.until((v) => v.clue?.word === 'ZZZ');
    const index = find(team);
    expect(await agent.send('guess', { index })).toEqual({ ok: true, result: team });
    const view = await agent.until((v) => v.guessesThisTurn === 1);
    expect(view.revealed[index]).toEqual({ type: team, team, by: agent.identity.playerId, clueId: 'c1' });
    expect(view.clue?.hits).toBe(1);
    expect(view.remaining[team]).toBe(8);
    expect(await agent.code('turn:end', {})).toBe('ok');
    const next = await otherAgent.until((v) => v.turn !== team);
    expect(next).toMatchObject({ turnNo: 2, clue: null, guessesThisTurn: 0 });
    await agent.until((v) => v.turn !== team);
    expect(agent.timeline.filter((x) => x !== 'ack')).toEqual(['clue', 'state', 'reveal', 'state', 'turn', 'state']);
    expect(await otherSpy.code('clue:give', { word: 'yyy', number: 1 })).toBe('ok');
  });

  it('ends the turn on a neutral card', async () => {
    const { spy, agent, find } = await s.game();
    const team = spy.view.turn;
    await spy.send('clue:give', { word: 'zzz', number: 2 });
    expect((await agent.send('guess', { index: find('n') })).result).toBe('n');
    await agent.until((v) => v.turn !== team);
    expect(agent.events.slice(-2).map((e) => e.kind)).toEqual(['reveal', 'turn']);
  });

  it('refuses every illegal move without changing the game', async () => {
    const { spy, agent, otherSpy, otherAgent, find } = await s.game();
    const index = find(spy.view.turn);
    expect(await agent.code('guess', { index })).toBe('NO_CLUE');
    expect(await agent.code('turn:end', {})).toBe('NO_CLUE');
    expect(await otherSpy.code('clue:give', { word: 'zzz', number: 1 })).toBe('NOT_YOUR_TURN');
    expect(await agent.code('clue:give', { word: 'zzz', number: 1 })).toBe('NOT_YOUR_TURN');
    expect(await spy.code('clue:give', { word: 'two words', number: 1 })).toBe('INVALID_CLUE');
    expect(await spy.code('clue:give', { word: spy.view.words[0], number: 1 })).toBe('INVALID_CLUE');
    expect(await spy.code('clue:give', { word: 'zzz', number: 10 })).toBe('INVALID_NUMBER');
    expect(await spy.code('game:rematch', {})).not.toBe('ok');
    expect(spy.view).toMatchObject({ clue: null, log: [], turnNo: 1 });

    await spy.send('clue:give', { word: 'zzz', number: 1 });
    expect(await spy.code('clue:give', { word: 'yyy', number: 1 })).toBe('CLUE_ACTIVE');
    expect(await spy.code('guess', { index })).toBe('NOT_YOUR_TURN');
    expect(await otherAgent.code('guess', { index })).toBe('NOT_YOUR_TURN');
    expect(await agent.code('turn:end', {})).toBe('NO_GUESS');
    expect(await agent.code('guess', { index: 25 })).toBe('BAD_REQUEST');
    expect(await agent.code('guess', { index })).toBe('ok');
    expect(await agent.code('guess', { index })).toBe('ALREADY_REVEALED');
    expect(await agent.code('seat:take', { team: 'r', role: 'spymaster' })).toBe('WRONG_PHASE');
    const view = await agent.until((v) => v.guessesThisTurn === 1);
    expect(Object.keys(view.revealed)).toEqual([String(index)]);
  });

  it('resolves two agents tapping the same card at once', async () => {
    const t = await s.table();
    const extra = await s.guest(t.code, 'extra');
    await extra.send('seat:take', { team: 'b', role: 'agent' });
    await t.rs.send('game:start', {});
    await t.rs.until((v) => v.phase === 'play');
    if (t.rs.view.turn !== 'b') {
      await t.rs.send('clue:give', { word: 'zzz', number: 1 });
      await t.ra.send('guess', { index: t.rs.view.key!.indexOf('n') });
      await t.bs.until((v) => v.turn === 'b');
    }
    await t.bs.send('clue:give', { word: 'yyy', number: 5 });
    const index = t.bs.view.key!.indexOf('b');
    const codes = await Promise.all([t.ba.code('guess', { index }), extra.code('guess', { index })]);
    expect(codes.sort()).toEqual(['ALREADY_REVEALED', 'ok']);
  });

  it('plays a whole game to a win, shows the report, then rematches with the same seats', async () => {
    const { rs, ra, spy, agent, otherSpy, find, all } = await s.game();
    const team = spy.view.turn;
    await spy.send('clue:give', { word: 'zzz', number: 0 });
    for (let i = 9; i > 0; i--) {
      expect((await agent.send('guess', { index: find(team) })).result).toBe(team);
      await spy.until((v) => v.remaining[team] === i - 1);
    }
    for (const c of all) {
      const view = await c.until((v) => v.phase === 'over');
      expect(view.over).toEqual({ winner: team, reason: 'cleared', by: agent.identity.playerId });
      expect(view.key).toHaveLength(25);
      expect(view.stats).toMatchObject({
        turns: 1,
        topFinders: [{ playerId: agent.identity.playerId, count: 9 }],
        bestClue: { word: 'ZZZ', hits: 9 },
      });
      expect(c.events.at(-1)?.kind).toBe('over');
    }
    expect(await otherSpy.code('clue:give', { word: 'yyy', number: 1 })).toBe('WRONG_PHASE');
    expect(await ra.code('game:rematch', {})).toBe('NOT_HOST');
    const oldWords = rs.view.words;
    expect(await rs.code('game:rematch', {})).toBe('ok');
    for (const c of all) {
      const view = await c.until((v) => v.phase === 'lobby');
      expect(view).toMatchObject({ key: null, over: null, stats: null, revealed: {}, log: [] });
      expect(view.words).not.toEqual(oldWords);
      expect(view.players.every((p) => p.team && p.role)).toBe(true);
    }
    expect(await rs.code('game:start', {})).toBe('ok');
  });

  it('ends the game on the assassin', async () => {
    const { spy, agent, find, otherSpy } = await s.game();
    await spy.send('clue:give', { word: 'zzz', number: 1 });
    expect((await agent.send('guess', { index: find('x') })).result).toBe('x');
    const view = await agent.until((v) => v.phase === 'over');
    expect(view.over).toMatchObject({ reason: 'assassin', winner: otherSpy.view.players.find((p) => p.id === otherSpy.identity.playerId)?.team });
  });

  it('lets the host abort a stuck game', async () => {
    const { rs, ra, all } = await s.game();
    expect(await ra.code('game:abort', {})).toBe('NOT_HOST');
    expect(await rs.code('game:abort', {})).toBe('ok');
    for (const c of all) {
      await c.until((v) => v.phase === 'lobby');
      expect(c.events.at(-1)?.kind).toBe('abort');
    }
  });

  it('goes back to the lobby when a spymaster leaves for good', async () => {
    const { bs, rs } = await s.game();
    await bs.send('room:leave', {});
    const view = await rs.until((v) => v.phase === 'lobby');
    expect(view.players).toHaveLength(3);
    expect(rs.events.at(-1)).toEqual({ kind: 'abort', data: { reason: 'Blue needs a spymaster.' } });
  });

  it('keeps the game when a spymaster only disconnects', async () => {
    const { bs, rs } = await s.game();
    bs.socket.disconnect();
    const view = await rs.until((v) => v.players.some((p) => !p.connected));
    expect(view.phase).toBe('play');
  });
});

describe('turn clock', () => {
  it('ends the turn on the server and announces it', async () => {
    const clock = fakeClock();
    const server = await startServer({}, { now: clock.now, schedule: clock.schedule });
    try {
      const { agent, spy } = await server.game(45);
      const { turn, turnEndsAt, serverNow } = agent.view;
      expect(turnEndsAt! - serverNow).toBe(45_000);
      agent.timeline = [];
      clock.advance(45_000);
      const view = await agent.until((v) => v.turn !== turn);
      expect(view.turnEndsAt).toBe(clock.now() + 45_000);
      expect(agent.timeline).toEqual(['timeout', 'state']);
      expect(await spy.code('clue:give', { word: 'zzz', number: 1 })).toBe('NOT_YOUR_TURN');
    } finally {
      await server.stop();
    }
  });

  it('refuses a move that arrives after the deadline but before the timer fires', async () => {
    const clock = fakeClock();
    const server = await startServer({}, { now: clock.now, schedule: clock.schedule });
    try {
      const { spy } = await server.game(45);
      clock.jump(45_000);
      expect(await spy.code('clue:give', { word: 'zzz', number: 1 })).toBe('NOT_YOUR_TURN');
      await spy.until((v) => v.turnNo === 2);
    } finally {
      await server.stop();
    }
  });
});
