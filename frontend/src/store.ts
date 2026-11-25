// App-wide state: the latest RoomView from the server plus local preferences.
import { useSyncExternalStore } from 'react';
import type { Player, Profile, RoomView } from './protocol';
import { load, save } from './storage';

export type Screen = 'home' | 'lobby' | 'board';
export type Conn = 'connecting' | 'waking' | 'online' | 'reconnecting';
export type ThemePref = 'auto' | 'light' | 'dark';
export interface Session { code: string; playerId: string; token: string }

export interface AppState {
  ready: boolean;          // persisted prefs loaded
  view: RoomView | null;
  conn: Conn;
  skew: number;            // serverNow - Date.now()
  screen: Screen;
  profile: Profile;
  session: Session | null;
  themePref: ThemePref;
  soundOn: boolean;
  inviteCode: string;      // from ?room=CODE links
  homeNote: string;        // message shown on Home (e.g. room closed)
}

let s: AppState = {
  ready: false,
  view: null,
  conn: 'connecting',
  skew: 0,
  screen: 'home',
  profile: { name: '', alias: 'The Falcon', color: '#2a6bd6', badge: '★' },
  session: null,
  themePref: 'auto',
  soundOn: true,
  inviteCode: '',
  homeNote: '',
};
const subs = new Set<() => void>();
const viewListeners = new Set<(prev: RoomView | null, next: RoomView | null) => void>();

export const getState = () => s;
export function setState(patch: Partial<AppState>) {
  s = { ...s, ...patch };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** Called for every room:state. Listeners get (previous, next) for sounds and routing. */
export function setView(v: RoomView | null) {
  const prev = s.view;
  setState({ view: v, skew: v && typeof v.serverNow === 'number' ? v.serverNow - Date.now() : s.skew });
  viewListeners.forEach((f) => f(prev, v));
}
export function onViewChange(f: (prev: RoomView | null, next: RoomView | null) => void) {
  viewListeners.add(f);
  return () => { viewListeners.delete(f); };
}

export const go = (screen: Screen) => { if (s.screen !== screen) setState({ screen }); };
export const now = () => Date.now() + s.skew;
export const me = (v: RoomView | null = s.view): Player | null => v?.players.find((p) => p.id === v.you) ?? null;
export const playerName = (id: string, v: RoomView | null = s.view) => v?.players.find((p) => p.id === id)?.name || 'Agent';

export function setProfile(p: Partial<Profile>) { const profile = { ...s.profile, ...p }; setState({ profile }); save('cnProfile', profile); }
export function setSession(session: Session | null) { setState({ session }); save('cnSession', session); }
export function setThemePref(themePref: ThemePref) { setState({ themePref }); save('cnTheme', themePref); }
export function setSoundOn(soundOn: boolean) { setState({ soundOn }); save('cnSound', soundOn); }

export async function loadPersisted() {
  const [profile, session, themePref, soundOn] = await Promise.all([
    load<Partial<Profile>>('cnProfile', {}),
    load<Session | null>('cnSession', null),
    load<ThemePref>('cnTheme', 'auto'),
    load<boolean>('cnSound', true),
  ]);
  setState({ profile: { ...s.profile, ...profile }, session, themePref, soundOn, ready: true });
}
