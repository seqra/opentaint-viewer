import { describe, it, expect } from 'vitest';
import { injectContent, CONTENT_PLACEHOLDER } from './render';
import type { ViewerContent } from '../types/content';

const TEMPLATE = `<html><head></head><body><script type="application/json" id="opentaint-content">${CONTENT_PLACEHOLDER}</script></body></html>`;

function extractJson(html: string): string {
  return html.replace(/^[\s\S]*id="opentaint-content">/, '').replace(/<\/script>[\s\S]*$/, '');
}

describe('injectContent', () => {
  const content: ViewerContent = {
    projectId: 'p', files: [], rules: [],
    findings: [{
      id: 'f', ruleId: 'r', vulnClass: 'XSS', severity: 'error', endpoint: null,
      location: null, file: null, ruleFile: null, message: 'm',
      flows: [{ steps: [] }], defaultFlowIndex: 0,
    }],
  };

  it('round-trips the content through the placeholder', () => {
    const html = injectContent(TEMPLATE, content);
    expect(JSON.parse(extractJson(html))).toEqual(content);
  });

  it('escapes embedded </script> so it cannot break out of the tag', () => {
    const dangerous: ViewerContent = {
      ...content,
      files: [{ path: 'A.java', language: 'java', content: 'x </script><script>alert(1)</script> y' }],
    };
    const html = injectContent(TEMPLATE, dangerous);
    // exactly one real closing tag — the injected JSON must not contain another
    expect(html.split('</script>')).toHaveLength(2);
    expect(JSON.parse(extractJson(html))).toEqual(dangerous);
  });

  it('throws when the template lacks the placeholder', () => {
    expect(() => injectContent('<html></html>', content)).toThrow(/placeholder/);
  });

  it('round-trips content whose values contain $-replacement patterns', () => {
    const tricky: ViewerContent = {
      ...content,
      files: [{ path: '$`path', language: 'java', content: "Outer$Inner val $' end $& here" }],
    };
    const html = injectContent(TEMPLATE, tricky);
    expect(JSON.parse(extractJson(html))).toEqual(tricky);
  });
});
