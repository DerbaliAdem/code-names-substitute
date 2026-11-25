/**
 * Plays many four-player games at once against a running server and reports ack latency.
 *   npm run build && npm start                (terminal 1)
 *   npm run load -- [rooms] [seconds] [url]   (terminal 2)
 */
import { io, type Socket } from 'socket.io-client';
import type { RoomView } from '../src/types.js';

const rooms = Number(process.argv[2] ?? 100);
const seconds = Number(process.argv[3] ?? 10);
const url = process.argv[4] ?? 'http://localhost:3000';
const latencies: number[] = [];
const errors = new Map<string, number>();
let states = 0;
let games = 0;
let stop = false;

interface Ack {
  ok: boolean;
  code?: string;
  error?: { code: string };
}
interface Bot {
  socket: Socket;
  view: RoomView | null;
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = { name: 'Bot', alias: 'Load', color: '#2a6bd6', badge: '*' };

async function send(bot: Bot, event: string, payload: object): Promise<Ack> {
  const start = performance.now();
  const ack = (await bot.socket.timeout(10_000).emitWithAck(event, payload)) as Ack;
  latencies.push(performance.now() - start);
  if (ack.error) {
    const key = `${event}:${ack.error.code}`;
    errors.set(key, (errors.get(key) ?? 0) + 1);
  }
  return ack;
}

async function connect(): Promise<Bot> {
  const bot: Bot = { socket: io(url, { transports: ['websocket'], forceNew: true }), view: null };
  bot.socket.on('room:state', (view: RoomView) => {
    bot.view = view;
    states++;
  });
  await new Promise<void>((resolve, reject) => {
    bot.socket.once('connect', resolve);
    bot.socket.once('connect_error', reject);
  });
  return bot;
}

async function until(bot: Bot, condition: (view: RoomView) => boolean): Promise<RoomView> {
  const end = Date.now() + 10_000;
  while (!bot.view || !condition(bot.view)) {
    if (Date.now() > end) throw new Error('timed out waiting for a state');
    await sleep(5);
  }
  return bot.view;
}

async function playTurn(view: RoomView, spy: Bot, agent: Bot): Promise<RoomView> {
  const { turnNo } = view;
  await send(spy, 'clue:give', { word: `qzx${turnNo}`, number: 1 });
  const hidden = view.words.map((_, i) => i).filter((i) => !view.revealed[i]);
  await send(agent, 'guess', { index: hidden[Math.floor(Math.random() * hidden.length)] });
  const next = await until(agent, (v) => Object.keys(v.revealed).length === 25 - hidden.length + 1);
  if (next.phase !== 'play' || next.turnNo !== turnNo) return next;
  await send(agent, 'turn:end', {});
  return until(agent, (v) => v.turnNo > turnNo);
}

async function playRoom(): Promise<void> {
  const [rs, ra, bs, ba] = [await connect(), await connect(), await connect(), await connect()];
  const { code } = await send(rs, 'room:create', { profile });
  for (const guest of [ra, bs, ba]) await send(guest, 'room:join', { code, profile });
  await send(rs, 'seat:take', { team: 'r', role: 'spymaster' });
  await send(ra, 'seat:take', { team: 'r', role: 'agent' });
  await send(bs, 'seat:take', { team: 'b', role: 'spymaster' });
  await send(ba, 'seat:take', { team: 'b', role: 'agent' });

  while (!stop) {
    await send(rs, 'game:start', {});
    let view = await until(rs, (v) => v.phase === 'play');
    while (!stop && view.phase === 'play') {
      view = view.turn === 'r' ? await playTurn(view, rs, ra) : await playTurn(view, bs, ba);
      await sleep(100 + Math.random() * 200);
    }
    if (view.phase !== 'over') break;
    games++;
    await send(rs, 'game:rematch', {});
    await until(rs, (v) => v.phase === 'lobby');
  }
  for (const bot of [rs, ra, bs, ba]) bot.socket.disconnect();
}

const running: Promise<void>[] = [];
for (let i = 0; i < rooms; i++) {
  running.push(playRoom());
  if (i % 20 === 19) await sleep(50);
}
setTimeout(() => (stop = true), seconds * 1000);
const results = await Promise.allSettled(running);

latencies.sort((a, b) => a - b);
const percentile = (p: number) => Number((latencies[Math.floor((latencies.length - 1) * p)] ?? 0).toFixed(1));
const failedRooms = results.filter((r) => r.status === 'rejected').length;
const report = {
  rooms,
  sockets: rooms * 4,
  requests: latencies.length,
  statesReceived: states,
  gamesFinished: games,
  ackMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: percentile(1) },
  errors: Object.fromEntries(errors),
  failedRooms,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(failedRooms > 0 || errors.size > 0 ? 1 : 0);
