import { GameError } from '../src/errors.js';
import type { ErrorCode, Profile } from '../src/types.js';

export const profile = (name = 'Ada'): Profile => ({ name, alias: 'Night Owl', color: '#2a6bd6', badge: '*' });

/** Error code thrown by `fn`, or 'none'. */
export function codeOf(fn: () => unknown): ErrorCode | 'none' {
  try {
    fn();
    return 'none';
  } catch (err) {
    if (err instanceof GameError) return err.code;
    throw err;
  }
}

/** A hand-driven clock that satisfies the store's time dependencies. */
export function fakeClock(start = 1_000_000) {
  let now = start;
  let nextId = 0;
  const jobs = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => now,
    schedule: (run: () => void, ms: number) => {
      const id = nextId++;
      jobs.set(id, { at: now + ms, run });
      return () => void jobs.delete(id);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        jobs.delete(due[0]);
        now = Math.max(now, due[1].at);
        due[1].run();
      }
      now = end;
    },
    /** Moves time without running timers, as when the event loop is late. */
    jump: (ms: number) => void (now += ms),
    pending: () => jobs.size,
  };
}
