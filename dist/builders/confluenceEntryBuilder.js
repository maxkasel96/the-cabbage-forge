"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMetadataBlock = renderMetadataBlock;
exports.renderHistoryEntry = renderHistoryEntry;
exports.mergeExistingContentWithNewUpdate = mergeExistingContentWithNewUpdate;
exports.renderDocumentationPage = renderDocumentationPage;
const confluenceStorage_1 = require("./confluenceStorage");
const PAGE_LAYOUT_MARKER = 'DOC_SYNC_LAYOUT_V1';
const HISTORY_START_MARKER = '<!-- DOC_SYNC_HISTORY_START -->';
const HISTORY_END_MARKER = '<!-- DOC_SYNC_HISTORY_END -->';
function renderOptionalMetadataRow(label, value) {
    if (!value) {
        return '';
    }
    return `
    <tr>
      <th><p>${(0, confluenceStorage_1.escapeStorageValue)(label)}</p></th>
      <td><p>${(0, confluenceStorage_1.escapeStorageValue)(value)}</p></td>
    </tr>
  `.trim();
}
function renderMetadataBlock(payload, route) {
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
      <td><p>${(0, confluenceStorage_1.escapeStorageValue)(payload.source)}</p></td>
    </tr>
    <tr>
      <th><p>Event Type</p></th>
      <td><p>${(0, confluenceStorage_1.escapeStorageValue)(payload.eventType)}</p></td>
    </tr>
    <tr>
      <th><p>Timestamp</p></th>
      <td><p>${(0, confluenceStorage_1.escapeStorageValue)(payload.timestamp)}</p></td>
    </tr>
    <tr>
      <th><p>Page Type</p></th>
      <td><p>${(0, confluenceStorage_1.escapeStorageValue)(route.pageType)}</p></td>
    </tr>
    <tr>
      <th><p>Routing Source</p></th>
      <td><p>${(0, confluenceStorage_1.escapeStorageValue)(route.routingSource)}</p></td>
    </tr>
${optionalRows ? `${optionalRows}\n` : ''}  </tbody>
</table>
  `.trim();
}
function renderHistoryEntry(payload) {
    return `
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">${(0, confluenceStorage_1.escapeStorageValue)(payload.timestamp)} — ${(0, confluenceStorage_1.escapeStorageValue)(payload.eventType)}</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Timestamp:</strong> ${(0, confluenceStorage_1.escapeStorageValue)(payload.timestamp)}</p>
    <p><strong>Event Type:</strong> ${(0, confluenceStorage_1.escapeStorageValue)(payload.eventType)}</p>
    <p><strong>Message:</strong> ${(0, confluenceStorage_1.escapeStorageValue)(payload.message)}</p>
  </ac:rich-text-body>
</ac:structured-macro>
  `.trim();
}
function renderLegacyHistoryEntry(existingContent) {
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
function extractHistoryEntries(existingContent) {
    const historySectionMatch = existingContent.match(/<!-- DOC_SYNC_HISTORY_START -->([\s\S]*?)<!-- DOC_SYNC_HISTORY_END -->/);
    if (!historySectionMatch) {
        return [];
    }
    return historySectionMatch[1]
        .split(/(?=<ac:structured-macro ac:name="expand">)/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
function mergeExistingContentWithNewUpdate(existingContent, payload) {
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
function renderDocumentationPage(payload, route, historyEntries, navigationSection) {
    return `
<!-- ${PAGE_LAYOUT_MARKER} -->
<h1>${(0, confluenceStorage_1.escapeStorageValue)(route.pageHeading)}</h1>
${navigationSection}
<h2>Summary</h2>
${(0, confluenceStorage_1.renderParagraphs)(payload.summary)}
<h2>Latest Update</h2>
${(0, confluenceStorage_1.renderParagraphs)(payload.message)}
<h2>Metadata</h2>
${renderMetadataBlock(payload, route)}
<h2>Change History</h2>
${HISTORY_START_MARKER}
${historyEntries.join('\n')}
${HISTORY_END_MARKER}
  `.trim();
}
