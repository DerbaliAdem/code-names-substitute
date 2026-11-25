import type { ErrorAck, ErrorCode } from './types.js';

/** An expected failure whose message is safe to show to the player as is. */
export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/** Converts any thrown value to an error ack without leaking internals. */
export function toAck(err: unknown): ErrorAck {
  if (err instanceof GameError) return { ok: false, error: { code: err.code, message: err.message } };
  return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } };
}
