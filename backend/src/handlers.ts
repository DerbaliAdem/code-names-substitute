/**
 * Socket events (docs/PROTOCOL.md §5): validate → act → acknowledge → broadcast.
 * Every decision comes from server state; the payload only says what the player wants to do.
 */
import type { Server, Socket } from 'socket.io';
import { clientIp } from './clientIp.js';
import { GameError, toAck } from './errors.js';
import { endTurn, giveClue, guess } from './game.js';
import { errorFields, type Logger } from './logger.js';
import { KeyedLimiter, TokenBucket } from './rateLimit.js';
import type { Membership, Room, RoomStore } from './rooms.js';
import { schemas, type ClientEvent, type Payload } from './schemas.js';
import type { Identity, RoomEvent, ServerToClientEvents } from './types.js';
import { buildSharedView, buildView } from './view.js';

type ClientToServerEvents = Record<string, (...args: unknown[]) => void>;

/** Which player this socket speaks for. Set only by the server. */
interface SocketData {
  session?: { code: string; playerId: string };
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** What a handler did: extra ack fields, and the rooms to broadcast with their animation hints. */
interface Result {
  ack?: object;
  changes?: { room: Room; events?: RoomEvent[] }[];
}

type Handlers = { [E in ClientEvent]: (socket: GameSocket, payload: Payload<E>) => Result };

const EVENTS_PER_SECOND = 20;
const MAX_REJECTED_EVENTS = 200;
const roomChannel = (room: Room) => `room:${room.code}`;
const playerChannel = (room: Room, playerId: string) => `player:${room.code}:${playerId}`;

export interface HandlerOptions {
  io: GameServer;
  store: RoomStore;
  logger: Logger;
  now: () => number;
  clientIpSource: string | null;
}

export class GameHandlers {
  private readonly io: GameServer;
  private readonly store: RoomStore;
  private readonly logger: Logger;
  private readonly now: () => number;
  private readonly clientIpSource: string | null;
  private readonly createLimit: KeyedLimiter;
  private readonly wrongCodeLimit: KeyedLimiter;

  constructor(options: HandlerOptions) {
    this.io = options.io;
    this.store = options.store;
    this.logger = options.logger;
    this.now = options.now;
    this.clientIpSource = options.clientIpSource;
    this.createLimit = new KeyedLimiter(20, 0.1, this.now);
    this.wrongCodeLimit = new KeyedLimiter(30, 0.5, this.now);
  }

  /** Wires up a new connection. */
  connect(socket: GameSocket): void {
    this.guardPackets(socket);
    for (const event of Object.keys(schemas) as ClientEvent[]) {
      socket.on(event, (...args: unknown[]) => this.receive(socket, event, args));
    }
    socket.on('disconnect', () => this.disconnect(socket));
  }

  /** Sends the hints, then a fresh view to every socket of the room. */
  publish(room: Room, events: RoomEvent[] = []): void {
    if (this.store.get(room.code) !== room) return;
    for (const event of events) this.io.to(roomChannel(room)).emit('room:event', event);
    const now = this.now();
    const shared = buildSharedView(room, now);
    for (const id of room.players.keys()) {
      this.io.to(playerChannel(room, id)).emit('room:state', buildView(room, id, now, shared));
    }
  }

  /** Announces a turn that was ended by the clock. */
  publishTimeout(room: Room): void {
    const { turn, turnNo } = room.game;
    this.publish(room, [{ kind: 'timeout', data: { turn, turnNo } }]);
  }

  prune(): void {
    this.createLimit.prune();
    this.wrongCodeLimit.prune();
  }

  // ── packets ───────────────────────────────────────────────────────────────

  /** Runs before any handler: rate limit and unknown events. */
  private guardPackets(socket: GameSocket): void {
    const bucket = new TokenBucket(EVENTS_PER_SECOND, EVENTS_PER_SECOND, this.now);
    let rejected = 0;
    socket.use((packet, next) => {
      const ack = splitAck(packet.slice(1)).ack;
      if (!bucket.take()) {
        ack(toAck(new GameError('RATE_LIMITED', 'Too many actions. Slow down a little.')));
        if (++rejected >= MAX_REJECTED_EVENTS) {
          this.logger.warn('socket disconnected for flooding', { socket: socket.id });
          socket.disconnect(true);
        }
        return;
      }
      rejected = 0;
      if (!Object.hasOwn(schemas, packet[0])) {
        ack(toAck(new GameError('BAD_REQUEST', 'Unknown action.')));
        return;
      }
      next();
    });
  }

