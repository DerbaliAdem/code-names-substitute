/** Assembles HTTP, Socket.IO, rooms and housekeeping into one startable, stoppable server. */
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { clientIp } from './clientIp.js';
import type { Config } from './config.js';
import { GameHandlers, type GameServer } from './handlers.js';
import { createApp } from './http.js';
import { errorFields, type Logger } from './logger.js';
import { isAllowedOrigin } from './origin.js';
import { realSchedule, RoomStore, type Schedule } from './rooms.js';

const SWEEP_MS = 15_000;
const MAX_MESSAGE_BYTES = 16 * 1024;

export interface ServerOptions {
  config: Config;
  logger: Logger;
  now?: () => number;
  schedule?: Schedule;
}

export interface RunningServer {
  http: HttpServer;
  io: GameServer;
  store: RoomStore;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createServer({ config, logger, now = Date.now, schedule = realSchedule }: ServerOptions): RunningServer {
  const store: RoomStore = new RoomStore({
    now,
    schedule,
    maxRooms: config.maxRooms,
    maxPlayers: config.maxPlayers,
    onTimeout: (room) => handlers.publishTimeout(room),
  });
  const app = createApp({ corsOrigins: config.corsOrigins, roomCount: () => store.size, logger });
  const http = createHttpServer(app);
  const connectionsPerIp = new Map<string, number>();
  const ipOf = (request: IncomingMessage) => clientIp(request, config.clientIp);

  /** CORS does not apply to WebSockets, so the origin is checked here as well. */
  function admit(request: IncomingMessage): string | null {
    if (!isAllowedOrigin(request, config.corsOrigins)) return 'Origin not allowed';
    if (io.engine.clientsCount >= config.maxConnections) return 'Server full';
    const ip = ipOf(request);
    if (ip && (connectionsPerIp.get(ip) ?? 0) >= config.maxConnectionsPerIp) return 'Too many connections';
    return null;
  }

  const io: GameServer = new Server(http, {
    cors: { origin: [...config.corsOrigins] },
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
    connectTimeout: 10_000,
    serveClient: false,
    allowRequest: (request, callback) => {
      const refusal = admit(request);
      if (refusal) logger.debug('connection refused', { reason: refusal });
      callback(refusal, refusal === null);
    },
  });

  io.engine.on('connection', (connection: { request: IncomingMessage; once: (e: 'close', f: () => void) => void }) => {
    const ip = ipOf(connection.request);
    if (!ip) return;
    connectionsPerIp.set(ip, (connectionsPerIp.get(ip) ?? 0) + 1);
    connection.once('close', () => {
      const left = (connectionsPerIp.get(ip) ?? 1) - 1;
      if (left > 0) connectionsPerIp.set(ip, left);
      else connectionsPerIp.delete(ip);
    });
  });

  const handlers = new GameHandlers({ io, store, logger, now, clientIpSource: config.clientIp });
  io.on('connection', (socket) => handlers.connect(socket));

  let cancelSweep: () => void = () => undefined;
  function sweepLater(): void {
    cancelSweep = schedule(() => {
      sweepLater();
      try {
        const { changed, closed } = store.sweep();
        for (const room of changed) handlers.publish(room);
        handlers.prune();
        if (closed.length > 0) logger.info('rooms closed', { closed: closed.length, rooms: store.size });
      } catch (err) {
        logger.error('sweep failed', errorFields(err));
      }
    }, SWEEP_MS);
  }

  let stopping: Promise<void> | undefined;
  async function shutDown(): Promise<void> {
    cancelSweep();
    io.emit('room:closed', { reason: 'The server is restarting. Create a new room in a minute.' });
    store.closeAll();
    const closed = io.close();
    http.closeIdleConnections();
    await closed;
  }

  return {
    http,
    io,
    store,
    start: () =>
      new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(config.port, config.host, () => {
          http.off('error', reject);
          sweepLater();
          resolve();
        });
      }),
    stop: () => (stopping ??= shutDown()),
  };
}
