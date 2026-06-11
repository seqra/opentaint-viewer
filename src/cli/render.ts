import type { ViewerContent } from '../types/content';

/** Token the `template` build writes into the content <script>; the CLI replaces it. */
export const CONTENT_PLACEHOLDER = '__OPENTAINT_CONTENT__';

/** JSON-encode `content` so it is safe as the text of an inline <script>:
 * every `<` becomes `<` (neutralizing `</script>` and `<!--`), and the
 * U+2028/U+2029 line separators are escaped. JSON.parse restores the originals. */
function encodeForScript(content: ViewerContent): string {
  return JSON.stringify(content)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function injectContent(template: string, content: ViewerContent): string {
  if (!template.includes(CONTENT_PLACEHOLDER)) {
    throw new Error('template is missing the content placeholder');
  }
  const encoded = encodeForScript(content);
  return template.replace(CONTENT_PLACEHOLDER, () => encoded);
}
