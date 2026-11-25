import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { KeyedLimiter, TokenBucket } from '../src/rateLimit.js';

describe('loadConfig', () => {
  it('has working defaults', () => {
    expect(loadConfig({})).toMatchObject({
      port: 3000,
      host: '0.0.0.0',
      corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://derbaliadem.github.io'],
      clientIp: null,
      logLevel: 'info',
    });
  });

  it('reads the environment', () => {
    const config = loadConfig({
      PORT: '10000',
      CORS_ORIGIN: ' https://a.example/ , http://localhost:5173',
      CLIENT_IP_HEADER: 'CF-Connecting-IP',
      LOG_LEVEL: 'warn',
      MAX_ROOMS: '7',
    });
    expect(config).toMatchObject({
      port: 10000,
      corsOrigins: ['https://a.example', 'http://localhost:5173'],
      clientIp: 'cf-connecting-ip',
      logLevel: 'warn',
      maxRooms: 7,
    });
  });

  it('treats empty variables as unset', () => {
    expect(loadConfig({ PORT: '', CORS_ORIGIN: '', CLIENT_IP_HEADER: '' })).toEqual(loadConfig({}));
  });

  it.each([
    { PORT: 'abc' },
    { PORT: '70000' },
    { MAX_ROOMS: '0' },
    { LOG_LEVEL: 'loud' },
    { CORS_ORIGIN: '*' },
    { CORS_ORIGIN: 'example.com' },
    { CORS_ORIGIN: 'https://a.example/path' },
  ])('refuses to start with %j', (env) => {
    expect(() => loadConfig(env)).toThrow(/Invalid configuration/);
  });
});

describe('TokenBucket', () => {
  it('allows a burst, then refills over time up to its capacity', () => {
    let now = 0;
    const bucket = new TokenBucket(3, 2, () => now);
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, true, false]);
    now = 499;
    expect(bucket.take()).toBe(false);
    now = 500;
    expect([bucket.take(), bucket.take()]).toEqual([true, false]);
    now = 60_000;
    expect([1, 2, 3, 4].map(() => bucket.take())).toEqual([true, true, true, false]);
  });

  it('survives a clock that goes backwards', () => {
    let now = 1000;
    const bucket = new TokenBucket(1, 1, () => now);
    bucket.take();
    now = 0;
    expect(bucket.take()).toBe(false);
    now = 1000;
    expect(bucket.take()).toBe(true);
  });
});

describe('KeyedLimiter', () => {
  it('limits each key separately and can be checked without spending', () => {
    const limiter = new KeyedLimiter(1, 1, () => 0);
    expect(limiter.available('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.available('a')).toBe(false);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
  });

  it('forgets keys that are back to full', () => {
    let now = 0;
    const limiter = new KeyedLimiter(2, 1, () => now);
    limiter.take('a');
    now = 900;
    limiter.take('b');
    now = 1000;
    limiter.prune();
    expect(limiter.size).toBe(1);
  });
});
