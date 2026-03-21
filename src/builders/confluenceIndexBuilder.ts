import { AppError } from '../errors/appError';
import type { DocumentationIndexEntry, DocumentationIndexPageType } from '../types/webhook';
import { escapeStorageValue, renderParagraphs } from './confluenceStorage';

const INDEX_LAYOUT_MARKER = 'DOC_SYNC_INDEX_LAYOUT_V2';
const LEGACY_INDEX_LAYOUT_MARKER = 'DOC_SYNC_INDEX_LAYOUT_V1';
const INDEX_DATA_START_MARKER = '<!-- DOC_SYNC_INDEX_DATA_START -->';
const INDEX_DATA_END_MARKER = '<!-- DOC_SYNC_INDEX_DATA_END -->';
export const INDEX_ENTRIES_PAGE_PROPERTY_KEY = 'doc-sync-index-entries';

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

function decodeIndexEntries(encodedEntries: string): DocumentationIndexEntry[] {
  try {
    return JSON.parse(decodeURIComponent(encodedEntries)) as DocumentationIndexEntry[];
  } catch (error) {
    throw new AppError('UPSTREAM_ERROR', 'Index page content is not in the expected structured format.', 502, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function sortIndexEntries(entries: DocumentationIndexEntry[]): DocumentationIndexEntry[] {
  /**
   * Index pages should always render in a stable alphabetical order so repeated syncs do not reshuffle identical data.
   *
   * We sort by title first because that is what users read, and we use page id as a final tie-breaker to avoid any
   * locale or duplicate-title ambiguity from producing non-deterministic output between runs.
   */
  return [...entries].sort((left, right) => {
    const titleComparison = left.pageTitle.localeCompare(right.pageTitle);

    if (titleComparison !== 0) {
      return titleComparison;
    }

    return left.pageId.localeCompare(right.pageId);
  });
}

function renderIndexLinkList(entries: DocumentationIndexEntry[]): string {
  if (entries.length === 0) {
    return '<p>No routed pages have been synced into this index yet.</p>';
  }

  return [
    '<ul>',
    ...entries.map(
      (entry) =>
        `  <li><p><a href="${escapeStorageValue(entry.pageUrl)}">${escapeStorageValue(entry.pageTitle)}</a></p></li>`
    ),
    '</ul>',
  ].join('\n');
}

export function extractIndexEntriesFromLegacyContent(existingContent: string): DocumentationIndexEntry[] {
  const trimmedExistingContent = existingContent.trim();

  if (!trimmedExistingContent.includes(LEGACY_INDEX_LAYOUT_MARKER)) {
    return [];
  }

  const dataMatch = trimmedExistingContent.match(
    /<!-- DOC_SYNC_INDEX_DATA_START -->([\s\S]*?)<!-- DOC_SYNC_INDEX_DATA_END -->/
  );

  if (!dataMatch) {
    throw new AppError('UPSTREAM_ERROR', 'Legacy index page is missing its structured data block.', 502, {
      marker: INDEX_DATA_START_MARKER,
    });
  }

  return sortIndexEntries(decodeIndexEntries(dataMatch[1].trim()));
}

export function renderIndexPageContent(entries: DocumentationIndexEntry[]): string {
  return renderIndexLinkList(sortIndexEntries(entries));
}

export function renderIndexPage(options: {
  indexPageTitle: string;
  indexPageType: DocumentationIndexPageType;
  entries: DocumentationIndexEntry[];
}): string {
  /**
   * The visible page body intentionally contains only human-readable Confluence storage markup.
   *
   * Structured entry data now lives in a page property so the body can stay lightweight while still being fully
   * regenerated from a deterministic source of truth during each sync.
   */
  return `
<!-- ${INDEX_LAYOUT_MARKER} -->
<h1>${escapeStorageValue(options.indexPageTitle)}</h1>
<h2>Overview</h2>
${renderParagraphs(getIndexOverview(options.indexPageType))}
<h2>Linked Pages</h2>
${renderIndexPageContent(options.entries)}
  `.trim();
}
