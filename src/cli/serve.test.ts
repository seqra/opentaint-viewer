// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { startServer } from './serve';

// We test startServer (the pure, side-effect-free core). serve()'s port-fallback loop,
// browser launch, and SIGINT handler are thin orchestration over it and are not unit-tested.

describe('startServer', () => {
  it('serves the given HTML and reports a usable URL', async () => {
    const html = '<html><body>hello-report</body></html>';
    const { url, close } = await startServer(html, 0); // port 0 = ephemeral
    try {
      const res = await fetch(url);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toBe(html);
    } finally {
      await close();
    }
  });
});
