// Socket.IO client: connection, acks as promises, session rejoin. See docs/PROTOCOL.md.
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from './config';
import type { Ack, JoinAck, RoomView } from './protocol';
import { getState, go, setSession, setState, setView } from './store';

let socket: Socket | null = null;
let everConnected = false;

/** Emit with ack. Always resolves to {ok:true,…} or {ok:false,error}. */
export function request<T = {}>(event: string, payload: object = {}, timeout = 10000): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ok: false, error: { code: 'OFFLINE', message: 'Not connected to the server yet. Try again in a moment.' } });
      return;
    }
    socket.timeout(timeout).emit(event, payload, (err: unknown, res: Ack<T>) => {
      if (err) resolve({ ok: false, error: { code: 'TIMEOUT', message: 'The server did not answer. Try again.' } });
      else if (res && typeof res === 'object') resolve(res);
      else resolve({ ok: false, error: { code: 'BAD_RESPONSE', message: 'Unexpected server reply.' } });
    });
  });
}

/** Create or join a room and remember the session. */
export async function enterRoom(event: 'room:create' | 'room:join', payload: object = {}): Promise<JoinAck> {
  const res = await request<{ code: string; playerId: string; token: string }>(event, { ...payload, profile: getState().profile });
  if (res.ok) setSession({ code: res.code, playerId: res.playerId, token: res.token });
  return res;
}

export async function leaveRoom() {
  await request('room:leave');
  setSession(null);
  setView(null);
  go('home');
}

async function rejoin() {
  const sess = getState().session;
  if (!sess) return;
  const res = await enterRoom('room:join', { code: sess.code, token: sess.token });
  if (!res.ok) { setSession(null); setView(null); }
}

/** Ping /health so a sleeping Render instance starts waking before the socket tries. */
function wake() {
  const t = setTimeout(() => { if (!socket?.connected) setState({ conn: 'waking' }); }, 2500);
  fetch(SERVER_URL + '/health').catch(() => {}).finally(() => clearTimeout(t));
}

export function connect() {
  if (socket) return;
  wake();
  socket = io(SERVER_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
  socket.on('connect', () => { everConnected = true; setState({ conn: 'online' }); rejoin(); });
  socket.on('disconnect', () => setState({ conn: everConnected ? 'reconnecting' : 'waking' }));
  socket.on('connect_error', () => setState({ conn: everConnected ? 'reconnecting' : 'waking' }));
  socket.on('room:state', (v: RoomView) => setView(v));
  socket.on('room:closed', (p: { reason?: string }) => {
    setSession(null);
    setView(null);
    setState({ screen: 'home', homeNote: 'The room was closed' + (p?.reason ? ': ' + p.reason : '.') });
  });
}
