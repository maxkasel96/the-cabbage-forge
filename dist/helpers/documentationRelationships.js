"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dedupeRelatedRoutes = dedupeRelatedRoutes;
exports.getRelatedRoutesFromPayload = getRelatedRoutesFromPayload;
exports.resolveRelatedPages = resolveRelatedPages;
exports.buildRelatedDocumentationSection = buildRelatedDocumentationSection;
const constants_1 = require("../config/constants");
const documentationPageRouter_1 = require("../routing/documentationPageRouter");
const confluenceStorage_1 = require("../builders/confluenceStorage");
const documentationIndexing_1 = require("./documentationIndexing");
const RELATED_ROUTE_CANDIDATES = [
    { routingSource: 'feature' },
    { routingSource: 'system' },
    { routingSource: 'integration' },
    { routingSource: 'release' },
    { routingSource: 'incidentId' },
];
function getPayloadValueForRoutingSource(payload, routingSource) {
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
function dedupeRelatedRoutes(routes) {
    /**
     * We deduplicate related routes using the resolved page type plus normalized identifier.
     *
     * That keeps duplicate prevention payload-driven and deterministic before we make any Confluence API calls, while
     * still remaining resilient if different payload fields eventually point at the same title shape.
     */
    const uniqueRoutes = new Map();
    for (const route of routes) {
        uniqueRoutes.set(`${route.pageType}::${route.identifier}`, route);
    }
    return [...uniqueRoutes.values()];
}
function getRelatedRoutesFromPayload(payload, primaryRoute) {
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
        const route = (0, documentationPageRouter_1.buildRouteFromRoutingSource)(candidate.routingSource, rawValue);
        const isPrimaryRoute = route.pageType === primaryRoute.pageType && route.identifier === primaryRoute.identifier;
        return isPrimaryRoute ? [] : [route];
    });
    return dedupeRelatedRoutes(candidateRoutes);
}
async function resolveRelatedPages(pageService, routes) {
    /**
     * We deliberately reuse the same ensure/create flow as the primary routed page so related links remain reliable.
     *
     * That means a payload can introduce a sideways relationship before the target page has ever been synced directly,
     * and the related section will still point at a stable page id immediately after the current run completes.
     */
    const resolvedPages = await Promise.all(routes.map(async (route) => {
        const ensuredPage = await pageService.ensureRoutePageExists(constants_1.CONFLUENCE_TARGET_PAGE_ID, route);
        return {
            pageId: ensuredPage.page.id,
            pageTitle: ensuredPage.page.title,
            pageType: route.pageType,
            identifier: route.identifier,
            pageUrl: (0, documentationIndexing_1.buildConfluencePageUrl)(ensuredPage.page.id),
            createdPage: ensuredPage.createdPage,
        };
    }));
    return resolvedPages.sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
}
function buildRelatedDocumentationSection(relatedPages) {
    if (relatedPages.length === 0) {
        return '';
    }
    return [
        '<h2>Related Documentation</h2>',
        '<ul>',
        ...relatedPages.map((page) => `  <li><p><a href="${(0, confluenceStorage_1.escapeStorageValue)(page.pageUrl)}">${(0, confluenceStorage_1.escapeStorageValue)(page.pageTitle)}</a></p></li>`),
        '</ul>',
    ].join('\n');
}
