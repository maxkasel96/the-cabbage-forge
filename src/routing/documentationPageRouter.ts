import { AppError } from '../errors/appError';
import type {
  DocumentationPageRoute,
  DocumentationPageType,
  DocumentationRoutingSource,
  ValidatedDocumentationWebhookPayload,
} from '../types/webhook';

interface RouteIdentifierCandidate {
  pageType: DocumentationPageType;
  identifier: string;
  routingSource: DocumentationRoutingSource;
}

export function normalizeReadableIdentifier(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]+$/.test(word) || /\d/.test(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function normalizeLiteralIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildRouteFromCandidate(candidate: RouteIdentifierCandidate): DocumentationPageRoute {
  return {
    pageType: candidate.pageType,
    identifier: candidate.identifier,
    pageHeading: candidate.identifier,
    routingSource: candidate.routingSource,
    pageTitle: buildPageTitle(candidate),
  };
}

export function buildRouteFromRoutingSource(
  routingSource: DocumentationRoutingSource,
  rawIdentifier: string
): DocumentationPageRoute {
  switch (routingSource) {
    case 'feature':
      return buildRouteFromCandidate({
        pageType: 'feature-page',
        identifier: normalizeReadableIdentifier(rawIdentifier),
        routingSource,
      });
    case 'system':
      return buildRouteFromCandidate({
        pageType: 'system-page',
        identifier: normalizeReadableIdentifier(rawIdentifier),
        routingSource,
      });
    case 'integration':
      return buildRouteFromCandidate({
        pageType: 'integration-page',
        identifier: normalizeReadableIdentifier(rawIdentifier),
        routingSource,
      });
    case 'runbook':
      return buildRouteFromCandidate({
        pageType: 'runbook-page',
        identifier: normalizeReadableIdentifier(rawIdentifier),
        routingSource,
      });
    case 'release':
      return buildRouteFromCandidate({
        pageType: 'release-page',
        identifier: normalizeLiteralIdentifier(rawIdentifier),
        routingSource,
      });
    case 'incidentId':
      return buildRouteFromCandidate({
        pageType: 'incident-page',
        identifier: normalizeLiteralIdentifier(rawIdentifier),
        routingSource,
      });
    case 'timestamp':
      return buildRouteFromCandidate({
        pageType: 'release-page',
        identifier: normalizeLiteralIdentifier(rawIdentifier),
        routingSource,
      });
    default:
      throw new AppError('BAD_REQUEST', 'Unsupported routing source for documentation page route.', 400, {
        routingSource,
      });
  }
}

function toRoutePrefix(pageType: DocumentationPageType): string {
  switch (pageType) {
    case 'feature-page':
      return 'Feature';
    case 'system-page':
      return 'System';
    case 'integration-page':
      return 'Integration';
    case 'runbook-page':
      return 'Runbook';
    case 'release-page':
      return 'Release';
    case 'incident-page':
      return 'Incident';
    default:
      return 'Documentation';
  }
}

function extractIncidentIdentifier(payload: ValidatedDocumentationWebhookPayload): RouteIdentifierCandidate {
  if (payload.incidentId) {
    return {
      pageType: 'incident-page',
      identifier: normalizeLiteralIdentifier(payload.incidentId),
      routingSource: 'incidentId',
    };
  }

  return {
    pageType: 'incident-page',
    identifier: payload.timestamp.slice(0, 10),
    routingSource: 'timestamp',
  };
}

function extractReleaseIdentifier(payload: ValidatedDocumentationWebhookPayload): RouteIdentifierCandidate {
  if (payload.release) {
    return {
      pageType: 'release-page',
      identifier: normalizeLiteralIdentifier(payload.release),
      routingSource: 'release',
    };
  }

  return {
    pageType: 'release-page',
    identifier: payload.timestamp.slice(0, 10),
    routingSource: 'timestamp',
  };
}

/**
 * The route resolver deliberately uses a very small ruleset with explicit precedence.
 *
 * Event-type-specific routes win first because they communicate the strongest intent. After that, we fall back to the
 * most specific optional identifier field present in the payload. This keeps routing deterministic today while making
 * it easy to add another page type later by inserting one more small branch.
 */
export function resolveRoute(
  payload: ValidatedDocumentationWebhookPayload
): DocumentationPageRoute {
  if (payload.eventType === 'incident') {
    return buildRouteFromCandidate(extractIncidentIdentifier(payload));
  }

  if (payload.eventType === 'release') {
    return buildRouteFromCandidate(extractReleaseIdentifier(payload));
  }

  if (payload.eventType === 'integration-update' && payload.integration) {
    return buildRouteFromCandidate({
      pageType: 'integration-page',
      identifier: normalizeReadableIdentifier(payload.integration),
      routingSource: 'integration',
    });
  }

  if (payload.eventType === 'runbook-update' && payload.runbook) {
    return buildRouteFromCandidate({
      pageType: 'runbook-page',
      identifier: normalizeReadableIdentifier(payload.runbook),
      routingSource: 'runbook',
    });
  }

  if (payload.eventType === 'system-update' && payload.system) {
    return buildRouteFromCandidate({
      pageType: 'system-page',
      identifier: normalizeReadableIdentifier(payload.system),
      routingSource: 'system',
    });
  }

  if (payload.incidentId) {
    return buildRouteFromCandidate({
      pageType: 'incident-page',
      identifier: normalizeLiteralIdentifier(payload.incidentId),
      routingSource: 'incidentId',
    });
  }

  if (payload.release) {
    return buildRouteFromCandidate({
      pageType: 'release-page',
      identifier: normalizeLiteralIdentifier(payload.release),
      routingSource: 'release',
    });
  }

  if (payload.integration) {
    return buildRouteFromCandidate({
      pageType: 'integration-page',
      identifier: normalizeReadableIdentifier(payload.integration),
      routingSource: 'integration',
    });
  }

  if (payload.runbook) {
    return buildRouteFromCandidate({
      pageType: 'runbook-page',
      identifier: normalizeReadableIdentifier(payload.runbook),
      routingSource: 'runbook',
    });
  }

  if (payload.system) {
    return buildRouteFromCandidate({
      pageType: 'system-page',
      identifier: normalizeReadableIdentifier(payload.system),
      routingSource: 'system',
    });
  }

  if (payload.feature) {
    return buildRouteFromCandidate({
      pageType: 'feature-page',
      identifier: normalizeReadableIdentifier(payload.feature),
      routingSource: 'feature',
    });
  }

  throw new AppError('BAD_REQUEST', 'Payload did not include enough routing context to resolve a documentation page.', 400, {
    requiredRoutingFields: ['feature', 'system', 'integration', 'runbook', 'release', 'incidentId'],
    receivedEventType: payload.eventType,
  });
}

/**
 * Keeping title generation in one helper prevents title drift between routing, logging, and success responses.
 */
export function buildPageTitle(route: Pick<DocumentationPageRoute, 'pageType' | 'identifier'>): string {
  return `${toRoutePrefix(route.pageType)} - ${route.identifier}`;
}
