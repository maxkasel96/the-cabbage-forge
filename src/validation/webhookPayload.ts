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

function optionalNonEmptyString(
  value: unknown,
  fieldName: keyof DocumentationWebhookPayload
): string | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('BAD_REQUEST', `${fieldName} must be a non-empty string when provided.`, 400, {
      field: fieldName,
    });
  }

  return value.trim();
}

function optionalNonEmptyStringArray(
  value: unknown,
  fieldName: keyof DocumentationWebhookPayload
): string[] | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new AppError('BAD_REQUEST', `${fieldName} must be an array of non-empty strings when provided.`, 400, {
      field: fieldName,
    });
  }

  const normalizedItems = value.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new AppError('BAD_REQUEST', `${fieldName} must contain only non-empty strings.`, 400, {
        field: fieldName,
        itemIndex: index,
      });
    }

    return item.trim();
  });

  return normalizedItems.length > 0 ? normalizedItems : undefined;
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

function assertRoutingFieldsPresent(payload: ValidatedDocumentationWebhookPayload): void {
  if (payload.feature || payload.system || payload.integration || payload.release || payload.incidentId) {
    return;
  }

  if (payload.eventType === 'release' || payload.eventType === 'incident') {
    return;
  }

  throw new AppError('BAD_REQUEST', 'Payload must include at least one routing identifier field.', 400, {
    requiredRoutingFields: ['feature', 'system', 'integration', 'release', 'incidentId'],
    receivedEventType: payload.eventType,
  });
}

export function validateDocumentationWebhookPayload(
  payload: DocumentationWebhookPayload
): ValidatedDocumentationWebhookPayload {
  const validatedPayload: ValidatedDocumentationWebhookPayload = {
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
    summary: requireNonEmptyString(payload.summary, 'summary'),
    message: requireNonEmptyString(payload.message, 'message'),
    timestamp: requireIsoTimestamp(requireNonEmptyString(payload.timestamp, 'timestamp')),
  };

  assertRoutingFieldsPresent(validatedPayload);

  return validatedPayload;
}
