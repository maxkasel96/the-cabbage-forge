"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDocumentationWebhookPayload = validateDocumentationWebhookPayload;
const constants_1 = require("../config/constants");
const appError_1 = require("../errors/appError");
const documentationPageRouter_1 = require("../routing/documentationPageRouter");
const RELATED_PAYLOAD_FIELD_NAMES = [
    'relatedFeatures',
    'relatedSystems',
    'relatedIntegrations',
    'relatedReleases',
    'relatedIncidents',
];
/**
 * The validation layer is intentionally explicit instead of clever.
 *
 * Forge web triggers often become long-lived integration points, so the small amount of duplication below makes it
 * very easy for the next engineer to see exactly which field failed, why it failed, and which contract values are
 * currently supported.
 */
function requireNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new appError_1.AppError('BAD_REQUEST', `${fieldName} must be a non-empty string.`, 400, {
            field: fieldName,
        });
    }
    return value.trim();
}
function optionalNonEmptyString(value, fieldName) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    if (typeof value !== 'string' || !value.trim()) {
        throw new appError_1.AppError('BAD_REQUEST', `${fieldName} must be a non-empty string when provided.`, 400, {
            field: fieldName,
        });
    }
    return value.trim();
}
function optionalNonEmptyStringArray(value, fieldName) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new appError_1.AppError('BAD_REQUEST', `${fieldName} must be an array of non-empty strings when provided.`, 400, {
            field: fieldName,
        });
    }
    const normalizedItems = value.map((item, index) => {
        if (typeof item !== 'string' || !item.trim()) {
            throw new appError_1.AppError('BAD_REQUEST', `${fieldName} must contain only non-empty strings.`, 400, {
                field: fieldName,
                itemIndex: index,
            });
        }
        return item.trim();
    });
    return normalizedItems.length > 0 ? normalizedItems : undefined;
}
function validateRelationshipFields(relationshipSource) {
    const validatedFields = {};
    for (const fieldName of RELATED_PAYLOAD_FIELD_NAMES) {
        const validatedArray = optionalNonEmptyStringArray(relationshipSource[fieldName], fieldName);
        if (validatedArray) {
            validatedFields[fieldName] = validatedArray;
        }
    }
    return Object.keys(validatedFields).length > 0 ? validatedFields : undefined;
}
function validateStructuredDataPayload(value) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new appError_1.AppError('BAD_REQUEST', 'data must be an object when provided.', 400, {
            field: 'data',
        });
    }
    const data = value;
    /**
     * We only need the structured relationship arrays for this contract refinement.
     *
     * Other data/detail fields are intentionally left alone so we do not accidentally tighten unrelated parts of the
     * webhook contract while adding backward-compatible support for data.detail.related* arrays.
     */
    if (typeof data.detail === 'undefined') {
        return undefined;
    }
    if (!data.detail || typeof data.detail !== 'object' || Array.isArray(data.detail)) {
        throw new appError_1.AppError('BAD_REQUEST', 'data.detail must be an object when provided.', 400, {
            field: 'data.detail',
        });
    }
    const validatedDetail = validateRelationshipFields(data.detail);
    if (!validatedDetail) {
        return undefined;
    }
    const typedDetail = validatedDetail;
    return {
        detail: typedDetail,
    };
}
function requireSupportedSource(value) {
    if (!constants_1.SUPPORTED_SOURCES.includes(value)) {
        throw new appError_1.AppError('BAD_REQUEST', 'source is not supported.', 400, {
            allowedSources: constants_1.SUPPORTED_SOURCES,
            receivedSource: value,
        });
    }
    return value;
}
function requireSupportedEventType(value) {
    if (!constants_1.SUPPORTED_EVENT_TYPES.includes(value)) {
        throw new appError_1.AppError('BAD_REQUEST', 'eventType is not supported.', 400, {
            allowedEventTypes: constants_1.SUPPORTED_EVENT_TYPES,
            receivedEventType: value,
        });
    }
    return value;
}
function requireIsoTimestamp(value) {
    /**
     * We intentionally accept only UTC timestamps because downstream routing, page history rendering, and index updates
     * all assume a single canonical time zone representation. Producers may now omit milliseconds for convenience, but
     * the validator still normalizes the accepted value back to toISOString() so the rest of the app sees one shape.
     */
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
        throw new appError_1.AppError('BAD_REQUEST', 'timestamp must be a valid ISO-8601 UTC string.', 400, {
            receivedTimestamp: value,
        });
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        throw new appError_1.AppError('BAD_REQUEST', 'timestamp must be a valid ISO-8601 UTC string.', 400, {
            receivedTimestamp: value,
        });
    }
    return parsedDate.toISOString();
}
function assertRoutingFieldsPresent(payload) {
    if (payload.feature || payload.system || payload.integration || payload.runbook || payload.release || payload.incidentId) {
        return;
    }
    throw new appError_1.AppError('BAD_REQUEST', 'Payload must include at least one routing identifier field.', 400, {
        requiredRoutingFields: ['feature', 'system', 'integration', 'runbook', 'release', 'incidentId', 'identifier'],
        receivedEventType: payload.eventType,
    });
}
function getRoutingSourceForEventType(eventType) {
    switch (eventType) {
        case 'feature-update':
            return 'feature';
        case 'system-update':
            return 'system';
        case 'integration-update':
            return 'integration';
        case 'runbook-update':
            return 'runbook';
        case 'release':
            return 'release';
        case 'incident':
            return 'incidentId';
        default:
            throw new appError_1.AppError('BAD_REQUEST', 'eventType is not supported for identifier normalization.', 400, {
                receivedEventType: eventType,
            });
    }
}
function normalizeIdentifierAgainstEventType(eventType, identifier) {
    if (!identifier) {
        return undefined;
    }
    const routingSource = getRoutingSourceForEventType(eventType);
    return (0, documentationPageRouter_1.buildRouteFromRoutingSource)(routingSource, identifier).identifier;
}
function assertExplicitRoutingMatchesIdentifier(eventType, explicitRoutingValue, identifier, fieldName) {
    if (!explicitRoutingValue || !identifier) {
        return;
    }
    const normalizedExplicitValue = normalizeIdentifierAgainstEventType(eventType, explicitRoutingValue);
    const normalizedIdentifierValue = normalizeIdentifierAgainstEventType(eventType, identifier);
    if (normalizedExplicitValue !== normalizedIdentifierValue) {
        throw new appError_1.AppError('BAD_REQUEST', 'identifier does not match the explicit routing field for this eventType.', 400, {
            eventType,
            field: fieldName,
            explicitRoutingValue,
            identifier,
        });
    }
}
function normalizeRoutingFields(eventType, payload) {
    const identifier = optionalNonEmptyString(payload.identifier, 'identifier');
    const feature = optionalNonEmptyString(payload.feature, 'feature');
    const system = optionalNonEmptyString(payload.system, 'system');
    const integration = optionalNonEmptyString(payload.integration, 'integration');
    const runbook = optionalNonEmptyString(payload.runbook, 'runbook');
    const release = optionalNonEmptyString(payload.release, 'release');
    const incidentId = optionalNonEmptyString(payload.incidentId, 'incidentId');
    const routingSource = getRoutingSourceForEventType(eventType);
    switch (routingSource) {
        case 'feature':
            assertExplicitRoutingMatchesIdentifier(eventType, feature, identifier, routingSource);
            return {
                feature: feature ?? identifier,
                system,
                integration,
                release,
                incidentId,
            };
        case 'system':
            assertExplicitRoutingMatchesIdentifier(eventType, system, identifier, routingSource);
            return {
                feature,
                system: system ?? identifier,
                integration,
                release,
                incidentId,
            };
        case 'integration':
            assertExplicitRoutingMatchesIdentifier(eventType, integration, identifier, routingSource);
            return {
                feature,
                system,
                integration: integration ?? identifier,
                runbook,
                release,
                incidentId,
            };
        case 'runbook':
            assertExplicitRoutingMatchesIdentifier(eventType, runbook, identifier, routingSource);
            return {
                feature,
                system,
                integration,
                runbook: runbook ?? identifier,
                release,
                incidentId,
            };
        case 'release':
            assertExplicitRoutingMatchesIdentifier(eventType, release, identifier, routingSource);
            return {
                feature,
                system,
                integration,
                runbook,
                release: release ?? identifier,
                incidentId,
            };
        case 'incidentId':
            assertExplicitRoutingMatchesIdentifier(eventType, incidentId, identifier, routingSource);
            return {
                feature,
                system,
                integration,
                runbook,
                release,
                incidentId: incidentId ?? identifier,
            };
        default:
            return {
                feature,
                system,
                integration,
                runbook,
                release,
                incidentId,
            };
    }
}
function validateDocumentationWebhookPayload(payload) {
    const eventType = requireSupportedEventType(requireNonEmptyString(payload.eventType, 'eventType'));
    const normalizedRoutingFields = normalizeRoutingFields(eventType, payload);
    const validatedPayload = {
        source: requireSupportedSource(requireNonEmptyString(payload.source, 'source')),
        eventType,
        feature: normalizedRoutingFields.feature,
        system: normalizedRoutingFields.system,
        integration: normalizedRoutingFields.integration,
        runbook: normalizedRoutingFields.runbook,
        release: normalizedRoutingFields.release,
        incidentId: normalizedRoutingFields.incidentId,
        relatedFeatures: optionalNonEmptyStringArray(payload.relatedFeatures, 'relatedFeatures'),
        relatedSystems: optionalNonEmptyStringArray(payload.relatedSystems, 'relatedSystems'),
        relatedIntegrations: optionalNonEmptyStringArray(payload.relatedIntegrations, 'relatedIntegrations'),
        relatedReleases: optionalNonEmptyStringArray(payload.relatedReleases, 'relatedReleases'),
        relatedIncidents: optionalNonEmptyStringArray(payload.relatedIncidents, 'relatedIncidents'),
        data: validateStructuredDataPayload(payload.data),
        content: requireNonEmptyString(payload.content, 'content'),
        summary: requireNonEmptyString(payload.summary, 'summary'),
        message: requireNonEmptyString(payload.message, 'message'),
        timestamp: requireIsoTimestamp(requireNonEmptyString(payload.timestamp, 'timestamp')),
    };
    assertRoutingFieldsPresent(validatedPayload);
    return validatedPayload;
}
