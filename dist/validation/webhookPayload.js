"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDocumentationWebhookPayload = validateDocumentationWebhookPayload;
const constants_1 = require("../config/constants");
const appError_1 = require("../errors/appError");
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
function optionalDocumentationPageType(value) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    if (value !== 'feature-page' &&
        value !== 'system-page' &&
        value !== 'integration-page' &&
        value !== 'release-page' &&
        value !== 'incident-page') {
        throw new appError_1.AppError('BAD_REQUEST', 'data.pageType must be a supported documentation page type when provided.', 400, {
            field: 'data.pageType',
            receivedPageType: value,
        });
    }
    return value;
}
function validateRelationshipFields(value, fieldPrefix) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new appError_1.AppError('BAD_REQUEST', `${fieldPrefix} must be an object when provided.`, 400, {
            field: fieldPrefix,
        });
    }
    const objectValue = value;
    const validatedFields = {};
    for (const fieldName of RELATED_PAYLOAD_FIELD_NAMES) {
        const validatedArray = optionalNonEmptyStringArray(objectValue[fieldName], fieldName);
        if (validatedArray) {
            validatedFields[fieldName] = validatedArray;
        }
    }
    return Object.keys(validatedFields).length > 0 ? validatedFields : undefined;
}
function validateDetailPayload(value) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new appError_1.AppError('BAD_REQUEST', 'data.detail must be an object when provided.', 400, {
            field: 'data.detail',
        });
    }
    const detail = value;
    const validatedDetail = {
        ...validateRelationshipFields(detail, 'data.detail'),
        summary: optionalNonEmptyString(detail.summary, 'summary'),
        currentState: optionalNonEmptyString(detail.currentState, 'currentState'),
        keyNotes: optionalNonEmptyStringArray(detail.keyNotes, 'keyNotes'),
    };
    return Object.values(validatedDetail).some((fieldValue) => typeof fieldValue !== 'undefined')
        ? validatedDetail
        : undefined;
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
    const validatedData = {
        pageType: optionalDocumentationPageType(data?.pageType),
        detail: validateDetailPayload(data?.detail),
    };
    return validatedData.pageType || validatedData.detail ? validatedData : undefined;
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
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString() !== value) {
        throw new appError_1.AppError('BAD_REQUEST', 'timestamp must be a valid ISO-8601 UTC string.', 400, {
            receivedTimestamp: value,
        });
    }
    return value;
}
function assertRoutingFieldsPresent(payload) {
    if (payload.feature || payload.system || payload.integration || payload.release || payload.incidentId) {
        return;
    }
    if (payload.eventType === 'release' || payload.eventType === 'incident') {
        return;
    }
    throw new appError_1.AppError('BAD_REQUEST', 'Payload must include at least one routing identifier field.', 400, {
        requiredRoutingFields: ['feature', 'system', 'integration', 'release', 'incidentId'],
        receivedEventType: payload.eventType,
    });
}
function validateDocumentationWebhookPayload(payload) {
    const validatedPayload = {
        source: requireSupportedSource(requireNonEmptyString(payload.source, 'source')),
        eventType: requireSupportedEventType(requireNonEmptyString(payload.eventType, 'eventType')),
        feature: optionalNonEmptyString(payload.feature, 'feature'),
        system: optionalNonEmptyString(payload.system, 'system'),
        integration: optionalNonEmptyString(payload.integration, 'integration'),
        release: optionalNonEmptyString(payload.release, 'release'),
        incidentId: optionalNonEmptyString(payload.incidentId, 'incidentId'),
        relatedFeatures: optionalNonEmptyStringArray(payload.relatedFeatures, 'relatedFeatures'),
        relatedSystems: optionalNonEmptyStringArray(payload.relatedSystems, 'relatedSystems'),
        relatedIntegrations: optionalNonEmptyStringArray(payload.relatedIntegrations, 'relatedIntegrations'),
        relatedReleases: optionalNonEmptyStringArray(payload.relatedReleases, 'relatedReleases'),
        relatedIncidents: optionalNonEmptyStringArray(payload.relatedIncidents, 'relatedIncidents'),
        data: validateStructuredDataPayload(payload.data),
        summary: requireNonEmptyString(payload.summary, 'summary'),
        message: requireNonEmptyString(payload.message, 'message'),
        timestamp: requireIsoTimestamp(requireNonEmptyString(payload.timestamp, 'timestamp')),
    };
    assertRoutingFieldsPresent(validatedPayload);
    return validatedPayload;
}
