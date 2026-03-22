import { CONFLUENCE_SITE_BASE_URL, CONFLUENCE_TARGET_SPACE_KEY } from '../config/constants';
import type { ConfluencePageReadModel, EnsureConfluencePageResult } from '../types/confluence';
import type {
  DocumentationIndexEntry,
  DocumentationIndexPageType,
  DocumentationPageRoute,
  DocumentationPageType,
} from '../types/webhook';

interface ConfluencePageEnsurer {
  ensurePageExists(fallbackPageId: string, pageTitle: string): Promise<EnsureConfluencePageResult>;
}

function getIndexPrefix(indexPageType: DocumentationIndexPageType): string {
  switch (indexPageType) {
    case 'features-index':
      return 'Features Index';
    case 'systems-index':
      return 'Systems Index';
    case 'integrations-index':
      return 'Integrations Index';
    case 'runbooks-index':
      return 'Runbooks Index';
    case 'releases-index':
      return 'Releases Index';
    case 'incidents-index':
      return 'Incidents Index';
    default:
      return 'Documentation Index';
  }
}

export function getRelatedIndexPageType(pageType: DocumentationPageType): DocumentationIndexPageType {
  switch (pageType) {
    case 'feature-page':
      return 'features-index';
    case 'system-page':
      return 'systems-index';
    case 'integration-page':
      return 'integrations-index';
    case 'runbook-page':
      return 'runbooks-index';
    case 'release-page':
      return 'releases-index';
    case 'incident-page':
      return 'incidents-index';
    default:
      return 'features-index';
  }
}

export function getIndexPageTitle(pageType: DocumentationPageType): string {
  return getIndexPrefix(getRelatedIndexPageType(pageType));
}

export async function ensureIndexPageExists(
  pageService: ConfluencePageEnsurer,
  fallbackPageId: string,
  pageType: DocumentationPageType
): Promise<EnsureConfluencePageResult> {
  return pageService.ensurePageExists(fallbackPageId, getIndexPageTitle(pageType));
}

export function buildConfluencePageUrl(pageId: string): string {
  return `${CONFLUENCE_SITE_BASE_URL}/spaces/${encodeURIComponent(CONFLUENCE_TARGET_SPACE_KEY)}/pages/${encodeURIComponent(pageId)}`;
}

export function buildNavigationSection(route: DocumentationPageRoute, indexPage: ConfluencePageReadModel): string {
  const indexPageTitle = getIndexPageTitle(route.pageType);

  return `
<h2>Navigation</h2>
<ul>
  <li><p><a href="${buildConfluencePageUrl(indexPage.id)}">${indexPageTitle}</a></p></li>
</ul>
  `.trim();
}

export function buildIndexEntry(
  route: DocumentationPageRoute,
  pageInfo: Pick<ConfluencePageReadModel, 'id' | 'title'>,
  lastUpdated: string
): DocumentationIndexEntry {
  return {
    pageId: pageInfo.id,
    pageTitle: pageInfo.title,
    pageType: route.pageType,
    identifier: route.identifier,
    pageUrl: buildConfluencePageUrl(pageInfo.id),
    lastUpdated,
  };
}

export function updateIndexPage(
  existingEntries: DocumentationIndexEntry[],
  routedPageEntry: DocumentationIndexEntry
): {
  entries: DocumentationIndexEntry[];
  indexUpdated: boolean;
} {
  const existingEntryIndex = existingEntries.findIndex(
    (entry) => entry.pageId === routedPageEntry.pageId || entry.pageTitle === routedPageEntry.pageTitle
  );

  if (existingEntryIndex === -1) {
    const entries = [...existingEntries, routedPageEntry].sort((left, right) =>
      left.pageTitle.localeCompare(right.pageTitle)
    );

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
