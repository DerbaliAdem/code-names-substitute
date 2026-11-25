/**
 * Builds what one player is allowed to see. The ONLY place that decides who sees the key.
 */
import { computeStats, remaining } from './game.js';
import type { PlayerInternal, Room } from './rooms.js';
import type { Player, RoomView } from './types.js';

type SharedView = Omit<RoomView, 'you' | 'key'>;

function publicPlayer(room: Room, p: PlayerInternal): Player {
  return {
    id: p.id,
    name: p.name,
    alias: p.alias,
    color: p.color,
    badge: p.badge,
    team: p.team,
    role: p.role,
    connected: p.sockets.size > 0,
    isHost: p.id === room.hostId,
  };
}

/** The part that is the same for everyone. Built once per broadcast. */
export function buildSharedView(room: Room, now: number): SharedView {
  const { game } = room;
  return {
    code: room.code,
    phase: game.phase,
    players: [...room.players.values()].map((p) => publicPlayer(room, p)),
    settings: room.settings,
    words: [...game.words],
    revealed: Object.fromEntries(game.revealed),
    first: game.first,
    turn: game.turn,
    turnNo: game.turnNo,
    clue: game.clue,
    guessesThisTurn: game.guessesThisTurn,
    turnEndsAt: room.turnEndsAt,
    serverNow: now,
    remaining: remaining(game),
    log: [...game.log],
    over: game.over,
    stats: game.phase === 'over' ? computeStats(game) : null,
  };
}

function canSeeKey(room: Room, playerId: string): boolean {
  if (room.game.phase === 'over') return true;
  return room.game.phase === 'play' && room.players.get(playerId)?.role === 'spymaster';
}

export function buildView(
  room: Room,
  playerId: string,
  now: number,
  shared: SharedView = buildSharedView(room, now),
): RoomView {
  return { ...shared, you: playerId, key: canSeeKey(room, playerId) ? [...room.game.key] : null };
}
