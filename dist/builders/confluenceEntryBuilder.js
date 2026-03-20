"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildConfluenceDocumentationEntry = buildConfluenceDocumentationEntry;
/**
 * Confluence storage format is XML-like markup, so every user-controlled string needs to be escaped before it is
 * interpolated into the table or macro body. Keeping the escaping logic local to the builder reduces the chance of a
 * future refactor forgetting to sanitize one field.
 */
function escapeStorageValue(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function buildConfluenceDocumentationEntry(payload) {
    const rawPayloadJson = escapeStorageValue(JSON.stringify(payload, null, 2));
    return `
<hr />
<h2>Documentation Update</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p>Event Type</p></th>
      <td><p>${escapeStorageValue(payload.eventType)}</p></td>
    </tr>
    <tr>
      <th><p>Source</p></th>
      <td><p>${escapeStorageValue(payload.source)}</p></td>
    </tr>
    <tr>
      <th><p>Feature</p></th>
      <td><p>${escapeStorageValue(payload.feature)}</p></td>
    </tr>
    <tr>
      <th><p>Summary</p></th>
      <td><p>${escapeStorageValue(payload.summary)}</p></td>
    </tr>
    <tr>
      <th><p>Message</p></th>
      <td><p>${escapeStorageValue(payload.message)}</p></td>
    </tr>
    <tr>
      <th><p>Timestamp</p></th>
      <td><p>${escapeStorageValue(payload.timestamp)}</p></td>
    </tr>
  </tbody>
</table>
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">Validated payload</ac:parameter>
  <ac:rich-text-body>
    <pre>${rawPayloadJson}</pre>
  </ac:rich-text-body>
</ac:structured-macro>
`.trim();
}