  private receive<E extends ClientEvent>(socket: GameSocket, event: E, args: unknown[]): void {
    const { payload, ack } = splitAck(args);
    let result: Result;
    try {
      const parsed = schemas[event].safeParse(payload);
      if (!parsed.success) {
        throw new GameError('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'That request is not valid.');
      }
      result = this.handlers[event](socket, parsed.data as Payload<E>);
    } catch (err) {
      if (!(err instanceof GameError)) this.logger.error('handler failed', { event, ...errorFields(err) });
      ack(toAck(err));
      return;
    }
    ack({ ok: true, ...result.ack });
    for (const { room, events } of result.changes ?? []) this.publish(room, events);
  }

  private disconnect(socket: GameSocket): void {
    const session = this.findSession(socket);
    if (!session) return;
    const { room, player } = session;
    this.store.detach(room, player.id, socket.id);
    if (player.sockets.size === 0) this.publish(room);
  }

  // ── sessions ──────────────────────────────────────────────────────────────

  private findSession(socket: GameSocket): Membership | undefined {
    const { session } = socket.data;
    if (!session) return undefined;
    const room = this.store.get(session.code);
    const player = room?.players.get(session.playerId);
    return room && player ? { room, player } : undefined;
  }

  private session(socket: GameSocket): Membership {
    const session = this.findSession(socket);
    if (!session) throw new GameError('NOT_IN_ROOM', 'Join a room first.');
    return session;
  }

  private bind(socket: GameSocket, { room, player }: Membership): void {
    socket.data.session = { code: room.code, playerId: player.id };
    void socket.join([roomChannel(room), playerChannel(room, player.id)]);
  }

  private unbind(socket: GameSocket, { room, player }: Membership): void {
    delete socket.data.session;
    void socket.leave(roomChannel(room));
    void socket.leave(playerChannel(room, player.id));
  }

  /** Removes the player from their room and releases all of their sockets. */
  private leave(socket: GameSocket, membership: Membership): NonNullable<Result['changes']> {
    const { room, player } = membership;
    for (const id of player.sockets) {
      const open = this.io.sockets.sockets.get(id);
      if (!open) continue;
      this.unbind(open, membership);
      if (open !== socket) open.emit('room:closed', { reason: 'You left the room in another tab.' });
    }
    const { aborted } = this.store.leave(room, player.id);
    this.logger.debug('player left', { room: room.code, player: player.id });
    return [{ room, events: aborted ? [{ kind: 'abort', data: { reason: aborted } }] : [] }];
  }

  /** Moves the socket into a room, leaving the one it was in. */
  private enter(socket: GameSocket, next: Membership, previous: Membership | undefined): Result {
    const changes = previous && previous.player !== next.player ? this.leave(socket, previous) : [];
    this.bind(socket, next);
    const ack: Identity = { code: next.room.code, playerId: next.player.id, token: next.player.token };
    return { ack, changes: [...changes, { room: next.room }] };
  }

  private limitKey(socket: GameSocket): string {
    return clientIp(socket.request, this.clientIpSource) ?? socket.id;
  }

  /** Wraps a handler that needs a room, and broadcasts that room afterwards. */
  private inRoom<P>(act: (session: Membership, payload: P) => RoomEvent[] | void) {
    return (socket: GameSocket, payload: P): Result => {
      const session = this.session(socket);
      const events = act(session, payload) ?? [];
      return { changes: [{ room: session.room, events }] };
    };
  }

  // ── events ────────────────────────────────────────────────────────────────

  private readonly handlers: Handlers = {
    'room:create': (socket, { profile }) => {
      const previous = this.findSession(socket);
      if (!this.createLimit.take(this.limitKey(socket))) {
        throw new GameError('RATE_LIMITED', 'You created too many rooms. Wait a little.');
      }
      const next = this.store.create(profile, socket.id);
      this.logger.info('room created', { room: next.room.code, rooms: this.store.size });
      return this.enter(socket, next, previous);
    },

    'room:join': (socket, { code, profile, token }) => {
      const key = this.limitKey(socket);
      if (!this.wrongCodeLimit.available(key)) {
        throw new GameError('RATE_LIMITED', 'Too many wrong codes. Wait a little.');
      }
      const previous = this.findSession(socket);
      // Joining the room you are already in is a no-op, not a second player.
      const here = previous && this.store.find(code) === previous.room ? previous.player.token : undefined;
      try {
        const next = this.store.join(code, profile, socket.id, token ?? here);
        return this.enter(socket, next, previous);
      } catch (err) {
        if (err instanceof GameError && err.code === 'ROOM_NOT_FOUND') this.wrongCodeLimit.take(key);
        throw err;
      }
    },

    'room:leave': (socket) => ({ changes: this.leave(socket, this.session(socket)) }),

    'profile:update': this.inRoom(({ room, player }, { profile }: Payload<'profile:update'>) => {
      this.store.updateProfile(room, player.id, profile);
    }),

    'seat:take': this.inRoom(({ room, player }, { team, role }: Payload<'seat:take'>) => {
      this.store.takeSeat(room, player.id, team, role);
    }),

    'seat:leave': this.inRoom(({ room, player }) => {
      this.store.leaveSeat(room, player.id);
    }),

    'settings:update': this.inRoom(({ room, player }, { settings }: Payload<'settings:update'>) => {
      const { timer, lang } = settings;
      this.store.updateSettings(room, player.id, { ...(timer === undefined ? {} : { timer }), ...(lang === undefined ? {} : { lang }) });
    }),

    'game:start': this.inRoom(({ room, player }) => {
      this.store.start(room, player.id);
      this.logger.info('game started', { room: room.code, players: room.players.size });
      return [{ kind: 'start', data: { first: room.game.first } }];
    }),

    'game:abort': this.inRoom(({ room, player }) => {
      this.store.abort(room, player.id);
      return [{ kind: 'abort', data: { reason: 'The host stopped the game.' } }];
    }),

    'game:rematch': this.inRoom(({ room, player }, { swap }: Payload<'game:rematch'>) => {
      this.store.rematch(room, player.id, { swap });
    }),

    'clue:give': this.inRoom(({ room, player }, { word, number }: Payload<'clue:give'>) => {
      this.store.flushExpiredTurn(room);
      const next = giveClue(room.game, player, word, number);
      this.store.setGame(room, next);
      return next.clue ? [{ kind: 'clue', data: next.clue }] : [];
    }),

    guess: (socket, { index }) => {
      const { room, player } = this.session(socket);
      this.store.flushExpiredTurn(room);
      const { state, result, turnEnded } = guess(room.game, player, index);
      this.store.setGame(room, state);
      const events: RoomEvent[] = [{ kind: 'reveal', data: { index, type: result } }];
      if (turnEnded) events.push({ kind: 'turn', data: { turn: state.turn, turnNo: state.turnNo } });
      if (state.over) {
        events.push({ kind: 'over', data: state.over });
        this.logger.info('game over', { room: room.code, reason: state.over.reason, turns: state.turnNo });
      }
      return { ack: { result }, changes: [{ room, events }] };
    },

    'turn:end': this.inRoom(({ room, player }) => {
      this.store.flushExpiredTurn(room);
      const next = endTurn(room.game, player);
      this.store.setGame(room, next);
      return [{ kind: 'turn', data: { turn: next.turn, turnNo: next.turnNo } }];
    }),
  };
}

/** Separates the acknowledgement callback, if the client asked for one, from the payload. */
function splitAck(args: unknown[]): { payload: unknown; ack: (response: object) => void } {
  const last = args.at(-1);
  if (typeof last !== 'function') return { payload: args[0], ack: () => undefined };
  return { payload: args.length > 1 ? args[0] : undefined, ack: last as (response: object) => void };
}
