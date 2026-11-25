import { loadConfig } from './config.js';
import { createLogger, errorFields } from './logger.js';
import { createServer } from './server.js';

const SHUTDOWN_LIMIT_MS = 10_000;

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const server = createServer({ config, logger });

async function shutDown(reason: string, exitCode: number): Promise<void> {
  logger.info('shutting down', { reason });
  setTimeout(() => process.exit(exitCode || 1), SHUTDOWN_LIMIT_MS).unref();
  try {
    await server.stop();
  } finally {
    process.exit(exitCode);
  }
}

process.on('SIGTERM', () => void shutDown('SIGTERM', 0));
process.on('SIGINT', () => void shutDown('SIGINT', 0));
process.on('uncaughtException', (err) => {
  // The state can no longer be trusted: exit and let the platform restart the process.
  logger.error('uncaught exception', errorFields(err));
  void shutDown('uncaught exception', 1);
});
process.on('unhandledRejection', (err) => {
  logger.error('unhandled rejection', errorFields(err));
  void shutDown('unhandled rejection', 1);
});

await server.start();
logger.info('listening', { port: config.port, origins: config.corsOrigins });
