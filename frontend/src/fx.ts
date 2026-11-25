// Full-screen effects (big clue reveal, wrong-team laugh, assassin loss), detected from room:state changes.
import { Animated } from 'react-native';
import type { Clue, RoomView, Team } from './protocol';

export type FxInput =
  | { kind: 'clue'; clue: Clue }
  | { kind: 'laugh'; team: Team; card: Team; by: string; word: string }
  | { kind: 'assassin'; team: Team; by: string; word: string };
export type Fx = FxInput & { id: number };

let n = 0;
const subs = new Set<(f: Fx) => void>();
export function onFx(f: (fx: Fx) => void) { subs.add(f); return () => { subs.delete(f); }; }
export function fire(f: FxInput) { const fx = { ...f, id: ++n } as Fx; subs.forEach((s) => s(fx)); }

/** Drives the whole-screen shake for the assassin. */
export const screenShake = new Animated.Value(0);

/** Compare two views of the same room and fire the matching effects. */
export function detectFx(a: RoomView | null, b: RoomView | null) {
  if (!a || !b || a.code !== b.code) return;
  let big = false;
  for (const k of Object.keys(b.revealed || {})) {
    if (a.revealed?.[+k]) continue;
    const r = b.revealed[+k], word = b.words[+k];
    if (r.type === 'x') { fire({ kind: 'assassin', team: r.team, by: r.by, word }); big = true; }
    else if ((r.type === 'r' || r.type === 'b') && r.type !== r.team) { fire({ kind: 'laugh', team: r.team, card: r.type, by: r.by, word }); big = true; }
  }
  const last = b.log?.[b.log.length - 1];
  if (!big && last && (b.log.length > (a.log?.length || 0))) fire({ kind: 'clue', clue: last });
}
