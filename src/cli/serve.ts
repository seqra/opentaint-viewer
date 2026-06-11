import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';

export interface ServeOptions {
  port: number;
  open: boolean;
}

/** Start an HTTP server that returns `html` for every request. */
export function startServer(html: string, port: number): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolveP, rejectP) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.once('error', rejectP);
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address() as AddressInfo;
      resolveP({
        url: `http://127.0.0.1:${actual}/`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

/** Best-effort open of the OS default browser; failures are non-fatal. */
export function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] :
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
    ['xdg-open', [url]];
  try {
    spawn(cmd, args as string[], { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* opening a browser is a convenience, not a requirement */
  }
}

/** Serve `html`, retrying the next port if the preferred one is taken; keep alive until Ctrl+C. */
export async function serve(html: string, opts: ServeOptions): Promise<void> {
  for (let port = opts.port; port < opts.port + 10; port++) {
    try {
      const { url, close } = await startServer(html, port);
      console.log(`OpenTaint Viewer on ${url}  (Ctrl+C to stop)`);
      if (opts.open) openBrowser(url);
      process.on('SIGINT', () => { void close().then(() => process.exit(0)); });
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') continue;
      throw err;
    }
  }
  throw new Error(`no free port in range ${opts.port}-${opts.port + 9}`);
}
