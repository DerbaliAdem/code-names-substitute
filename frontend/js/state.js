// Holds the latest RoomView from the server and notifies subscribers.
import { ls } from './store.js';

const subs = new Set();
export const state = {
  view: null,          // RoomView | null
  prev: null,          // previous RoomView (for sounds / routing)
  skew: 0,             // serverNow - Date.now(), ms
  conn: 'connecting',  // 'connecting' | 'waking' | 'online' | 'reconnecting'
  profile: Object.assign({ name: '', alias: 'The Falcon', color: '#2a6bd6', badge: '★' }, ls.get('cnProfile', {})),
};

export function setView(v) {
  state.prev = state.view;
  state.view = v;
  if (v && typeof v.serverNow === 'number') state.skew = v.serverNow - Date.now();
  emit();
}
export function setConn(c) { state.conn = c; emit(); }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function emit() { subs.forEach((fn) => fn(state)); }

export const now = () => Date.now() + state.skew;
export const me = () => state.view?.players.find((p) => p.id === state.view.you) || null;
export const playerName = (id) => state.view?.players.find((p) => p.id === id)?.name || 'Agent';
export const saveProfile = () => ls.set('cnProfile', state.profile);
