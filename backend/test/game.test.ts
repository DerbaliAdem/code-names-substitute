import { describe, expect, it } from 'vitest';
import { GameError } from '../src/errors.js';
import {
  computeStats,
  endTurn,
  expireTurn,
  giveClue,
  guess,
  newGame,
  readiness,
  remaining,
  startGame,
  type Actor,
  type GameState,
} from '../src/game.js';
import type { Card, ErrorCode, Team } from '../src/types.js';
import { WORDS } from '../src/words.js';

const redSpy: Actor = { id: 'rs', team: 'r', role: 'spymaster' };
const redAgent: Actor = { id: 'ra', team: 'r', role: 'agent' };
const redAgent2: Actor = { id: 'ra2', team: 'r', role: 'agent' };
const blueSpy: Actor = { id: 'bs', team: 'b', role: 'spymaster' };
const blueAgent: Actor = { id: 'ba', team: 'b', role: 'agent' };
const spectator: Actor = { id: 'sp', team: null, role: null };
const SEATS: Actor[] = [redSpy, redAgent, blueSpy, blueAgent];

/** 0-8 red, 9-16 blue, 17-23 neutral, 24 assassin. */
const KEY: Card[] = [
  ...Array<Card>(9).fill('r'),
  ...Array<Card>(8).fill('b'),
  ...Array<Card>(7).fill('n'),
  'x',
];
const BOARD = (
  'OCEAN CASTLE DRAGON FALCON PIANO HOTEL ROBOT QUEEN LASER BRIDGE CLOCK DOCTOR EAGLE HELMET ' +
  'ISLAND JUNGLE KNIFE MOON NEEDLE ORBIT PARK RADIO SNOW TOWER INK'
).split(' ');

function playing(over: Partial<GameState> = {}): GameState {
  const base: GameState = { ...newGame(), words: BOARD, key: KEY, first: 'r', turn: 'r' };
  return { ...startGame(base, SEATS), ...over };
}
const withClue = (number = 2, state = playing()) => giveClue(state, redSpy, 'zebra', number);

function code(fn: () => unknown): ErrorCode | 'none' {
  try {
    fn();
    return 'none';
  } catch (err) {
    if (err instanceof GameError) return err.code;
    throw err;
  }
}

/** Reveals cards directly, for set-up only. */
function reveal(state: GameState, indexes: number[], team: Team = 'r', by = 'ra'): GameState {
  const revealed = new Map(state.revealed);
  for (const i of indexes) revealed.set(i, { type: state.key[i]!, team, by, clueId: null });
  return { ...state, revealed };
}

describe('newGame', () => {
  it('deals 25 distinct words from the list, in the lobby phase', () => {
    const g = newGame();
    expect(new Set(g.words).size).toBe(25);
    expect(g.words.every((w) => WORDS.includes(w))).toBe(true);
    expect(g).toMatchObject({ phase: 'lobby', turnNo: 1, clue: null, guessesThisTurn: 0, over: null, log: [] });
  });

  it('gives 9 cards to the starting team, 8 to the other, 7 neutral and 1 assassin', () => {
    const starters = new Set<Team>();
    for (let i = 0; i < 100; i++) {
      const g = newGame();
      starters.add(g.first);
      const count = (c: Card) => g.key.filter((k) => k === c).length;
      expect(g.turn).toBe(g.first);
      expect([count(g.first), count(g.first === 'r' ? 'b' : 'r'), count('n'), count('x')]).toEqual([9, 8, 7, 1]);
    }
    expect(starters.size).toBe(2);
  });

  it('draws words and shuffles the key with unbiased Fisher-Yates ranges', () => {
    const ranges: number[] = [];
    newGame((max) => {
      ranges.push(max);
      return 0;
    });
    expect(ranges[0]).toBe(2); // which team starts
    expect(ranges.slice(1, 26)).toEqual(Array.from({ length: 25 }, (_, i) => WORDS.length - i));
    expect(ranges.slice(26)).toEqual(Array.from({ length: 25 }, (_, i) => 25 - i));
  });

  it('can place the assassin anywhere on the board', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(newGame().key.indexOf('x'));
    expect(seen.size).toBe(25);
  });
});

