"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dedupeRelatedPageReferenceCandidates = dedupeRelatedPageReferenceCandidates;
exports.extractRelatedPageReferencesFromPayload = extractRelatedPageReferencesFromPayload;
exports.resolveRelatedPages = resolveRelatedPages;
exports.buildRelatedDocumentationSection = buildRelatedDocumentationSection;
const confluenceStorage_1 = require("../builders/confluenceStorage");
const documentationPageRouter_1 = require("../routing/documentationPageRouter");
const documentationIndexing_1 = require("./documentationIndexing");
const RELATED_PAYLOAD_FIELD_CONFIGS = [
    {
        fieldName: 'relatedFeatures',
        pageType: 'feature-page',
        normalizeIdentifier: documentationPageRouter_1.normalizeReadableIdentifier,
    },
    {
        fieldName: 'relatedSystems',
        pageType: 'system-page',
        normalizeIdentifier: documentationPageRouter_1.normalizeReadableIdentifier,
    },
    {
        fieldName: 'relatedIntegrations',
        pageType: 'integration-page',
        normalizeIdentifier: documentationPageRouter_1.normalizeReadableIdentifier,
    },
    {
        fieldName: 'relatedReleases',
        pageType: 'release-page',
        normalizeIdentifier: documentationPageRouter_1.normalizeLiteralIdentifier,
    },
    {
        fieldName: 'relatedIncidents',
        pageType: 'incident-page',
        normalizeIdentifier: documentationPageRouter_1.normalizeLiteralIdentifier,
    },
];
function buildRelatedPageReferenceCandidate(pageType, rawIdentifier, normalizeIdentifier) {
    const normalizedIdentifier = normalizeIdentifier(rawIdentifier);
    if (!normalizedIdentifier) {
        return undefined;
    }
    return {
        pageType,
        identifier: normalizedIdentifier,
        pageTitle: (0, documentationPageRouter_1.buildPageTitle)({
            pageType,
            identifier: normalizedIdentifier,
        }),
    };
}
function dedupeRelatedPageReferenceCandidates(candidates) {
    /**
     * Related documentation must stay payload-driven, so the first deduplication pass happens before any Confluence read.
     *
     * We key by the exact page title that the seeded page-generation flow already uses. That keeps duplicate prevention
     * deterministic even when multiple payload arrays accidentally mention the same target more than once.
     */
    const uniqueCandidates = new Map();
    for (const candidate of candidates) {
        uniqueCandidates.set(candidate.pageTitle, candidate);
    }
    return [...uniqueCandidates.values()];
}
function extractRelatedPageReferencesFromPayload(payload, primaryRoute) {
    /**
     * We only trust explicit relationship arrays that arrived inside the webhook payload.
     *
     * That means we do not infer sideways links from the primary routing fields, page body text, or prior Confluence
     * state. Each related entry must be declared by the upstream payload contract and mapped to a known documentation
     * page type via the field that carried it.
     */
    const extractedCandidates = RELATED_PAYLOAD_FIELD_CONFIGS.flatMap((config) => {
        const relatedIdentifiers = payload[config.fieldName] ?? [];
        return relatedIdentifiers.flatMap((relatedIdentifier) => {
            const candidate = buildRelatedPageReferenceCandidate(config.pageType, relatedIdentifier, config.normalizeIdentifier);
            if (!candidate) {
                return [];
            }
            const isPrimaryPage = candidate.pageType === primaryRoute.pageType && candidate.pageTitle === primaryRoute.pageTitle;
            return isPrimaryPage ? [] : [candidate];
        });
    });
    return dedupeRelatedPageReferenceCandidates(extractedCandidates);
}
async function resolveRelatedPages(pageService, spaceId, relatedPageReferences) {
    /**
     * Resolution is intentionally lightweight: at render time we look up each expected page title inside the current
     * Confluence space and link only the pages that already exist.
     *
     * We do not create missing related pages here because routing and page-creation behavior for the primary sync path is
     * already stable and intentionally out of scope for this feature.
     */
    const resolvedPages = await Promise.all(relatedPageReferences.map(async (reference) => {
        const existingPage = await pageService.findPageByTitleInSpace(reference.pageTitle, spaceId);
        if (!existingPage) {
            return undefined;
        }
        return {
            pageId: existingPage.id,
            pageTitle: existingPage.title,
            pageType: reference.pageType,
            identifier: reference.identifier,
            pageUrl: (0, documentationIndexing_1.buildConfluencePageUrl)(existingPage.id),
            createdPage: false,
        };
    }));
    /**
     * The second deduplication pass protects the rendered section in case Confluence returns the same page for multiple
     * candidate titles or if upstream payload arrays duplicated entries that normalize to the same seeded title.
     */
    const uniqueResolvedPages = new Map();
    for (const resolvedPage of resolvedPages) {
        if (!resolvedPage) {
            continue;
        }
        const dedupeKey = resolvedPage.pageId || resolvedPage.pageTitle;
        uniqueResolvedPages.set(dedupeKey, resolvedPage);
    }
    return [...uniqueResolvedPages.values()].sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
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
