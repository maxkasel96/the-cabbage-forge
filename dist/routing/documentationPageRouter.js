"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRoute = resolveRoute;
exports.buildPageTitle = buildPageTitle;
const appError_1 = require("../errors/appError");
function normalizeReadableIdentifier(value) {
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
function normalizeLiteralIdentifier(value) {
    return value.trim().replace(/\s+/g, ' ');
}
function buildRouteFromCandidate(candidate) {
    return {
        pageType: candidate.pageType,
        identifier: candidate.identifier,
        pageHeading: candidate.identifier,
        routingSource: candidate.routingSource,
        pageTitle: buildPageTitle(candidate),
    };
}
function toRoutePrefix(pageType) {
    switch (pageType) {
        case 'feature-page':
            return 'Feature';
        case 'system-page':
            return 'System';
        case 'integration-page':
            return 'Integration';
        case 'release-page':
            return 'Release';
        case 'incident-page':
            return 'Incident';
        default:
            return 'Documentation';
    }
}
function extractIncidentIdentifier(payload) {
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
function extractReleaseIdentifier(payload) {
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
function resolveRoute(payload) {
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
    throw new appError_1.AppError('BAD_REQUEST', 'Payload did not include enough routing context to resolve a documentation page.', 400, {
        requiredRoutingFields: ['feature', 'system', 'integration', 'release', 'incidentId'],
        receivedEventType: payload.eventType,
    });
}
/**
 * Keeping title generation in one helper prevents title drift between routing, logging, and success responses.
 */
function buildPageTitle(route) {
    return `${toRoutePrefix(route.pageType)} - ${route.identifier}`;
}
