import type { DocumentationPageRoute, ValidatedDocumentationWebhookPayload } from '../types/webhook';

const PAGE_LAYOUT_MARKER = 'DOC_SYNC_LAYOUT_V1';
const HISTORY_START_MARKER = '<!-- DOC_SYNC_HISTORY_START -->';
const HISTORY_END_MARKER = '<!-- DOC_SYNC_HISTORY_END -->';

/**
 * Confluence storage format is XML-like markup, so every user-controlled string needs to be escaped before it is
 * interpolated into the page body. Keeping the escaping logic local to this renderer reduces the chance of a future
 * refactor forgetting to sanitize one field when more sections are added.
 */
function escapeStorageValue(value: string): string {
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
function renderParagraphs(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${escapeStorageValue(line)}</p>`)
    .join('\n');
}

function renderOptionalMetadataRow(label: string, value?: string): string {
  if (!value) {
    return '';
  }

  return `
    <tr>
      <th><p>${escapeStorageValue(label)}</p></th>
      <td><p>${escapeStorageValue(value)}</p></td>
    </tr>
  `.trim();
}

export function renderMetadataBlock(
  payload: ValidatedDocumentationWebhookPayload,
  route: DocumentationPageRoute
): string {
  const optionalRows = [
    renderOptionalMetadataRow('Feature', payload.feature),
    renderOptionalMetadataRow('System', payload.system),
    renderOptionalMetadataRow('Integration', payload.integration),
    renderOptionalMetadataRow('Release', payload.release),
    renderOptionalMetadataRow('Incident ID', payload.incidentId),
  ]
    .filter((row) => row.length > 0)
    .join('\n');

  return `
<table data-layout="default">
  <tbody>
    <tr>
      <th><p>Source</p></th>
      <td><p>${escapeStorageValue(payload.source)}</p></td>
    </tr>
    <tr>
      <th><p>Event Type</p></th>
      <td><p>${escapeStorageValue(payload.eventType)}</p></td>
    </tr>
    <tr>
      <th><p>Timestamp</p></th>
      <td><p>${escapeStorageValue(payload.timestamp)}</p></td>
    </tr>
    <tr>
      <th><p>Page Type</p></th>
      <td><p>${escapeStorageValue(route.pageType)}</p></td>
    </tr>
    <tr>
      <th><p>Routing Source</p></th>
      <td><p>${escapeStorageValue(route.routingSource)}</p></td>
    </tr>
${optionalRows ? `${optionalRows}\n` : ''}  </tbody>
</table>
  `.trim();
}

export function renderHistoryEntry(payload: ValidatedDocumentationWebhookPayload): string {
  return `
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">${escapeStorageValue(payload.timestamp)} — ${escapeStorageValue(payload.eventType)}</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Timestamp:</strong> ${escapeStorageValue(payload.timestamp)}</p>
    <p><strong>Event Type:</strong> ${escapeStorageValue(payload.eventType)}</p>
    <p><strong>Message:</strong> ${escapeStorageValue(payload.message)}</p>
  </ac:rich-text-body>
</ac:structured-macro>
  `.trim();
}

function renderLegacyHistoryEntry(existingContent: string): string {
  return `
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">Legacy content preserved during structured page migration</ac:parameter>
  <ac:rich-text-body>
    <p>This page previously contained unstructured content. The earlier body is preserved below for reference.</p>
    <ac:structured-macro ac:name="code">
      <ac:parameter ac:name="language">html/xml</ac:parameter>
      <ac:plain-text-body><![CDATA[${existingContent.trim()}]]></ac:plain-text-body>
    </ac:structured-macro>
  </ac:rich-text-body>
</ac:structured-macro>
  `.trim();
}

function extractHistoryEntries(existingContent: string): string[] {
  const historySectionMatch = existingContent.match(
    /<!-- DOC_SYNC_HISTORY_START -->([\s\S]*?)<!-- DOC_SYNC_HISTORY_END -->/
  );

  if (!historySectionMatch) {
    return [];
  }

  return historySectionMatch[1]
    .split(/(?=<ac:structured-macro ac:name="expand">)/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function mergeExistingContentWithNewUpdate(
  existingContent: string,
  payload: ValidatedDocumentationWebhookPayload
): {
  historyEntries: string[];
  pageInitialized: boolean;
  structuredContentUpdated: boolean;
  usedLegacyMigrationEntry: boolean;
} {
  const trimmedExistingContent = existingContent.trim();
  const hasStructuredLayout = trimmedExistingContent.includes(PAGE_LAYOUT_MARKER);
  const existingHistoryEntries = hasStructuredLayout ? extractHistoryEntries(trimmedExistingContent) : [];
  const historyEntries = [renderHistoryEntry(payload), ...existingHistoryEntries];
  let usedLegacyMigrationEntry = false;

  /**
   * If the page already exists but predates the structured renderer, we do not attempt to reverse-engineer arbitrary
   * storage HTML into semantic sections. That kind of parser would be brittle and easy to break. Instead, we migrate the
   * page to the new predictable layout and preserve the legacy body as a single history artifact.
   */
  if (!hasStructuredLayout && trimmedExistingContent.length > 0) {
    historyEntries.push(renderLegacyHistoryEntry(trimmedExistingContent));
    usedLegacyMigrationEntry = true;
  }

  return {
    historyEntries,
    pageInitialized: !hasStructuredLayout,
    structuredContentUpdated: hasStructuredLayout,
    usedLegacyMigrationEntry,
  };
}

/**
 * The renderer intentionally stays generic: every page type gets the same structured sections today, while the route
 * object gives us a clean hook for small page-type-specific tweaks later if we ever need them.
 */
export function renderDocumentationPage(
  payload: ValidatedDocumentationWebhookPayload,
  route: DocumentationPageRoute,
  historyEntries: string[]
): string {
  return `
<!-- ${PAGE_LAYOUT_MARKER} -->
<h1>${escapeStorageValue(route.pageHeading)}</h1>
<h2>Summary</h2>
${renderParagraphs(payload.summary)}
<h2>Latest Update</h2>
${renderParagraphs(payload.message)}
<h2>Metadata</h2>
${renderMetadataBlock(payload, route)}
<h2>Change History</h2>
${HISTORY_START_MARKER}
${historyEntries.join('\n')}
${HISTORY_END_MARKER}
  `.trim();
}
