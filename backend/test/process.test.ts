/** The real entry point, in its own process. */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

const children: ChildProcess[] = [];
afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
});

function run(env: Record<string, string>) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', ...env },
  });
  children.push(child);
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
  const prints = async (text: string) => {
    while (!output.includes(text)) await new Promise((resolve) => setTimeout(resolve, 20));
  };
  return { child, exited, prints, output: () => output };
}

const listen = (server: Server) =>
  new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });

async function freePort(): Promise<number> {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

describe('process', () => {
  it('serves /health on PORT', async () => {
    const port = await freePort();
    const server = run({ PORT: String(port) });
    await server.prints('listening');
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
  });

  it('exits with an explanation when the configuration is wrong', async () => {
    const server = run({ PORT: 'abc' });
    expect(await server.exited).toBe(1);
    expect(server.output()).toContain('Invalid configuration: PORT');
  });

  it('exits once, promptly, when the port is taken', async () => {
    const blocker = createServer();
    const port = await listen(blocker);
    try {
      const server = run({ PORT: String(port) });
      expect(await server.exited).toBe(1);
      expect(server.output().match(/EADDRINUSE/g)?.length).toBeGreaterThan(0);
      expect(server.output().match(/"shutting down"/g)).toHaveLength(1);
    } finally {
      blocker.close();
    }
  }, 9_000);

  // Windows has no SIGTERM: kill() terminates the process at once.
  it.skipIf(process.platform === 'win32')('shuts down cleanly on SIGTERM', async () => {
    const server = run({ PORT: String(await freePort()) });
    await server.prints('listening');
    server.child.kill('SIGTERM');
    expect(await server.exited).toBe(0);
  });
});
