/** Environment configuration, validated once at start-up. See .env.example. */
import { z } from 'zod';

const DEFAULT_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,https://derbaliadem.github.io';

function isOrigin(value: string): boolean {
  return URL.canParse(value) && new URL(value).origin === value;
}

const positive = (fallback: number) => z.coerce.number().int().min(1).default(fallback);

const schema = z
  .object({
    PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
    HOST: z.string().default('0.0.0.0'),
    CORS_ORIGIN: z
      .string()
      .default(DEFAULT_ORIGINS)
      .transform((list) => list.split(',').map((item) => item.trim().replace(/\/$/, '')).filter(Boolean))
      .refine((origins) => origins.every(isOrigin), 'must be a comma-separated list of origins like https://a.example'),
    CLIENT_IP_HEADER: z
      .string()
      .toLowerCase()
      .optional()
      .transform((header) => header ?? null),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
    MAX_ROOMS: positive(5000),
    MAX_PLAYERS_PER_ROOM: positive(20),
    MAX_CONNECTIONS: positive(5000),
    MAX_CONNECTIONS_PER_IP: positive(100),
  })
  .transform((env) => ({
    port: env.PORT,
    host: env.HOST,
    corsOrigins: env.CORS_ORIGIN,
    /** Where a client's address comes from: a header name, 'remote' for the TCP peer, null for "unknown". */
    clientIp: env.CLIENT_IP_HEADER,
    logLevel: env.LOG_LEVEL,
    maxRooms: env.MAX_ROOMS,
    maxPlayers: env.MAX_PLAYERS_PER_ROOM,
    maxConnections: env.MAX_CONNECTIONS,
    maxConnectionsPerIp: env.MAX_CONNECTIONS_PER_IP,
  }));

export type Config = z.output<typeof schema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const set = Object.fromEntries(Object.entries(env).filter(([, value]) => value?.trim()));
  const parsed = schema.safeParse(set);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid configuration: ${problems.join('; ')}`);
}
