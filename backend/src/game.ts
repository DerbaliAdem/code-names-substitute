/**
 * Game rules (docs/RULES.md) as pure functions: each takes a state and returns a new one,
 * or throws a GameError. No I/O, no clocks, no knowledge of rooms or sockets.
 */
import { randomInt } from 'node:crypto';
import { GameError } from './errors.js';
import type { Card, Clue, Lang, Outcome, Phase, Reveal, Role, Stats, Team } from './types.js';
import { WORDS, WORDS_AR } from './words.js';

export const BOARD_SIZE = 25;
const FIRST_TEAM_CARDS = 9;
const SECOND_TEAM_CARDS = 8;
const NEUTRAL_CARDS = 7;
const MAX_CLUE_LENGTH = 32;
const MAX_CLUE_NUMBER = 9;
const TEAM_NAMES: Record<Team, string> = { r: 'Red', b: 'Blue' };

/** Whoever is trying to act, as known by the server. */
export interface Actor {
  id: string;
  team: Team | null;
  role: Role | null;
}

export interface GameState {
  readonly phase: Phase;
  readonly words: readonly string[];
  readonly key: readonly Card[];
  readonly first: Team;
  readonly turn: Team;
  readonly turnNo: number;
  readonly clue: Clue | null;
  readonly guessesThisTurn: number;
  readonly revealed: ReadonlyMap<number, Reveal>;
  readonly log: readonly Clue[];
  readonly over: Outcome | null;
}

/** Returns an integer in [0, max). */
export type RandomInt = (max: number) => number;

export const other = (team: Team): Team => (team === 'r' ? 'b' : 'r');

/** First `count` items of a Fisher–Yates shuffle, without touching the input. */
function draw<T>(items: readonly T[], count: number, random: RandomInt): T[] {
  const pool = [...items];
  for (let i = 0; i < count; i++) {
    const j = i + random(pool.length - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

export function newGame(random: RandomInt = (max) => randomInt(max), lang: Lang = 'en'): GameState {
  const first: Team = random(2) === 0 ? 'r' : 'b';
  const words = draw(lang === 'ar' ? WORDS_AR : WORDS, BOARD_SIZE, random);
  const cards: Card[] = [
    ...Array<Card>(FIRST_TEAM_CARDS).fill(first),
    ...Array<Card>(SECOND_TEAM_CARDS).fill(other(first)),
    ...Array<Card>(NEUTRAL_CARDS).fill('n'),
    'x',
  ];
  return {
    phase: 'lobby',
    words,
    key: draw(cards, BOARD_SIZE, random),
    first,
    turn: first,
    turnNo: 1,
    clue: null,
    guessesThisTurn: 0,
    revealed: new Map(),
    log: [],
    over: null,
  };
}

/** Why the game can't start (or go on) with these seats, or null if it can. */
export function readiness(seats: Iterable<Pick<Actor, 'team' | 'role'>>): string | null {
  const count = { r: { spymaster: 0, agent: 0 }, b: { spymaster: 0, agent: 0 } };
  for (const { team, role } of seats) if (team && role) count[team][role]++;
  for (const team of ['r', 'b'] as const) {
    if (count[team].spymaster === 0) return `${TEAM_NAMES[team]} needs a spymaster.`;
    if (count[team].spymaster > 1) return `${TEAM_NAMES[team]} can only have one spymaster.`;
    if (count[team].agent === 0) return `${TEAM_NAMES[team]} needs at least one agent.`;
  }
  return null;
}

export function startGame(state: GameState, seats: Iterable<Pick<Actor, 'team' | 'role'>>): GameState {
  if (state.phase !== 'lobby') throw new GameError('WRONG_PHASE', 'The game is already running.');
  const problem = readiness(seats);
  if (problem) throw new GameError('NOT_READY', problem);
  return { ...state, phase: 'play' };
}

export function remaining(state: GameState): { r: number; b: number } {
  const count = { r: 0, b: 0 };
  state.key.forEach((card, i) => {
    if ((card === 'r' || card === 'b') && !state.revealed.has(i)) count[card]++;
  });
  return count;
}

function assertTurn(state: GameState, actor: Actor, role: Role): void {
  if (state.phase === 'lobby') throw new GameError('WRONG_PHASE', 'The game has not started yet.');
  if (state.phase === 'over') throw new GameError('WRONG_PHASE', 'The game is over.');
  if (actor.team !== state.turn) throw new GameError('NOT_YOUR_TURN', 'It is not your turn.');
  if (actor.role !== role) {
    throw new GameError(
      'NOT_YOUR_TURN',
      role === 'spymaster' ? 'Only the spymaster can give a clue.' : 'Only agents can guess.',
    );
  }
}

/** Display form: composed, without control or invisible characters, uppercase. */
function cleanClue(word: string): string {
  return word.normalize('NFKC').replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}]/gu, '').trim().toUpperCase();
}

/** Comparison form: letters and digits only, so accents and punctuation can't disguise a board word. */
function skeleton(word: string): string {
  return word
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]|\u0640/gu, '') // marks and punctuation, and the Arabic tatweel (a letter in Unicode)
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // alef forms
    .replace(/\u0629/g, '\u0647') // ta marbuta as ha
    .replace(/\u0649/g, '\u064a') // alef maqsura as ya
    .toUpperCase();
}

