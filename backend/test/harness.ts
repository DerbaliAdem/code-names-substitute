import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { loadConfig, type Config } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import { createServer, type ServerOptions } from '../src/server.js';
import type { Card, ErrorCode, Identity, RoomEvent, RoomView } from '../src/types.js';
import { profile } from './helpers.js';

export type AnyAck = {
  ok: boolean;
  error?: { code: ErrorCode; message: string };
  result?: Card;
} & Partial<Identity>;

export class Client {
  views: RoomView[] = [];
  events: RoomEvent[] = [];
  closed: string[] = [];
  /** Names of everything received, in order. */
  timeline: string[] = [];
  identity: Identity = { code: '', playerId: '', token: '' };

  constructor(readonly socket: Socket) {
    socket.on('room:state', (view: RoomView) => {
      this.views.push(view);
      this.timeline.push('state');
    });
    socket.on('room:event', (event: RoomEvent) => {
      this.events.push(event);
      this.timeline.push(event.kind);
    });
    socket.on('room:closed', ({ reason }: { reason: string }) => {
      this.closed.push(reason);
      this.timeline.push('closed');
    });
  }

  get view(): RoomView {
    const last = this.views.at(-1);
    if (!last) throw new Error('no room:state received yet');
    return last;
  }

  async send(event: string, ...payload: unknown[]): Promise<AnyAck> {
    const ack = await new Promise<AnyAck>((resolve, reject) => {
      this.socket.timeout(2000).emit(event, ...payload, (err: Error | null, response: AnyAck) => {
        this.timeline.push('ack'); // in the callback, to keep the real arrival order
        if (err) reject(err);
        else resolve(response);
      });
    });
    if (ack.ok && ack.token) this.identity = ack as Identity;
    return ack;
  }

  /** Error code of the ack, or 'ok'. */
  async code(event: string, ...payload: unknown[]): Promise<ErrorCode | 'ok'> {
    const ack = await this.send(event, ...payload);
    return ack.error?.code ?? 'ok';
  }

  async until(condition: (view: RoomView) => boolean): Promise<RoomView> {
    await waitFor(() => this.views.length > 0 && condition(this.view));
    return this.view;
  }
}

export async function waitFor(condition: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) throw new Error(`condition not met within ${ms} ms: ${condition.toString()}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export async function startServer(config: Partial<Config> = {}, options: Partial<ServerOptions> = {}) {
  const server = createServer({
    config: { ...loadConfig({}), port: 0, host: '127.0.0.1', logLevel: 'silent', ...config },
    logger: createLogger('silent'),
    ...options,
  });
  await server.start();
  const url = `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
  const open: Socket[] = [];

  const connect = async (socketOptions: Record<string, unknown> = {}): Promise<Client> => {
    const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false, ...socketOptions });
    open.push(socket);
    const client = new Client(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return client;
  };
  const host = async (name = 'Host') => {
    const client = await connect();
    await client.send('room:create', { profile: profile(name) });
    return client;
  };
  const guest = async (code: string, name = 'Guest', token?: string) => {
    const client = await connect();
    await client.send('room:join', { code, profile: profile(name), ...(token ? { token } : {}) });
    return client;
  };
  /** Four seated players; resolves once everyone has seen all the seats. */
  const table = async () => {
    const rs = await host('rs');
    const { code } = rs.identity;
    const [ra, bs, ba] = [await guest(code, 'ra'), await guest(code, 'bs'), await guest(code, 'ba')];
    await rs.send('seat:take', { team: 'r', role: 'spymaster' });
    await ra.send('seat:take', { team: 'r', role: 'agent' });
    await bs.send('seat:take', { team: 'b', role: 'spymaster' });
    await ba.send('seat:take', { team: 'b', role: 'agent' });
    const all = [rs, ra, bs, ba];
    for (const c of all) await c.until((v) => v.players.filter((p) => p.team).length === 4);
    return { code, rs, ra, bs, ba, all };
  };
  /** A started game, with players sorted by whose turn it is. */
  const game = async (timer: 0 | 45 = 0) => {
    const t = await table();
    if (timer) await t.rs.send('settings:update', { settings: { timer } });
    await t.rs.send('game:start', {});
    for (const c of t.all) await c.until((v) => v.phase === 'play');
    const red = t.rs.view.turn === 'r';
    const [spy, agent, otherSpy, otherAgent] = red ? [t.rs, t.ra, t.bs, t.ba] : [t.bs, t.ba, t.rs, t.ra];
    const key = spy.view.key!;
    /** Index of the nth unrevealed card of a type, seen from the current spymaster. */
    const find = (card: Card, n = 0) =>
      key.map((c, i) => (c === card && !spy.view.revealed[i] ? i : -1)).filter((i) => i >= 0)[n]!;
    return { ...t, spy, agent, otherSpy, otherAgent, key, find };
  };
  const stop = async () => {
    open.forEach((s) => s.disconnect());
    await server.stop();
  };
  return { server, url, connect, host, guest, table, game, stop };
}

export type TestServer = Awaited<ReturnType<typeof startServer>>;
