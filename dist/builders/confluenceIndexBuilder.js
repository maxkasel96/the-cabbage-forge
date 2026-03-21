"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDEX_ENTRIES_PAGE_PROPERTY_KEY = void 0;
exports.extractIndexEntriesFromLegacyContent = extractIndexEntriesFromLegacyContent;
exports.renderIndexPageContent = renderIndexPageContent;
exports.renderIndexPage = renderIndexPage;
const appError_1 = require("../errors/appError");
const confluenceStorage_1 = require("./confluenceStorage");
const INDEX_LAYOUT_MARKER = 'DOC_SYNC_INDEX_LAYOUT_V2';
const LEGACY_INDEX_LAYOUT_MARKER = 'DOC_SYNC_INDEX_LAYOUT_V1';
const INDEX_DATA_START_MARKER = '<!-- DOC_SYNC_INDEX_DATA_START -->';
const INDEX_DATA_END_MARKER = '<!-- DOC_SYNC_INDEX_DATA_END -->';
exports.INDEX_ENTRIES_PAGE_PROPERTY_KEY = 'doc-sync-index-entries';
function getIndexOverview(indexPageType) {
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
function decodeIndexEntries(encodedEntries) {
    try {
        return JSON.parse(decodeURIComponent(encodedEntries));
    }
    catch (error) {
        throw new appError_1.AppError('UPSTREAM_ERROR', 'Index page content is not in the expected structured format.', 502, {
            cause: error instanceof Error ? error.message : String(error),
        });
    }
}
function sortIndexEntries(entries) {
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
function renderIndexLinkList(entries) {
    if (entries.length === 0) {
        return '<p>No routed pages have been synced into this index yet.</p>';
    }
    return [
        '<ul>',
        ...entries.map((entry) => `  <li><p><a href="${(0, confluenceStorage_1.escapeStorageValue)(entry.pageUrl)}">${(0, confluenceStorage_1.escapeStorageValue)(entry.pageTitle)}</a></p></li>`),
        '</ul>',
    ].join('\n');
}
function extractIndexEntriesFromLegacyContent(existingContent) {
    const trimmedExistingContent = existingContent.trim();
    if (!trimmedExistingContent.includes(LEGACY_INDEX_LAYOUT_MARKER)) {
        return [];
    }
    const dataMatch = trimmedExistingContent.match(/<!-- DOC_SYNC_INDEX_DATA_START -->([\s\S]*?)<!-- DOC_SYNC_INDEX_DATA_END -->/);
    if (!dataMatch) {
        throw new appError_1.AppError('UPSTREAM_ERROR', 'Legacy index page is missing its structured data block.', 502, {
            marker: INDEX_DATA_START_MARKER,
        });
    }
    return sortIndexEntries(decodeIndexEntries(dataMatch[1].trim()));
}
function renderIndexPageContent(entries) {
    return renderIndexLinkList(sortIndexEntries(entries));
}
function renderIndexPage(options) {
    /**
     * The visible page body intentionally contains only human-readable Confluence storage markup.
     *
     * Structured entry data now lives in a page property so the body can stay lightweight while still being fully
     * regenerated from a deterministic source of truth during each sync.
     */
    return `
<!-- ${INDEX_LAYOUT_MARKER} -->
<h1>${(0, confluenceStorage_1.escapeStorageValue)(options.indexPageTitle)}</h1>
<h2>Overview</h2>
${(0, confluenceStorage_1.renderParagraphs)(getIndexOverview(options.indexPageType))}
<h2>Linked Pages</h2>
${renderIndexPageContent(options.entries)}
  `.trim();
}
