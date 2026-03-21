import { escapeStorageValue } from '../builders/confluenceStorage';
import { buildPageTitle, normalizeLiteralIdentifier, normalizeReadableIdentifier } from '../routing/documentationPageRouter';
import type { ConfluencePageService } from '../services/confluencePageService';
import type {
  DocumentationPageRoute,
  DocumentationPageType,
  DocumentationRelationshipFields,
  ResolvedRelatedPage,
  ValidatedDocumentationWebhookPayload,
} from '../types/webhook';
import { buildConfluencePageUrl } from './documentationIndexing';

interface RelatedPayloadFieldConfig {
  fieldName: keyof DocumentationRelationshipFields;
  pageType: DocumentationPageType;
  normalizeIdentifier: (value: string) => string;
}

const RELATED_PAYLOAD_FIELD_CONFIGS: RelatedPayloadFieldConfig[] = [
  {
    fieldName: 'relatedFeatures',
    pageType: 'feature-page',
    normalizeIdentifier: normalizeReadableIdentifier,
  },
  {
    fieldName: 'relatedSystems',
    pageType: 'system-page',
    normalizeIdentifier: normalizeReadableIdentifier,
  },
  {
    fieldName: 'relatedIntegrations',
    pageType: 'integration-page',
    normalizeIdentifier: normalizeReadableIdentifier,
  },
  {
    fieldName: 'relatedReleases',
    pageType: 'release-page',
    normalizeIdentifier: normalizeLiteralIdentifier,
  },
  {
    fieldName: 'relatedIncidents',
    pageType: 'incident-page',
    normalizeIdentifier: normalizeLiteralIdentifier,
  },
];

interface RelatedPageReferenceCandidate {
  pageType: DocumentationPageType;
  identifier: string;
  pageTitle: string;
}

function buildRelatedPageReferenceCandidate(
  pageType: DocumentationPageType,
  rawIdentifier: string,
  normalizeIdentifier: (value: string) => string
): RelatedPageReferenceCandidate | undefined {
  const normalizedIdentifier = normalizeIdentifier(rawIdentifier);

  if (!normalizedIdentifier) {
    return undefined;
  }

  return {
    pageType,
    identifier: normalizedIdentifier,
    pageTitle: buildPageTitle({
      pageType,
      identifier: normalizedIdentifier,
    }),
  };
}

function buildRelatedCandidateDedupeKey(candidate: Pick<RelatedPageReferenceCandidate, 'pageTitle'>): string {
  return candidate.pageTitle.trim().toLocaleLowerCase();
}

function readRelationshipIdentifiers(
  payload: ValidatedDocumentationWebhookPayload,
  fieldName: keyof DocumentationRelationshipFields
): string[] {
  /**
   * data.detail is now the canonical structured location for relationship arrays, but we keep the legacy top-level
   * fields alive so existing webhook senders do not break while they migrate.
   *
   * We intentionally merge both sources instead of choosing one winner because payload producers may roll forward in
   * stages and briefly send the same relationship list in both places.
   */
  return [...(payload[fieldName] ?? []), ...(payload.data?.detail?.[fieldName] ?? [])];
}

export function dedupeRelatedPageReferenceCandidates(
  candidates: RelatedPageReferenceCandidate[]
): RelatedPageReferenceCandidate[] {
  /**
   * Related documentation must stay payload-driven, so the first deduplication pass happens before any Confluence read.
   *
   * We key by the normalized destination title using case-insensitive comparison. That keeps duplicate prevention
   * deterministic even when both the legacy top-level arrays and the new data.detail arrays mention the same page with
   * slightly different casing.
   */
  const uniqueCandidates = new Map<string, RelatedPageReferenceCandidate>();

  for (const candidate of candidates) {
    uniqueCandidates.set(buildRelatedCandidateDedupeKey(candidate), candidate);
  }

  return [...uniqueCandidates.values()];
}

export function extractRelatedPageReferencesFromPayload(
  payload: ValidatedDocumentationWebhookPayload,
  primaryRoute: DocumentationPageRoute
): RelatedPageReferenceCandidate[] {
  /**
   * We only trust explicit relationship arrays that arrived inside the webhook payload.
   *
   * That means we do not infer sideways links from the primary routing fields, page body text, or prior Confluence
   * state. Each related entry must be declared by the upstream payload contract and mapped to a known documentation
   * page type via the field that carried it.
   */
  const extractedCandidates = RELATED_PAYLOAD_FIELD_CONFIGS.flatMap((config) => {
    const relatedIdentifiers = readRelationshipIdentifiers(payload, config.fieldName);

    return relatedIdentifiers.flatMap((relatedIdentifier) => {
      const candidate = buildRelatedPageReferenceCandidate(
        config.pageType,
        relatedIdentifier,
        config.normalizeIdentifier
      );

      if (!candidate) {
        return [];
      }

      const isPrimaryPage =
        candidate.pageType === primaryRoute.pageType &&
        buildRelatedCandidateDedupeKey(candidate) === buildRelatedCandidateDedupeKey(primaryRoute);

      return isPrimaryPage ? [] : [candidate];
    });
  });

  return dedupeRelatedPageReferenceCandidates(extractedCandidates);
}

export async function resolveRelatedPages(
  pageService: ConfluencePageService,
  spaceId: string,
  relatedPageReferences: RelatedPageReferenceCandidate[]
): Promise<ResolvedRelatedPage[]> {
  /**
   * Resolution is intentionally lightweight: at render time we look up each expected page title inside the current
   * Confluence space and link only the pages that already exist.
   *
   * We do not create missing related pages here because routing and page-creation behavior for the primary sync path is
   * already stable and intentionally out of scope for this feature.
   */
  const resolvedPages = await Promise.all(
    relatedPageReferences.map(async (reference) => {
      const existingPage = await pageService.findPageByTitleInSpace(reference.pageTitle, spaceId);

      if (!existingPage) {
        return undefined;
      }

      return {
        pageId: existingPage.id,
        pageTitle: existingPage.title,
        pageType: reference.pageType,
        identifier: reference.identifier,
        pageUrl: buildConfluencePageUrl(existingPage.id),
        createdPage: false,
      } satisfies ResolvedRelatedPage;
    })
  );

  /**
   * The second deduplication pass protects the rendered section in case Confluence returns the same page for multiple
   * candidate titles or if upstream payload arrays duplicated entries that normalize to the same seeded title.
   */
  const uniqueResolvedPages = new Map<string, ResolvedRelatedPage>();

  for (const resolvedPage of resolvedPages) {
    if (!resolvedPage) {
      continue;
    }

    const dedupeKey = (resolvedPage.pageId || resolvedPage.pageTitle).trim().toLocaleLowerCase();

    uniqueResolvedPages.set(dedupeKey, resolvedPage);
  }

  return [...uniqueResolvedPages.values()].sort((left, right) => left.pageTitle.localeCompare(right.pageTitle));
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
