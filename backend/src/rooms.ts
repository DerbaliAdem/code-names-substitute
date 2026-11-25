/**
 * In-memory rooms: membership, host, seats, turn clock and clean-up.
 * Knows nothing about Socket.IO beyond opaque socket ids.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { GameError } from './errors.js';
import { expireTurn, newGame, readiness, startGame, type GameState } from './game.js';
import type { Profile, Role, Settings, Team } from './types.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 5;
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MINUTE = 60_000;
const LOBBY_GRACE_MS = 10 * MINUTE;
const EMPTY_ROOM_MS = 30 * MINUTE;
const HOST_GRACE_MS = MINUTE;

export interface PlayerInternal extends Profile {
  readonly id: string;
  readonly token: string;
  team: Team | null;
  role: Role | null;
  /** Open sockets; the player is connected while there is at least one. */
  readonly sockets: Set<string>;
  lastSeen: number;
}

export interface Room {
  readonly code: string;
  hostId: string;
  settings: Settings;
  /** In join order. */
  readonly players: Map<string, PlayerInternal>;
  game: GameState;
  turnEndsAt: number | null;
  cancelTimer: (() => void) | null;
  readonly createdAt: number;
  /** When the last player disconnected, null while anyone is connected. */
  emptySince: number | null;
}

export interface RoomStoreOptions {
  now?: () => number;
  /** Runs a callback later and returns a function that cancels it. */
  schedule?: (run: () => void, ms: number) => () => void;
  makeCode?: () => string;
  /** Called after the turn clock ended a turn. */
  onTimeout?: (room: Room) => void;
  maxRooms?: number;
  maxPlayers?: number;
}

export interface Membership {
  room: Room;
  player: PlayerInternal;
}

