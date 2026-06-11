// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { startServer } from './serve';

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
