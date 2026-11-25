import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import type { Logger } from '../src/logger.js';
import { createLogger } from '../src/logger.js';
import type { ServerOptions } from '../src/server.js';
import { startServer, waitFor, type TestServer } from './harness.js';
import { fakeClock, profile } from './helpers.js';

let s: TestServer;
const start = async (config: Partial<Config> = {}, options: Partial<ServerOptions> = {}) => {
  s = await startServer(config, options);
};
afterEach(async () => {
  await s.stop();
});

describe('HTTP', () => {
  it('answers /health with the contract shape', async () => {
    await start();
    await s.host();
    const res = await fetch(`${s.url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, rooms: 1, uptime: expect.any(Number) as number });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('lets the allowed origins, and only those, read /health from a browser', async () => {
    await start();
    const get = (origin: string) => fetch(`${s.url}/health`, { headers: { origin } });
    const ok = await get('https://derbaliadem.github.io');
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://derbaliadem.github.io');
    expect(ok.headers.get('vary')).toMatch(/origin/i);
    expect((await get('https://evil.example')).headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers / and unknown paths with JSON and no server fingerprint', async () => {
    await start();
    const root = await fetch(`${s.url}/`);
    expect(await root.json()).toMatchObject({ ok: true });
    expect(root.headers.get('x-powered-by')).toBeNull();
    expect(root.headers.get('x-content-type-options')).toBe('nosniff');
    const missing = await fetch(`${s.url}/nope`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ ok: false });
  });
});

describe('connections', () => {
  it.each(['websocket', 'polling'])('refuses browsers from other sites over %s', async (transport) => {
    await start();
    const extraHeaders = { origin: 'https://evil.example' };
    await expect(s.connect({ transports: [transport], extraHeaders })).rejects.toThrow();
  });

  it('accepts browsers from an allowed site', async () => {
    await start();
    await expect(s.connect({ extraHeaders: { origin: 'http://localhost:5173' } })).resolves.toBeDefined();
  });

  it('accepts the Expo web dev server', async () => {
    await start();
    await expect(s.connect({ extraHeaders: { origin: 'http://localhost:8081' } })).resolves.toBeDefined();
  });

  it.each(['http://localhost:8082', 'http://127.0.0.1:19006', 'http://[::1]:3001'])(
    'accepts %s in local development, over every transport and for /health',
    async (origin) => {
      await start();
      for (const transport of ['websocket', 'polling']) {
        await expect(s.connect({ transports: [transport], extraHeaders: { origin } })).resolves.toBeDefined();
      }
      const health = await fetch(`${s.url}/health`, { headers: { origin } });
      expect(health.headers.get('access-control-allow-origin')).toBe(origin);
      const polling = await fetch(`${s.url}/socket.io/?EIO=4&transport=polling`, { headers: { origin } });
      expect(polling.headers.get('access-control-allow-origin')).toBe(origin);
    },
  );

  it('refuses an unlisted local origin when the server is reached under a public name', async () => {
    await start();
    const extraHeaders = { origin: 'http://localhost:8082', host: 'game.example' };
    await expect(s.connect({ extraHeaders })).rejects.toThrow();
  });

  it('refuses a site that only looks local', async () => {
    await start();
    for (const origin of ['http://localhost.evil.example', 'http://127.0.0.1.evil.example', 'http://evil.example:8081']) {
      await expect(s.connect({ extraHeaders: { origin } })).rejects.toThrow();
    }
  });

  it('accepts native apps, which send no origin or (React Native WebSockets) the address of the server itself', async () => {
    await start();
    await expect(s.connect()).resolves.toBeDefined();
    await expect(s.connect({ extraHeaders: { origin: s.url } })).resolves.toBeDefined();
    const secure = { origin: 'https://game.example', host: 'game.example' };
    await expect(s.connect({ extraHeaders: secure })).resolves.toBeDefined();
  });

  it.each(['null', 'not a url', 'https://game.example.evil.com', 'https://game.example:8443'])(
    'refuses the origin %s',
    async (origin) => {
      await start();
      await expect(s.connect({ extraHeaders: { origin, host: 'game.example' } })).rejects.toThrow();
    },
  );

  it('caps the total number of connections', async () => {
    await start({ maxConnections: 2 });
    const first = await s.connect();
    await s.connect();
    await expect(s.connect()).rejects.toThrow();
    first.socket.disconnect();
    await waitFor(() => s.server.io.engine.clientsCount === 1);
    await expect(s.connect()).resolves.toBeDefined();
  });

  it('caps connections per client address taken from the trusted header', async () => {
    await start({ clientIp: 'cf-connecting-ip', maxConnectionsPerIp: 1 });
    const from = (ip: string) => s.connect({ extraHeaders: { 'cf-connecting-ip': ip } });
    const first = await from('1.1.1.1');
    await expect(from('1.1.1.1')).rejects.toThrow();
    await expect(from('2.2.2.2')).resolves.toBeDefined();
    first.socket.disconnect();
    await waitFor(() => s.server.io.engine.clientsCount === 1);
    await expect(from('1.1.1.1')).resolves.toBeDefined();
  });

  it('does not lump everyone together when the header is missing or not configured', async () => {
    await start({ clientIp: 'cf-connecting-ip', maxConnectionsPerIp: 1 });
    await s.connect();
    await expect(s.connect()).resolves.toBeDefined();
  });

  it('drops a connection that sends an oversized message', async () => {
    await start();
    const c = await s.connect();
    c.socket.emit('room:create', { profile: { ...profile(), name: 'x'.repeat(100_000) } });
    await waitFor(() => !c.socket.connected);
  });
});

describe('hostile clients', () => {
  it('answers BAD_REQUEST to malformed payloads and survives them', async () => {
    await start();
    const c = await s.connect();
    const evil: unknown[] = [undefined, null, 1, 'x', [], {}, { profile: null }, { profile: { name: {} } }, Buffer.from('x')];
    for (const payload of evil) expect(await c.code('room:create', payload)).toBe('BAD_REQUEST');
    expect(await c.code('room:create')).toBe('BAD_REQUEST');
    expect(await c.code('room:create', JSON.parse('{"__proto__":{"profile":{}}}'))).toBe('BAD_REQUEST');
    expect(await c.code('room:create', { profile: profile() })).toBe('ok');
  });

  it('answers BAD_REQUEST to unknown events, including inherited names', async () => {
    await start();
    const c = await s.connect();
    for (const event of ['nope', 'constructor', '__proto__', 'toString']) expect(await c.code(event, {})).toBe('BAD_REQUEST');
  });

  it('handles events without an acknowledgement', async () => {
    await start();
    const c = await s.host();
    c.socket.emit('seat:take', { team: 'r', role: 'agent' });
    c.socket.emit('seat:take', { team: 'bad' });
    c.socket.emit('seat:take');
    c.socket.emit('nope');
    await c.until((v) => v.players[0]?.team === 'r');
    expect(await c.code('seat:leave')).toBe('ok');
  });

  it('cannot set protected fields through a profile', async () => {
    await start();
    const a = await s.host();
    const b = await s.guest(a.identity.code);
    await b.send('profile:update', {
      profile: { ...profile('Mallory'), id: a.identity.playerId, role: 'spymaster', team: 'r', isHost: true, token: 'x' },
    });
    const view = await a.until((v) => v.players[1]?.name === 'Mallory');
    expect(view.players[1]).toMatchObject({ id: b.identity.playerId, role: null, team: null, isHost: false });
  });

  it('rate-limits a socket to a burst of 20 events, then recovers', async () => {
    const clock = fakeClock();
    await start({}, { now: clock.now, schedule: clock.schedule });
    const c = await s.host(); // spends one
    const codes = await Promise.all(Array.from({ length: 30 }, () => c.code('seat:leave', {})));
    expect(codes.filter((x) => x === 'ok')).toHaveLength(19);
    expect(codes.filter((x) => x === 'RATE_LIMITED')).toHaveLength(11);
    clock.advance(1000);
    expect(await c.code('seat:leave', {})).toBe('ok');
  });

  it('disconnects a socket that keeps flooding', async () => {
    const clock = fakeClock();
    await start({}, { now: clock.now, schedule: clock.schedule });
    const c = await s.host();
    for (let i = 0; i < 300; i++) c.socket.emit('seat:leave', {});
    await waitFor(() => !c.socket.connected);
  });

  it('slows down guessing of room codes', async () => {
    const clock = fakeClock();
    await start({ clientIp: 'remote' }, { now: clock.now, schedule: clock.schedule });
    const real = await s.host();
    const codes: string[] = [];
    for (let k = 0; k < 4; k++) {
      const c = await s.connect(); // a fresh socket does not reset the limit
      for (let i = 0; i < 10; i++) codes.push(await c.code('room:join', { code: 'ZZZZZ', profile: profile() }));
    }
    expect(codes.slice(0, 30).every((x) => x === 'ROOM_NOT_FOUND')).toBe(true);
    expect(codes.slice(30).every((x) => x === 'RATE_LIMITED')).toBe(true);
    clock.advance(60_000);
    const late = await s.connect();
    expect(await late.code('room:join', { code: real.identity.code, profile: profile() })).toBe('ok');
  });

  it('limits how many rooms one address can create', async () => {
    const clock = fakeClock();
    await start({ clientIp: 'remote' }, { now: clock.now, schedule: clock.schedule });
    const codes: string[] = [];
    for (let i = 0; i < 25; i++) {
      const c = await s.connect();
      codes.push(await c.code('room:create', { profile: profile() }));
    }
    expect(codes.filter((x) => x === 'ok')).toHaveLength(20);
    expect(codes.slice(20).every((x) => x === 'RATE_LIMITED')).toBe(true);
  });

  it('answers INTERNAL without details when something unexpected fails, and logs it', async () => {
    const logger: Logger = { ...createLogger('silent'), error: vi.fn() };
    await start({}, { logger });
    const c = await s.host();
    vi.spyOn(s.server.store, 'leaveSeat').mockImplementation(() => {
      throw new TypeError('secret detail');
    });
    const ack = await c.send('seat:leave', {});
    expect(ack.error).toEqual({ code: 'INTERNAL', message: 'Something went wrong on the server.' });
    expect(logger.error).toHaveBeenCalledOnce();
    expect(await c.code('seat:take', { team: 'r', role: 'agent' })).toBe('ok');
  });

  it('never writes tokens to the log', async () => {
    const lines: string[] = [];
    await start({}, { logger: createLogger('debug', (line) => lines.push(line)) });
    const { rs, bs, all } = await s.game();
    await bs.send('room:leave', {});
    await rs.until((v) => v.phase === 'lobby');
    expect(lines.length).toBeGreaterThan(0);
    for (const c of all) expect(lines.join('\n')).not.toContain(c.identity.token);
  });
});

describe('housekeeping', () => {
  it('sweeps on a schedule: the host moves on and abandoned rooms go', async () => {
    const clock = fakeClock();
    await start({}, { now: clock.now, schedule: clock.schedule });
    const a = await s.host('A');
    const b = await s.guest(a.identity.code, 'B');
    a.socket.disconnect();
    await b.until((v) => v.players[0]?.connected === false);
    clock.advance(80_000);
    await b.until((v) => v.players[1]?.isHost === true);
    b.socket.disconnect();
    await waitFor(() => s.server.store.get(a.identity.code)?.emptySince != null);
    clock.advance(31 * 60_000);
    expect(s.server.store.size).toBe(0);
  });

  it('tells players when it shuts down and stops every timer', async () => {
    const clock = fakeClock();
    await start({}, { now: clock.now, schedule: clock.schedule });
    const { rs, ra } = await s.game(45);
    await s.server.stop();
    await waitFor(() => rs.closed.length === 1 && ra.closed.length === 1);
    expect(rs.closed[0]).toMatch(/restart/i);
    expect(clock.pending()).toBe(0);
    await expect(fetch(`${s.url}/health`)).rejects.toThrow();
  });

  it('can be stopped twice', async () => {
    await start();
    await Promise.all([s.server.stop(), s.server.stop()]);
  });
});
