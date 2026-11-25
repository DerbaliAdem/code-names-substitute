import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { errorFields, type Logger } from './logger.js';
import { isAllowedOrigin } from './origin.js';

export interface HttpOptions {
  corsOrigins: readonly string[];
  roomCount: () => number;
  logger: Logger;
}

export function createApp({ corsOrigins, roomCount, logger }: HttpOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.set({
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
    });
    const { origin } = req.headers;
    if (origin && isAllowedOrigin(req, corsOrigins)) res.set('Access-Control-Allow-Origin', origin);
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: roomCount(), uptime: Math.floor(process.uptime()) });
  });
  app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'game server', health: '/health' });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'Not found' });
  });
  // Express recognises error handlers by their four parameters.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    logger.error('http request failed', errorFields(err));
    res.status(500).json({ ok: false, error: 'Internal error' });
  });
  return app;
}
