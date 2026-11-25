import type { IncomingMessage } from 'node:http';

/**
 * The client's address, used only as a rate-limit key.
 *
 * Returns null when it can't be trusted to tell clients apart (no source configured, or the header is
 * missing). Callers then skip per-address limits: behind a proxy, falling back to the TCP peer would put
 * every player of the site in one bucket.
 */
export function clientIp(request: IncomingMessage, source: string | null): string | null {
  if (source === null) return null;
  if (source === 'remote') return request.socket.remoteAddress ?? null;
  const header = request.headers[source];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim().slice(0, 64) || null;
}
