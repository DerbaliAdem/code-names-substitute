/**
 * Wire types. Mirrors docs/PROTOCOL.md §2, §4, §6 and §7; change the document first.
 */
export type Team = 'r' | 'b';
export type Role = 'spymaster' | 'agent';
export type Card = 'r' | 'b' | 'n' | 'x';
export type Phase = 'lobby' | 'play' | 'over';
export type Lang = 'en' | 'ar';

export interface Profile {
  name: string;
  alias: string;
  color: string;
  badge: string;
}

export interface Player extends Profile {
  id: string;
  team: Team | null;
  role: Role | null;
  connected: boolean;
  isHost: boolean;
}

export interface Reveal {
  type: Card;
  team: Team;
  by: string;
  clueId: string | null;
}

export interface Clue {
  id: string;
  word: string;
  number: number;
  team: Team;
  by: string;
  hits: number;
}

export interface Settings {
  /** Seconds per turn: 0 = off, otherwise a whole number from 15 to 600. */
  timer: number;
  /** Language of the board words. */
  lang: Lang;
}

export interface Outcome {
  winner: Team;
  reason: 'cleared' | 'assassin';
  by: string;
}

export interface Stats {
  turns: number;
  found: { r: number; b: number };
  topFinders: { playerId: string; count: number }[];
  bestClue: Clue | null;
}

export interface RoomView {
  code: string;
  phase: Phase;
  you: string;
  players: Player[];
  settings: Settings;
  words: string[];
  revealed: Record<number, Reveal>;
  key: Card[] | null;
  first: Team;
  turn: Team;
  turnNo: number;
  clue: Clue | null;
  guessesThisTurn: number;
  turnEndsAt: number | null;
  serverNow: number;
  remaining: { r: number; b: number };
  log: Clue[];
  over: Outcome | null;
  stats: Stats | null;
}

export type RoomEvent =
  | { kind: 'start'; data: { first: Team } }
  | { kind: 'clue'; data: Clue }
  | { kind: 'reveal'; data: { index: number; type: Card } }
  | { kind: 'turn'; data: { turn: Team; turnNo: number } }
  | { kind: 'timeout'; data: { turn: Team; turnNo: number } }
  | { kind: 'over'; data: Outcome }
  | { kind: 'abort'; data: { reason: string } };

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'WRONG_PHASE'
  | 'SEAT_TAKEN'
  | 'NOT_READY'
  | 'NOT_YOUR_TURN'
  | 'NO_CLUE'
  | 'CLUE_ACTIVE'
  | 'INVALID_CLUE'
  | 'INVALID_NUMBER'
  | 'ALREADY_REVEALED'
  | 'NO_GUESS'
  | 'RATE_LIMITED'
  | 'SERVER_FULL'
  | 'INTERNAL';

export interface ErrorAck {
  ok: false;
  error: { code: ErrorCode; message: string };
}

export type Ack<T extends object = object> = ({ ok: true } & T) | ErrorAck;

export interface Identity {
  code: string;
  playerId: string;
  token: string;
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
  'room:closed': (payload: { reason: string }) => void;
  'room:event': (event: RoomEvent) => void;
}
