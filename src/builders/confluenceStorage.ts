/**
 * Confluence storage format is XML-like markup, so every user-controlled string needs to be escaped before it is
 * interpolated into the page body. Keeping the escaping logic in one tiny utility module reduces duplication between
 * routed detail pages and the new index-page renderer.
 */
export function escapeStorageValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The webhook payload can contain line breaks, especially inside summaries or human-authored update messages.
 * Rendering each line as its own paragraph keeps the Confluence page readable without having to introduce a more
 * fragile HTML parser or allow arbitrary inbound markup.
 */
export function renderParagraphs(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${escapeStorageValue(line)}</p>`)
    .join('\n');
}