describe('startGame', () => {
  it('moves to play with the first team to move', () => {
    const g = startGame(newGame(), SEATS);
    expect(g).toMatchObject({ phase: 'play', turnNo: 1, clue: null });
    expect(g.turn).toBe(g.first);
  });

  it.each<[string, Actor[], RegExp]>([
    ['no red spymaster', [redAgent, blueSpy, blueAgent], /red.*spymaster/i],
    ['no red agent', [redSpy, blueSpy, blueAgent], /red.*agent/i],
    ['no blue spymaster', [redSpy, redAgent, blueAgent], /blue.*spymaster/i],
    ['no blue agent', [redSpy, redAgent, blueSpy], /blue.*agent/i],
    ['two red spymasters', [...SEATS, { ...redSpy, id: 'rs2' }], /red.*one spymaster/i],
  ])('is refused with %s', (_, seats, message) => {
    expect(readiness(seats)).toMatch(message);
    expect(code(() => startGame(newGame(), seats))).toBe('NOT_READY');
  });

  it('accepts extra agents and spectators', () => {
    expect(readiness([...SEATS, redAgent2, spectator])).toBeNull();
  });

  it('is refused once the game is running', () => {
    expect(code(() => startGame(playing(), SEATS))).toBe('WRONG_PHASE');
  });
});

describe('giveClue', () => {
  it('stores the clue uppercased and trimmed and logs it', () => {
    const g = giveClue(playing(), redSpy, '  zebra ', 3);
    expect(g.clue).toEqual({ id: 'c1', word: 'ZEBRA', number: 3, team: 'r', by: 'rs', hits: 0 });
    expect(g.log).toEqual([g.clue]);
  });

  it('does not mutate the previous state', () => {
    const before = playing();
    giveClue(before, redSpy, 'zebra', 1);
    expect(before.clue).toBeNull();
    expect(before.log).toEqual([]);
  });

  it('numbers clues across turns', () => {
    const g = guess(withClue(), redAgent, 17).state;
    expect(giveClue(g, blueSpy, 'yak', 1).clue?.id).toBe('c2');
  });

  it.each<[string, Actor]>([
    ['the other spymaster', blueSpy],
    ['an agent of the team', redAgent],
    ['a spectator', spectator],
  ])('is refused from %s', (_, actor) => {
    expect(code(() => giveClue(playing(), actor, 'zebra', 1))).toBe('NOT_YOUR_TURN');
  });

  it('is refused outside play', () => {
    expect(code(() => giveClue(newGame(), redSpy, 'zebra', 1))).toBe('WRONG_PHASE');
  });

  it('is refused while a clue is active', () => {
    expect(code(() => giveClue(withClue(), redSpy, 'yak', 1))).toBe('CLUE_ACTIVE');
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['two words', 'sea horse'],
    ['two words joined by a tab', 'sea\thorse'],
    ['two words joined by a non-breaking space', 'sea horse'],
    ['only punctuation', '!!!'],
    ['only invisible characters', '​​'],
    ['too long', 'A'.repeat(33)],
    ['a board word', 'ocean'],
    ['part of a board word', 'oce'],
    ['a longer word containing a board word', 'oceanic'],
    ['a board word split by punctuation', 'o-c-e-a-n'],
    ['a board word hiding a zero-width character', 'oc​ean'],
    ['a board word in full-width letters', 'ＯＣＥＡＮ'],
    ['a board word with accents', 'océan'],
  ])('rejects a clue that is %s', (_, word) => {
    expect(code(() => giveClue(playing(), redSpy, word, 1))).toBe('INVALID_CLUE');
  });

  it('allows an overlap of two letters or fewer', () => {
    expect(code(() => giveClue(playing(), redSpy, 'in', 1))).toBe('none');
  });

  it.each(['صحراء', 'été', 'sci-fi', 'd’accord', '007'])(
    'allows the clue %s',
    (word) => {
      expect(code(() => giveClue(playing(), redSpy, word, 1))).toBe('none');
    },
  );

  it('allows a word that is already revealed', () => {
    expect(code(() => giveClue(reveal(playing(), [0]), redSpy, 'ocean', 1))).toBe('none');
  });

  it.each([-1, 10, 1.5, Infinity, NaN])('rejects the number %s', (n) => {
    expect(code(() => giveClue(playing(), redSpy, 'zebra', n))).toBe('INVALID_NUMBER');
  });

  it('rejects a number above the remaining cards of the team', () => {
    const g = reveal(playing(), [0, 1, 2, 3, 4, 5, 6]);
    expect(code(() => giveClue(g, redSpy, 'zebra', 3))).toBe('INVALID_NUMBER');
    expect(code(() => giveClue(g, redSpy, 'zebra', 2))).toBe('none');
    expect(code(() => giveClue(g, redSpy, 'zebra', 0))).toBe('none');
  });
});

