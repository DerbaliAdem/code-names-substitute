// Types from docs/PROTOCOL.md §4. Keep in sync with the contract.
export type Team = 'r' | 'b';
export type Role = 'spymaster' | 'agent';
export type Card = 'r' | 'b' | 'n' | 'x';
export type Phase = 'lobby' | 'play' | 'over';

export interface Profile { name: string; alias: string; color: string; badge: string }
export interface Player extends Profile { id: string; team: Team | null; role: Role | null; connected: boolean; isHost: boolean }
export interface Reveal { type: Card; team: Team; by: string; clueId: string | null }
export interface Clue { id: string; word: string; number: number; team: Team; by: string; hits: number }
export interface Settings { timer: number } // seconds per turn: 0 = off, otherwise 15–600

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
  over: null | { winner: Team; reason: 'cleared' | 'assassin'; by: string };
  stats: null | {
    turns: number;
    found: { r: number; b: number };
    topFinders: { playerId: string; count: number }[];
    bestClue: Clue | null;
  };
}

export type AckErr = { ok: false; error: { code: string; message: string } };
export type Ack<T = {}> = ({ ok: true } & T) | AckErr;
export type JoinAck = Ack<{ code: string; playerId: string; token: string }>;

export const TEAM = { r: { n: 'Red', g: '▲' }, b: { n: 'Blue', g: '●' } } as const;
export const MARK: Record<Card, string> = { r: '▲', b: '●', n: '–', x: '✖' };
export const other = (t: Team): Team => (t === 'r' ? 'b' : 'r');
