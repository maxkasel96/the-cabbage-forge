"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRelatedIndexPageType = getRelatedIndexPageType;
exports.getIndexPageTitle = getIndexPageTitle;
exports.ensureIndexPageExists = ensureIndexPageExists;
exports.buildConfluencePageUrl = buildConfluencePageUrl;
exports.buildNavigationSection = buildNavigationSection;
exports.buildIndexEntry = buildIndexEntry;
exports.updateIndexPage = updateIndexPage;
const constants_1 = require("../config/constants");
function getIndexPrefix(indexPageType) {
    switch (indexPageType) {
        case 'features-index':
            return 'Features Index';
        case 'systems-index':
            return 'Systems Index';
        case 'integrations-index':
            return 'Integrations Index';
        case 'releases-index':
            return 'Releases Index';
        case 'incidents-index':
            return 'Incidents Index';
        default:
            return 'Documentation Index';
    }
}
function getRelatedIndexPageType(pageType) {
    switch (pageType) {
        case 'feature-page':
            return 'features-index';
        case 'system-page':
            return 'systems-index';
        case 'integration-page':
            return 'integrations-index';
        case 'release-page':
            return 'releases-index';
        case 'incident-page':
            return 'incidents-index';
        default:
            return 'features-index';
    }
}
function getIndexPageTitle(pageType) {
    return getIndexPrefix(getRelatedIndexPageType(pageType));
}
async function ensureIndexPageExists(pageService, fallbackPageId, pageType) {
    return pageService.ensurePageExists(fallbackPageId, getIndexPageTitle(pageType));
}
function buildConfluencePageUrl(pageId) {
    return `${constants_1.CONFLUENCE_SITE_BASE_URL}/spaces/${encodeURIComponent(constants_1.CONFLUENCE_TARGET_SPACE_KEY)}/pages/${encodeURIComponent(pageId)}`;
}
function buildNavigationSection(route, indexPage) {
    const indexPageTitle = getIndexPageTitle(route.pageType);
    return `
<h2>Navigation</h2>
<ul>
  <li><p><a href="${buildConfluencePageUrl(indexPage.id)}">${indexPageTitle}</a></p></li>
</ul>
  `.trim();
}
function buildIndexEntry(route, pageInfo, lastUpdated) {
    return {
        pageId: pageInfo.id,
        pageTitle: pageInfo.title,
        pageType: route.pageType,
        identifier: route.identifier,
        pageUrl: buildConfluencePageUrl(pageInfo.id),
        lastUpdated,
    };
}
function updateIndexPage(existingEntries, routedPageEntry) {
    const existingEntryIndex = existingEntries.findIndex((entry) => entry.pageId === routedPageEntry.pageId || entry.pageTitle === routedPageEntry.pageTitle);
    if (existingEntryIndex === -1) {
        const entries = [...existingEntries, routedPageEntry].sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
        return {
            entries,
            indexUpdated: true,
        };
    }
    const nextEntries = [...existingEntries];
    const previousEntry = nextEntries[existingEntryIndex];
    const nextEntry = {
        ...previousEntry,
        ...routedPageEntry,
    };
    const indexUpdated = JSON.stringify(previousEntry) !== JSON.stringify(nextEntry);
    nextEntries[existingEntryIndex] = nextEntry;
    nextEntries.sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
    return {
        entries: nextEntries,
        indexUpdated,
    };
}
