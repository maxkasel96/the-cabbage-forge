import { SUPPORTED_EVENT_TYPES, SUPPORTED_SOURCES } from '../config/constants';
import { AppError } from '../errors/appError';
import type {
  DocumentationWebhookPayload,
  SupportedEventType,
  SupportedSource,
  ValidatedDocumentationWebhookPayload,
} from '../types/webhook';

/**
 * The validation layer is intentionally explicit instead of clever.
 *
 * Forge web triggers often become long-lived integration points, so the small amount of duplication below makes it
 * very easy for the next engineer to see exactly which field failed, why it failed, and which contract values are
 * currently supported.
 */
function requireNonEmptyString(value: unknown, fieldName: keyof DocumentationWebhookPayload): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('BAD_REQUEST', `${fieldName} must be a non-empty string.`, 400, {
      field: fieldName,
    });
  }

  return value.trim();
}

function requireSupportedSource(value: string): SupportedSource {
  if (!SUPPORTED_SOURCES.includes(value as SupportedSource)) {
    throw new AppError('BAD_REQUEST', 'source is not supported.', 400, {
      allowedSources: SUPPORTED_SOURCES,
      receivedSource: value,
    });
  }

  return value as SupportedSource;
}

function requireSupportedEventType(value: string): SupportedEventType {
  if (!SUPPORTED_EVENT_TYPES.includes(value as SupportedEventType)) {
    throw new AppError('BAD_REQUEST', 'eventType is not supported.', 400, {
      allowedEventTypes: SUPPORTED_EVENT_TYPES,
      receivedEventType: value,
    });
  }

  return value as SupportedEventType;
}

function requireIsoTimestamp(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString() !== value) {
    throw new AppError('BAD_REQUEST', 'timestamp must be a valid ISO-8601 UTC string.', 400, {
      receivedTimestamp: value,
    });
  }

  return value;
}

export function validateDocumentationWebhookPayload(
  payload: DocumentationWebhookPayload
): ValidatedDocumentationWebhookPayload {
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
