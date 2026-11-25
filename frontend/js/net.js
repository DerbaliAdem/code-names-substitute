// Socket.IO wrapper: connection, acks as promises, session rejoin.
import { SERVER_URL } from './config.js';
import { ls } from './store.js';
import { state, setView, setConn } from './state.js';

let socket = null;
let everConnected = false;
const closedHandlers = new Set();

export const session = {
  get: () => ls.get('cnSession', null),
  set: (s) => ls.set('cnSession', s),
  clear: () => ls.set('cnSession', null),
};

export function onRoomClosed(fn) { closedHandlers.add(fn); }

/** Emit with ack. Always resolves to {ok:true,…} or {ok:false,error:{code,message}}. */
export function request(event, payload = {}, timeout = 10000) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ ok: false, error: { code: 'OFFLINE', message: 'Not connected to the server yet. Try again in a moment.' } });
      return;
    }
    socket.timeout(timeout).emit(event, payload, (err, res) => {
      if (err) resolve({ ok: false, error: { code: 'TIMEOUT', message: 'The server did not answer. Try again.' } });
      else resolve(res && typeof res === 'object' ? res : { ok: false, error: { code: 'BAD_RESPONSE', message: 'Unexpected server reply.' } });
    });
  });
}

async function rejoin() {
  const s = session.get();
  if (!s) return;
  const res = await request('room:join', { code: s.code, token: s.token, profile: state.profile });
  if (res.ok) session.set({ code: res.code, playerId: res.playerId, token: res.token });
  else { session.clear(); setView(null); }
}

/** Ping /health so a sleeping Render instance starts waking before the socket tries. */
function wake() {
  const t = setTimeout(() => { if (!socket?.connected) setConn('waking'); }, 2500);
  fetch(SERVER_URL + '/health', { cache: 'no-store' }).catch(() => {}).finally(() => clearTimeout(t));
}

export function connect() {
  if (typeof io !== 'function') { setConn('waking'); return; }
  wake();
  socket = io(SERVER_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
  socket.on('connect', () => { everConnected = true; setConn('online'); rejoin(); });
  socket.on('disconnect', () => setConn(everConnected ? 'reconnecting' : 'waking'));
  socket.on('connect_error', () => setConn(everConnected ? 'reconnecting' : 'waking'));
  socket.on('room:state', (v) => setView(v));
  socket.on('room:closed', (p) => { session.clear(); setView(null); closedHandlers.forEach((fn) => fn(p?.reason)); });
}
