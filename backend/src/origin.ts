import type { IncomingMessage } from 'node:http';

/**
 * Whether a connection may come from this origin. Keeps other web sites out; native apps are always let in:
 * they send no Origin, or, for React Native WebSockets, the address of the server they connect to.
 */
export function isAllowedOrigin(request: IncomingMessage, allowed: readonly string[]): boolean {
  const { origin, host } = request.headers;
  if (origin === undefined || allowed.includes(origin)) return true;
  if (!URL.canParse(origin)) return false;
  const { protocol, host: originHost } = new URL(origin);
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  // Parsed with the same protocol so that an explicit default port compares equal.
  const own = `${protocol}//${host ?? ''}`;
  return URL.canParse(own) && new URL(own).host === originHost;
}
