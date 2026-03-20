"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDocumentationWebhookPayload = validateDocumentationWebhookPayload;
const constants_1 = require("../config/constants");
const appError_1 = require("../errors/appError");
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
function validateDocumentationWebhookPayload(payload) {
    const source = requireSupportedSource(requireNonEmptyString(payload.source, 'source'));
    const eventType = requireSupportedEventType(requireNonEmptyString(payload.eventType, 'eventType'));
    return {
        source,
        eventType,
        feature: requireNonEmptyString(payload.feature, 'feature'),
        summary: requireNonEmptyString(payload.summary, 'summary'),
        message: requireNonEmptyString(payload.message, 'message'),
        timestamp: requireIsoTimestamp(requireNonEmptyString(payload.timestamp, 'timestamp')),
    };
}
