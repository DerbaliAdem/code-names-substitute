import type { IncomingHttpHeaders } from 'node:http';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function parse(url: string): URL | null {
  if (!URL.canParse(url)) return null;
  const parsed = new URL(url);
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
}

/**
 * Whether a request may come from its origin. Keeps other web sites out, and lets in:
 * - the listed origins;
 * - native apps, which send no Origin or, for React Native WebSockets, the address of the server itself;
 * - any local page when the server is itself reached as localhost, because dev servers pick a free port.
 */
export function isAllowedOrigin(request: { headers: IncomingHttpHeaders }, allowed: readonly string[]): boolean {
  const { origin, host } = request.headers;
  if (origin === undefined || allowed.includes(origin)) return true;
  const from = parse(origin);
  if (!from) return false;
  // Parsed with the same protocol so that an explicit default port compares equal.
  const to = parse(`${from.protocol}//${host ?? ''}`);
  if (!to) return false;
  return from.host === to.host || (LOOPBACK.has(from.hostname) && LOOPBACK.has(to.hostname));
}