describe('guess', () => {
  it('keeps the turn on an own card and credits the clue', () => {
    const { state, result, turnEnded } = guess(withClue(2), redAgent, 0);
    expect(result).toBe('r');
    expect(turnEnded).toBe(false);
    expect(state.guessesThisTurn).toBe(1);
    expect(state.turn).toBe('r');
    expect(state.revealed.get(0)).toEqual({ type: 'r', team: 'r', by: 'ra', clueId: 'c1' });
    expect(state.clue?.hits).toBe(1);
    expect(state.log[0]?.hits).toBe(1);
  });

  it('does not mutate the previous state', () => {
    const before = withClue();
    guess(before, redAgent, 0);
    expect(before.revealed.size).toBe(0);
    expect(before.log[0]?.hits).toBe(0);
  });

  it('ends the turn after number + 1 correct guesses', () => {
    const first = guess(withClue(1), redAgent, 0).state;
    expect(first.turn).toBe('r');
    const second = guess(first, redAgent, 1);
    expect(second.turnEnded).toBe(true);
    expect(second.state).toMatchObject({ turn: 'b', turnNo: 2, clue: null, guessesThisTurn: 0 });
  });

  it('never ends the turn by count when the number is 0', () => {
    let g = withClue(0);
    for (let i = 0; i < 8; i++) g = guess(g, redAgent, i).state;
    expect(g).toMatchObject({ turn: 'r', guessesThisTurn: 8 });
  });

  it.each([
    ['neutral', 17, 'n'],
    ['opponent', 9, 'b'],
  ] as const)('ends the turn at once on a %s card', (_, index, card) => {
    const { state, result, turnEnded } = guess(withClue(3), redAgent, index);
    expect(result).toBe(card);
    expect(turnEnded).toBe(true);
    expect(state).toMatchObject({ phase: 'play', turn: 'b', turnNo: 2, clue: null });
    expect(state.log[0]?.hits).toBe(0);
  });

  it('gives the win to the other team on the assassin', () => {
    const { state, turnEnded } = guess(withClue(), redAgent, 24);
    expect(state).toMatchObject({ phase: 'over', over: { winner: 'b', reason: 'assassin', by: 'ra' } });
    expect(turnEnded).toBe(false);
  });

  it('wins when the last own card is found, even on the final allowed guess', () => {
    let g = withClue(1, reveal(playing(), [0, 1, 2, 3, 4, 5, 6]));
    g = guess(g, redAgent, 7).state;
    g = guess(g, redAgent, 8).state;
    expect(g).toMatchObject({ phase: 'over', turn: 'r', over: { winner: 'r', reason: 'cleared', by: 'ra' } });
  });

  it('gives the opponent the win when their last card is revealed', () => {
    const g = withClue(1, reveal(playing(), [9, 10, 11, 12, 13, 14, 15], 'b', 'ba'));
    expect(guess(g, redAgent, 16).state.over).toEqual({ winner: 'b', reason: 'cleared', by: 'ra' });
  });

  it.each<[string, Actor]>([
    ['the spymaster', redSpy],
    ['the other team', blueAgent],
    ['a spectator', spectator],
  ])('is refused from %s', (_, actor) => {
    expect(code(() => guess(withClue(), actor, 0))).toBe('NOT_YOUR_TURN');
  });

  it('is refused before a clue', () => {
    expect(code(() => guess(playing(), redAgent, 0))).toBe('NO_CLUE');
  });

  it('is refused in the lobby and after the game', () => {
    const over = guess(withClue(), redAgent, 24).state;
    expect(code(() => guess(newGame(), redAgent, 0))).toBe('WRONG_PHASE');
    expect(code(() => guess(over, redAgent, 0))).toBe('WRONG_PHASE');
  });

  it('is refused on a revealed card', () => {
    const g = guess(withClue(), redAgent, 0).state;
    expect(code(() => guess(g, redAgent, 0))).toBe('ALREADY_REVEALED');
  });

  it.each([-1, 25, 1.2])('is refused for index %s', (i) => {
    expect(code(() => guess(withClue(), redAgent, i))).toBe('BAD_REQUEST');
  });
});

