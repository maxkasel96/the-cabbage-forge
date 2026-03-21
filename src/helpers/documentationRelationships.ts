import { CONFLUENCE_TARGET_PAGE_ID } from '../config/constants';
import { buildRouteFromRoutingSource } from '../routing/documentationPageRouter';
import type { ConfluencePageService } from '../services/confluencePageService';
import type {
  DocumentationPageRoute,
  DocumentationRoutingSource,
  ResolvedRelatedPage,
  ValidatedDocumentationWebhookPayload,
} from '../types/webhook';
import { escapeStorageValue } from '../builders/confluenceStorage';
import { buildConfluencePageUrl } from './documentationIndexing';

interface RelatedRouteCandidate {
  routingSource: DocumentationRoutingSource;
}

const RELATED_ROUTE_CANDIDATES: RelatedRouteCandidate[] = [
  { routingSource: 'feature' },
  { routingSource: 'system' },
  { routingSource: 'integration' },
  { routingSource: 'release' },
  { routingSource: 'incidentId' },
];

function getPayloadValueForRoutingSource(
  payload: ValidatedDocumentationWebhookPayload,
  routingSource: DocumentationRoutingSource
): string | undefined {
  switch (routingSource) {
    case 'feature':
      return payload.feature;
    case 'system':
      return payload.system;
    case 'integration':
      return payload.integration;
    case 'release':
      return payload.release;
    case 'incidentId':
      return payload.incidentId;
    default:
      return undefined;
  }
}

export function dedupeRelatedRoutes(routes: DocumentationPageRoute[]): DocumentationPageRoute[] {
  /**
   * We deduplicate related routes using the resolved page type plus normalized identifier.
   *
   * That keeps duplicate prevention payload-driven and deterministic before we make any Confluence API calls, while
   * still remaining resilient if different payload fields eventually point at the same title shape.
   */
  const uniqueRoutes = new Map<string, DocumentationPageRoute>();

  for (const route of routes) {
    uniqueRoutes.set(`${route.pageType}::${route.identifier}`, route);
  }

  return [...uniqueRoutes.values()];
}

export function getRelatedRoutesFromPayload(
  payload: ValidatedDocumentationWebhookPayload,
  primaryRoute: DocumentationPageRoute
): DocumentationPageRoute[] {
  /**
   * Related links come only from explicit payload routing fields.
   *
   * We intentionally do not inspect titles, page bodies, or Confluence history. The payload already tells us which
   * neighboring documentation pages matter for this sync event, so we simply convert those non-primary fields into the
   * same route objects used elsewhere in the system.
   */
  const candidateRoutes = RELATED_ROUTE_CANDIDATES.flatMap((candidate) => {
    const rawValue = getPayloadValueForRoutingSource(payload, candidate.routingSource);

    if (!rawValue) {
      return [];
    }

    const route = buildRouteFromRoutingSource(candidate.routingSource, rawValue);
    const isPrimaryRoute =
      route.pageType === primaryRoute.pageType && route.identifier === primaryRoute.identifier;

    return isPrimaryRoute ? [] : [route];
  });

  return dedupeRelatedRoutes(candidateRoutes);
}

export async function resolveRelatedPages(
  pageService: ConfluencePageService,
  routes: DocumentationPageRoute[]
): Promise<ResolvedRelatedPage[]> {
  /**
   * We deliberately reuse the same ensure/create flow as the primary routed page so related links remain reliable.
   *
   * That means a payload can introduce a sideways relationship before the target page has ever been synced directly,
   * and the related section will still point at a stable page id immediately after the current run completes.
   */
  const resolvedPages = await Promise.all(
    routes.map(async (route) => {
      const ensuredPage = await pageService.ensureRoutePageExists(CONFLUENCE_TARGET_PAGE_ID, route);

      return {
        pageId: ensuredPage.page.id,
        pageTitle: ensuredPage.page.title,
        pageType: route.pageType,
        identifier: route.identifier,
        pageUrl: buildConfluencePageUrl(ensuredPage.page.id),
        createdPage: ensuredPage.createdPage,
      } satisfies ResolvedRelatedPage;
    })
  );

  return resolvedPages.sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
}

export function buildRelatedDocumentationSection(relatedPages: ResolvedRelatedPage[]): string {
  if (relatedPages.length === 0) {
    return '';
  }

  return [
    '<h2>Related Documentation</h2>',
    '<ul>',
    ...relatedPages.map(
      (page) =>
        `  <li><p><a href="${escapeStorageValue(page.pageUrl)}">${escapeStorageValue(page.pageTitle)}</a></p></li>`
    ),
    '</ul>',
  ].join('\n');
}