function randomString(alphabet: string, length: number): string {
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

function realSchedule(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
}

const isConnected = (player: PlayerInternal) => player.sockets.size > 0;

export class RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly now: () => number;
  private readonly schedule: (run: () => void, ms: number) => () => void;
  private readonly makeCode: () => string;
  private readonly onTimeout: (room: Room) => void;
  private readonly maxRooms: number;
  private readonly maxPlayers: number;

  constructor(options: RoomStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? realSchedule;
    this.makeCode = options.makeCode ?? (() => randomString(CODE_ALPHABET, CODE_LENGTH));
    this.onTimeout = options.onTimeout ?? (() => undefined);
    this.maxRooms = options.maxRooms ?? 5000;
    this.maxPlayers = options.maxPlayers ?? 20;
  }

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  // ── membership ────────────────────────────────────────────────────────────

  create(profile: Profile, socketId: string): Membership {
    if (this.rooms.size >= this.maxRooms && !this.evictAbandonedRoom()) {
      throw new GameError('SERVER_FULL', 'The server is full. Try again in a few minutes.');
    }
    let code = this.makeCode();
    while (this.rooms.has(code)) code = this.makeCode();

    const player = this.newPlayer(profile, socketId);
    const room: Room = {
      code,
      hostId: player.id,
      settings: { timer: 0 },
      players: new Map([[player.id, player]]),
      game: newGame(),
      turnEndsAt: null,
      cancelTimer: null,
      createdAt: this.now(),
      emptySince: null,
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  join(rawCode: string, profile: Profile, socketId: string, token?: string): Membership {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = this.rooms.get(code);
    if (!room) throw new GameError('ROOM_NOT_FOUND', 'There is no room with that code.');

    let player = token === undefined ? undefined : [...room.players.values()].find((p) => p.token === token);
    if (player) {
      Object.assign(player, profile);
      player.sockets.add(socketId);
      player.lastSeen = this.now();
    } else {
      if (room.players.size >= this.maxPlayers && !this.dropGhost(room)) {
        throw new GameError('ROOM_FULL', 'That room is full.');
      }
      player = this.newPlayer(profile, socketId);
      room.players.set(player.id, player);
    }
    room.emptySince = null;
    return { room, player };
  }

  /** A socket went away. The player keeps their place. */
  detach(room: Room, playerId: string, socketId: string): void {
    const player = room.players.get(playerId);
    if (!player?.sockets.delete(socketId)) return;
    player.lastSeen = this.now();
    this.updateEmptySince(room);
  }

  /** Removes a player for good. `aborted` says why a running game had to stop, if it did. */
  leave(room: Room, playerId: string): { aborted: string | null } {
    this.removePlayer(room, playerId);
    if (room.players.size === 0) {
      this.close(room);
      return { aborted: null };
    }
    this.updateEmptySince(room);
    const aborted = room.game.phase === 'play' ? readiness(room.players.values()) : null;
    if (aborted) this.setGame(room, newGame());
    return { aborted };
  }

  private newPlayer(profile: Profile, socketId: string): PlayerInternal {
    return {
      ...profile,
      id: `p_${randomString(ID_ALPHABET, 8)}`,
      token: randomUUID(),
      team: null,
      role: null,
      sockets: new Set([socketId]),
      lastSeen: this.now(),
    };
  }

  private removePlayer(room: Room, playerId: string): void {
    if (room.hostId === playerId) room.hostId = this.nextHost(room)?.id ?? playerId;
    room.players.delete(playerId);
  }

  /** The player after the host in join order, wrapping around; connected players first. */
  private nextHost(room: Room): PlayerInternal | undefined {
    const players = [...room.players.values()];
    const at = players.findIndex((p) => p.id === room.hostId);
    const others = [...players.slice(at + 1), ...players.slice(0, at)];
    return others.find(isConnected) ?? others[0];
  }

  private updateEmptySince(room: Room): void {
    if ([...room.players.values()].some(isConnected)) room.emptySince = null;
    else room.emptySince ??= this.now();
  }

  /** Frees a place held by a disconnected player without a seat. */
  private dropGhost(room: Room): boolean {
    const ghost = [...room.players.values()]
      .filter((p) => !isConnected(p) && p.team === null)
      .sort((a, b) => a.lastSeen - b.lastSeen)[0];
    if (!ghost) return false;
    this.removePlayer(room, ghost.id);
    return true;
  }

  // ── lobby ─────────────────────────────────────────────────────────────────

  takeSeat(room: Room, playerId: string, team: Team, role: Role): void {
    const player = this.player(room, playerId);
    this.assertLobby(room, 'Seats are locked while a game is running.');
    if (role === 'spymaster') {
      const taken = [...room.players.values()].some((p) => p !== player && p.team === team && p.role === role);
      if (taken) throw new GameError('SEAT_TAKEN', 'That team already has a spymaster.');
    }
    player.team = team;
    player.role = role;
  }

  leaveSeat(room: Room, playerId: string): void {
    const player = this.player(room, playerId);
    this.assertLobby(room, 'Seats are locked while a game is running.');
    player.team = null;
    player.role = null;
  }

  updateProfile(room: Room, playerId: string, profile: Profile): void {
    Object.assign(this.player(room, playerId), profile);
  }

  updateSettings(room: Room, playerId: string, settings: Partial<Settings>): void {
    this.assertHost(room, playerId, 'Only the host can change the settings.');
    this.assertLobby(room, 'Settings can only be changed in the lobby.');
    room.settings = { ...room.settings, ...settings };
  }

  start(room: Room, playerId: string): void {
    this.assertHost(room, playerId, 'Only the host can start the game.');
    this.setGame(room, startGame(room.game, room.players.values()));
  }

  /** Stops a running game and goes back to the lobby, e.g. when a spymaster never comes back. */
  abort(room: Room, playerId: string): void {
    this.assertHost(room, playerId, 'Only the host can stop the game.');
    if (room.game.phase !== 'play') throw new GameError('WRONG_PHASE', 'No game is running.');
    this.setGame(room, newGame());
  }

  rematch(room: Room, playerId: string): void {
    this.assertHost(room, playerId, 'Only the host can start a rematch.');
    if (room.game.phase !== 'over') throw new GameError('WRONG_PHASE', 'The game is not over yet.');
    this.setGame(room, newGame());
  }

  player(room: Room, playerId: string): PlayerInternal {
    const player = room.players.get(playerId);
    if (!player) throw new GameError('NOT_IN_ROOM', 'Join a room first.');
    return player;
  }

  private assertHost(room: Room, playerId: string, message: string): void {
    if (room.hostId !== playerId) throw new GameError('NOT_HOST', message);
  }

  private assertLobby(room: Room, message: string): void {
    if (room.game.phase !== 'lobby') throw new GameError('WRONG_PHASE', message);
  }

  // ── turn clock ────────────────────────────────────────────────────────────

  /** The only way to replace the game state, so the clock always follows the turn. */
  setGame(room: Room, next: GameState): void {
    const previous = room.game;
    room.game = next;
    const sameTurn = previous.phase === 'play' && next.phase === 'play' && previous.turnNo === next.turnNo;
    if (sameTurn) return;

    this.stopClock(room);
    if (next.phase !== 'play' || room.settings.timer === 0) return;
    const ms = room.settings.timer * 1000;
    room.turnEndsAt = this.now() + ms;
    room.cancelTimer = this.schedule(() => this.expire(room), ms);
  }

  /** Ends a turn whose time is up even if the timer callback hasn't run yet. */
  flushExpiredTurn(room: Room): void {
    if (room.turnEndsAt !== null && this.now() >= room.turnEndsAt) this.expire(room);
  }

  private expire(room: Room): void {
    this.setGame(room, expireTurn(room.game));
    this.onTimeout(room);
  }

  private stopClock(room: Room): void {
    room.cancelTimer?.();
    room.cancelTimer = null;
    room.turnEndsAt = null;
  }

  // ── clean-up ──────────────────────────────────────────────────────────────

  /** Periodic housekeeping. Returns the rooms whose view changed and the rooms that were deleted. */
  sweep(): { changed: Room[]; closed: Room[] } {
    const now = this.now();
    const changed: Room[] = [];
    const closed: Room[] = [];

    for (const room of [...this.rooms.values()]) {
      let dirty = false;
      if (room.game.phase === 'lobby') {
        for (const player of [...room.players.values()]) {
          if (isConnected(player) || now - player.lastSeen <= LOBBY_GRACE_MS) continue;
          this.removePlayer(room, player.id);
          dirty = true;
        }
      }
      if (room.players.size === 0 || (room.emptySince !== null && now - room.emptySince >= EMPTY_ROOM_MS)) {
        this.close(room);
        closed.push(room);
        continue;
      }
      const host = room.players.get(room.hostId);
      if (host && !isConnected(host) && now - host.lastSeen >= HOST_GRACE_MS) {
        const next = this.nextHost(room);
        if (next && isConnected(next)) {
          room.hostId = next.id;
          dirty = true;
        }
      }
      if (dirty) changed.push(room);
    }
    return { changed, closed };
  }

  closeAll(): void {
    for (const room of [...this.rooms.values()]) this.close(room);
  }

  private close(room: Room): void {
    this.stopClock(room);
    this.rooms.delete(room.code);
  }

  private evictAbandonedRoom(): boolean {
    let oldest: Room | undefined;
    let since = Infinity;
    for (const room of this.rooms.values()) {
      if (room.emptySince !== null && room.emptySince < since) {
        oldest = room;
        since = room.emptySince;
      }
    }
    if (!oldest) return false;
    this.close(oldest);
    return true;
  }
}