describe('endTurn and expireTurn', () => {
  it('passes the turn after at least one guess', () => {
    const g = guess(withClue(), redAgent, 0).state;
    expect(endTurn(g, redAgent)).toMatchObject({ turn: 'b', turnNo: 2, clue: null, guessesThisTurn: 0 });
  });

  it('needs a clue, then a guess', () => {
    expect(code(() => endTurn(playing(), redAgent))).toBe('NO_CLUE');
    expect(code(() => endTurn(withClue(), redAgent))).toBe('NO_GUESS');
  });

  it('is for agents of the current team, during play', () => {
    const g = guess(withClue(), redAgent, 0).state;
    for (const actor of [redSpy, blueAgent, spectator]) expect(code(() => endTurn(g, actor))).toBe('NOT_YOUR_TURN');
    expect(code(() => endTurn(newGame(), redAgent))).toBe('WRONG_PHASE');
  });

  it('expires a turn without any guess', () => {
    expect(expireTurn(playing())).toMatchObject({ turn: 'b', turnNo: 2 });
    expect(code(() => expireTurn(newGame()))).toBe('WRONG_PHASE');
  });
});

describe('remaining and computeStats', () => {
  it('counts unrevealed cards per team', () => {
    expect(remaining(playing())).toEqual({ r: 9, b: 8 });
    expect(remaining(reveal(playing(), [0, 9, 17]))).toEqual({ r: 8, b: 7 });
  });

  it('reports turns, found cards, finders and the best clue', () => {
    let g = withClue(3); // c1 scores 2 hits
    g = guess(g, redAgent, 0).state;
    g = guess(g, redAgent2, 1).state;
    g = guess(g, redAgent, 9).state; // a blue card found by red: found, but not credited to the finder
    g = giveClue(g, blueSpy, 'yak', 3); // c2 scores 3 hits
    for (const i of [10, 11, 12]) g = guess(g, blueAgent, i).state;
    g = guess(g, blueAgent, 24).state;

    const stats = computeStats(g);
    expect(stats).toMatchObject({ turns: 2, found: { r: 2, b: 4 }, bestClue: { id: 'c2', hits: 3 } });
    expect(stats.topFinders).toEqual([
      { playerId: 'ba', count: 3 },
      { playerId: 'ra', count: 1 },
      { playerId: 'ra2', count: 1 },
    ]);
  });

  it('keeps only three finders and has no best clue when none scored', () => {
    let g = playing();
    for (const [i, by] of ['p1', 'p2', 'p3', 'p4'].entries()) g = reveal(g, [i], 'r', by);
    g = guess(withClue(1, g), redAgent, 24).state;
    const stats = computeStats(g);
    expect(stats.topFinders).toHaveLength(3);
    expect(stats.bestClue).toBeNull();
  });
});
