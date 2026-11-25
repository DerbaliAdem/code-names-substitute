/** Minimal structured logger: one JSON object per line. Never log tokens or client addresses. */
const LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;

export type LogLevel = (typeof LEVELS)[number];
type Log = (message: string, fields?: Record<string, unknown>) => void;

export interface Logger {
  debug: Log;
  info: Log;
  warn: Log;
  error: Log;
}

export function errorFields(err: unknown): Record<string, unknown> {
  return err instanceof Error ? { error: err.message, stack: err.stack } : { error: String(err) };
}

export function createLogger(
  level: LogLevel,
  write: (line: string) => void = (line) => void process.stdout.write(`${line}\n`),
): Logger {
  const at = (own: LogLevel): Log => {
    if (LEVELS.indexOf(own) < LEVELS.indexOf(level)) return () => undefined;
    return (message, fields) =>
      write(JSON.stringify({ time: new Date().toISOString(), level: own, message, ...fields }));
  };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
