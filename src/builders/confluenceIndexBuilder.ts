import { AppError } from '../errors/appError';
import type { DocumentationIndexEntry, DocumentationIndexPageType } from '../types/webhook';
import { escapeStorageValue, renderParagraphs } from './confluenceStorage';

const INDEX_LAYOUT_MARKER = 'DOC_SYNC_INDEX_LAYOUT_V1';
const INDEX_DATA_START_MARKER = '<!-- DOC_SYNC_INDEX_DATA_START -->';
const INDEX_DATA_END_MARKER = '<!-- DOC_SYNC_INDEX_DATA_END -->';

function getIndexOverview(indexPageType: DocumentationIndexPageType): string {
  switch (indexPageType) {
    case 'features-index':
      return 'This index keeps the current feature documentation pages in one predictable place for quick navigation.';
    case 'systems-index':
      return 'This index keeps the current system documentation pages in one predictable place for quick navigation.';
    case 'integrations-index':
      return 'This index keeps the current integration documentation pages in one predictable place for quick navigation.';
    case 'releases-index':
      return 'This index keeps the current release documentation pages in one predictable place for quick navigation.';
    case 'incidents-index':
      return 'This index keeps the current incident documentation pages in one predictable place for quick navigation.';
    default:
      return 'This index keeps the current documentation pages in one predictable place for quick navigation.';
  }
}

function encodeIndexEntries(entries: DocumentationIndexEntry[]): string {
  return encodeURIComponent(JSON.stringify(entries));
}

function decodeIndexEntries(encodedEntries: string): DocumentationIndexEntry[] {
  try {
    return JSON.parse(decodeURIComponent(encodedEntries)) as DocumentationIndexEntry[];
  } catch (error) {
    throw new AppError('UPSTREAM_ERROR', 'Index page content is not in the expected structured format.', 502, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function renderIndexRows(entries: DocumentationIndexEntry[]): string {
  if (entries.length === 0) {
    return `
      <tr>
        <td colspan="4"><p>No routed pages have been synced into this index yet.</p></td>
      </tr>
    `.trim();
  }

  return entries
    .map(
      (entry) => `
        <tr>
          <td><p><a href="${escapeStorageValue(entry.pageUrl)}">${escapeStorageValue(entry.pageTitle)}</a></p></td>
          <td><p>${entry.lastUpdated ? escapeStorageValue(entry.lastUpdated) : '—'}</p></td>
          <td><p>${entry.identifier ? escapeStorageValue(entry.identifier) : '—'}</p></td>
          <td><p>${escapeStorageValue(entry.pageId)}</p></td>
        </tr>
      `.trim()
    )
    .join('\n');
}

export function extractIndexEntries(existingContent: string): DocumentationIndexEntry[] {
  const trimmedExistingContent = existingContent.trim();

  if (!trimmedExistingContent.includes(INDEX_LAYOUT_MARKER)) {
    return [];
  }

  const dataMatch = trimmedExistingContent.match(
    /<!-- DOC_SYNC_INDEX_DATA_START -->([\s\S]*?)<!-- DOC_SYNC_INDEX_DATA_END -->/
  );

  if (!dataMatch) {
    throw new AppError('UPSTREAM_ERROR', 'Index page is missing its structured data block.', 502, {
      marker: INDEX_DATA_START_MARKER,
    });
  }

  return decodeIndexEntries(dataMatch[1].trim());
}

export function renderIndexPage(options: {
  indexPageTitle: string;
  indexPageType: DocumentationIndexPageType;
  entries: DocumentationIndexEntry[];
  generatedAt: string;
}): string {
  return `
<!-- ${INDEX_LAYOUT_MARKER} -->
${INDEX_DATA_START_MARKER}
${encodeIndexEntries(options.entries)}
${INDEX_DATA_END_MARKER}
<h1>${escapeStorageValue(options.indexPageTitle)}</h1>
<h2>Overview</h2>
${renderParagraphs(getIndexOverview(options.indexPageType))}
<h2>Linked Pages</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p>Page Title</p></th>
      <th><p>Last Updated</p></th>
      <th><p>Routing Identifier</p></th>
      <th><p>Page ID</p></th>
    </tr>
${renderIndexRows(options.entries)}
  </tbody>
</table>
<h2>Metadata</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p>Index Type</p></th>
      <td><p>${escapeStorageValue(options.indexPageType)}</p></td>
    </tr>
    <tr>
      <th><p>Entry Count</p></th>
      <td><p>${String(options.entries.length)}</p></td>
    </tr>
    <tr>
      <th><p>Last Generated</p></th>
      <td><p>${escapeStorageValue(options.generatedAt)}</p></td>
    </tr>
  </tbody>
</table>
  `.trim();
}
