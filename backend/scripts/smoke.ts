/**
 * Plays ONE complete game against a server and prints PASS/FAIL for each step.
 * Use it to check that a server (local or the live Render one) really works end to end.
 *   npm run smoke                                   (production)
 *   npm run smoke -- http://localhost:3000          (local)
 * The free Render instance may need up to ~60 s to wake up; the script waits for it.
 */
import { io, type Socket } from 'socket.io-client';
import type { RoomView } from '../src/types.js';

const url = (process.argv[2] ?? 'https://codenames-pulp-api.onrender.com').replace(/\/$/, '');
const profile = { name: 'Smoke', alias: 'Test', color: '#2a6bd6', badge: '*' };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failed++;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}\n`);
}

interface Ack {
  ok: boolean;
  code?: string;
  error?: { code: string; message?: string };
  result?: string;
}
interface Bot {
  socket: Socket;
  view: RoomView | null;
}

async function send(bot: Bot, event: string, payload: object = {}): Promise<Ack> {
  return (await bot.socket.timeout(10_000).emitWithAck(event, payload)) as Ack;
}

async function connect(): Promise<Bot> {
  const bot: Bot = { socket: io(url, { transports: ['websocket'], forceNew: true }), view: null };
  bot.socket.on('room:state', (view: RoomView) => (bot.view = view));
  await new Promise<void>((resolve, reject) => {
    bot.socket.once('connect', resolve);
    bot.socket.once('connect_error', reject);
  });
  return bot;
}

async function until(bot: Bot, condition: (v: RoomView) => boolean): Promise<RoomView> {
  const end = Date.now() + 10_000;
  while (!bot.view || !condition(bot.view)) {
    if (Date.now() > end) throw new Error('timed out waiting for a room:state');
    await sleep(10);
  }
  return bot.view;
}

async function wakeServer(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(15_000) });
      const body = (await res.json()) as { ok?: boolean };
      check('GET /health answers ok', res.status === 200 && body.ok === true, `${Date.now() - start} ms`);
      return;
    } catch {
      await sleep(2_000);
    }
  }
  check('GET /health answers ok', false, 'no answer in 90 s');
  process.exit(1);
}

async function main(): Promise<void> {
  await wakeServer();
  const bots: Bot[] = [];
  try {
    const [rs, ra, bs, ba] = [await connect(), await connect(), await connect(), await connect()];
    bots.push(rs, ra, bs, ba);
    check('4 players connect over WebSocket', true);

    const created = await send(rs, 'room:create', { profile });
    check('room:create', created.ok && !!created.code, created.code);
    const code = created.code!;
    const joins = await Promise.all([ra, bs, ba].map((b) => send(b, 'room:join', { code, profile })));
    check('3 players join the room', joins.every((j) => j.ok));

    const seats = await Promise.all([
      send(rs, 'seat:take', { team: 'r', role: 'spymaster' }),
      send(ra, 'seat:take', { team: 'r', role: 'agent' }),
      send(bs, 'seat:take', { team: 'b', role: 'spymaster' }),
      send(ba, 'seat:take', { team: 'b', role: 'agent' }),
    ]);
    check('4 seats taken', seats.every((s) => s.ok));

    const started = await send(rs, 'game:start');
    check('game:start', started.ok, started.error?.code);
    let view = await until(rs, (v) => v.phase === 'play');
    check('board has 25 words', view.words.length === 25);
    check('spymaster receives the key', Array.isArray(view.key) && view.key.length === 25);
    const agentView = await until(ra, (v) => v.phase === 'play');
    check('agent does NOT receive the key', agentView.key === null);

    // The first team always has 9 cards: one clue and nine correct guesses wins the game.
    const team = view.turn;
    const spy = team === 'r' ? rs : bs;
    const agent = team === 'r' ? ra : ba;
    const key = view.key!;
    const clue = await send(spy, 'clue:give', { word: 'smokeclue', number: 9 });
    check('clue:give', clue.ok, clue.error?.code);
    const wrongGuess = await send(team === 'r' ? ba : ra, 'guess', { index: 0 });
    check('guess from the other team is refused', !wrongGuess.ok && wrongGuess.error?.code === 'NOT_YOUR_TURN');

    let results = 0;
    for (let i = 0; i < 25 && results < 9; i++) {
      if (key[i] !== team) continue;
      const ack = await send(agent, 'guess', { index: i });
      if (!ack.ok || ack.result !== team) break;
      results++;
    }
    check('9 correct guesses accepted', results === 9, `${results}/9`);

    view = await until(rs, (v) => v.phase === 'over');
    check('game ends with the right winner', view.over?.winner === team && view.over.reason === 'cleared');
    check('key revealed to everyone at the end', !!(await until(ba, (v) => v.phase === 'over')).key);

    const rematch = await send(rs, 'game:rematch');
    check('game:rematch returns to lobby', rematch.ok && (await until(rs, (v) => v.phase === 'lobby')).phase === 'lobby');
  } catch (error) {
    check('game flow finished without errors', false, (error as Error).message);
  } finally {
    for (const bot of bots) bot.socket.disconnect();
  }
  process.stdout.write(failed === 0 ? '\nSERVER OK\n' : `\nSERVER HAS PROBLEMS (${failed} failed)\n`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