function validateClueWord(state: GameState, raw: string): string {
  const fail = (message: string) => new GameError('INVALID_CLUE', message);
  if (raw.trim() !== '' && /\s/u.test(raw.trim())) throw fail('One word only.');
  const word = cleanClue(raw);
  const bare = skeleton(word);
  if (bare === '') throw fail('Type a one-word clue.');
  if (/\s/u.test(word)) throw fail('One word only.');
  if (word.length > MAX_CLUE_LENGTH) throw fail(`A clue can be at most ${MAX_CLUE_LENGTH} characters.`);

  const clash = state.words.some((boardWord, i) => {
    if (state.revealed.has(i)) return false;
    const target = skeleton(boardWord);
    if (target === bare) return true;
    return bare.length > 2 && target.length > 2 && (target.includes(bare) || bare.includes(target));
  });
  if (clash) throw fail('That clue matches a word on the board.');
  return word;
}

export function giveClue(state: GameState, actor: Actor, rawWord: string, number: number): GameState {
  assertTurn(state, actor, 'spymaster');
  if (state.clue) throw new GameError('CLUE_ACTIVE', 'A clue was already given this turn.');
  const word = validateClueWord(state, rawWord);
  if (!Number.isInteger(number) || number < 0 || number > MAX_CLUE_NUMBER) {
    throw new GameError('INVALID_NUMBER', `The number must be between 0 and ${MAX_CLUE_NUMBER}.`);
  }
  const left = remaining(state)[state.turn];
  if (number > left) {
    throw new GameError('INVALID_NUMBER', `You only have ${left} ${left === 1 ? 'word' : 'words'} left.`);
  }
  const clue: Clue = { id: `c${state.log.length + 1}`, word, number, team: state.turn, by: actor.id, hits: 0 };
  return { ...state, clue, guessesThisTurn: 0, log: [...state.log, clue] };
}

function nextTurn(state: GameState): GameState {
  return { ...state, turn: other(state.turn), turnNo: state.turnNo + 1, guessesThisTurn: 0, clue: null };
}

export interface GuessResult {
  state: GameState;
  result: Card;
  turnEnded: boolean;
}

export function guess(state: GameState, actor: Actor, index: number): GuessResult {
  assertTurn(state, actor, 'agent');
  if (!state.clue) throw new GameError('NO_CLUE', 'Wait for your spymaster to give a clue.');
  const result = state.key[index];
  if (result === undefined) throw new GameError('BAD_REQUEST', 'That card does not exist.');
  if (state.revealed.has(index)) throw new GameError('ALREADY_REVEALED', 'That card is already revealed.');

  const { turn } = state;
  const own = result === turn;
  const clue: Clue = own ? { ...state.clue, hits: state.clue.hits + 1 } : state.clue;
  const reveal: Reveal = { type: result, team: turn, by: actor.id, clueId: clue.id };
  const next: GameState = {
    ...state,
    clue,
    log: state.log.map((entry) => (entry.id === clue.id ? clue : entry)),
    guessesThisTurn: state.guessesThisTurn + (own ? 1 : 0),
    revealed: new Map(state.revealed).set(index, reveal),
  };
  const finish = (over: Outcome): GuessResult => ({
    state: { ...next, phase: 'over', over },
    result,
    turnEnded: false,
  });

  if (result === 'x') return finish({ winner: other(turn), reason: 'assassin', by: actor.id });
  if (result !== 'n' && remaining(next)[result] === 0) {
    return finish({ winner: result, reason: 'cleared', by: actor.id });
  }
  const outOfGuesses = clue.number > 0 && next.guessesThisTurn >= clue.number + 1;
  const turnEnded = !own || outOfGuesses;
  return { state: turnEnded ? nextTurn(next) : next, result, turnEnded };
}

export function endTurn(state: GameState, actor: Actor): GameState {
  assertTurn(state, actor, 'agent');
  if (!state.clue) throw new GameError('NO_CLUE', 'Wait for your spymaster to give a clue.');
  if (state.guessesThisTurn < 1) throw new GameError('NO_GUESS', 'Guess at least once before ending the turn.');
  return nextTurn(state);
}

/** Ends the turn because the clock ran out. */
export function expireTurn(state: GameState): GameState {
  if (state.phase !== 'play') throw new GameError('WRONG_PHASE', 'No turn is running.');
  return nextTurn(state);
}

export function computeStats(state: GameState): Stats {
  const found = { r: 0, b: 0 };
  const finders = new Map<string, number>();
  for (const { type, team, by } of state.revealed.values()) {
    if (type === 'r' || type === 'b') found[type]++;
    if (type === team) finders.set(by, (finders.get(by) ?? 0) + 1);
  }
  const topFinders = [...finders]
    .map(([playerId, count]) => ({ playerId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const bestClue = state.log.reduce<Clue | null>(
    (best, clue) => (clue.hits > (best?.hits ?? 0) ? clue : best),
    null,
  );
  return { turns: state.turnNo, found, topFinders, bestClue };
}
