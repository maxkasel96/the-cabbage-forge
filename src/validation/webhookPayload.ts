import { SUPPORTED_EVENT_TYPES, SUPPORTED_SOURCES } from '../config/constants';
import { AppError } from '../errors/appError';
import type {
  DocumentationRelationshipFields,
  DocumentationStructuredDataPayload,
  DocumentationWebhookPayload,
  SupportedEventType,
  SupportedSource,
  ValidatedDocumentationDetailPayload,
  ValidatedDocumentationStructuredDataPayload,
  ValidatedDocumentationWebhookPayload,
} from '../types/webhook';

const RELATED_PAYLOAD_FIELD_NAMES: (keyof DocumentationRelationshipFields)[] = [
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
function requireNonEmptyString(value: unknown, fieldName: keyof DocumentationWebhookPayload): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('BAD_REQUEST', `${fieldName} must be a non-empty string.`, 400, {
      field: fieldName,
    });
  }

  return value.trim();
}

function optionalNonEmptyString(value: unknown, fieldName: string): string | undefined {
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

function optionalNonEmptyStringArray(value: unknown, fieldName: string): string[] | undefined {
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

function validateRelationshipFields(
  relationshipSource: Partial<Record<keyof DocumentationRelationshipFields, unknown>>
): DocumentationRelationshipFields | undefined {
  const validatedFields: DocumentationRelationshipFields = {};

  for (const fieldName of RELATED_PAYLOAD_FIELD_NAMES) {
    const validatedArray = optionalNonEmptyStringArray(relationshipSource[fieldName], fieldName);

    if (validatedArray) {
      validatedFields[fieldName] = validatedArray;
    }
  }

  return Object.keys(validatedFields).length > 0 ? validatedFields : undefined;
}

function validateStructuredDataPayload(
  value: unknown
): ValidatedDocumentationStructuredDataPayload | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('BAD_REQUEST', 'data must be an object when provided.', 400, {
      field: 'data',
    });
  }

  const data = value as DocumentationStructuredDataPayload;

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
    throw new AppError('BAD_REQUEST', 'data.detail must be an object when provided.', 400, {
      field: 'data.detail',
    });
  }

  const validatedDetail = validateRelationshipFields(
    data.detail as Partial<Record<keyof DocumentationRelationshipFields, unknown>>
  );

  if (!validatedDetail) {
    return undefined;
  }

  return {
    detail: validatedDetail satisfies ValidatedDocumentationDetailPayload,
  };
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
    data: validateStructuredDataPayload(payload.data),
    summary: requireNonEmptyString(payload.summary, 'summary'),
    message: requireNonEmptyString(payload.message, 'message'),
    timestamp: requireIsoTimestamp(requireNonEmptyString(payload.timestamp, 'timestamp')),
  };

  assertRoutingFieldsPresent(validatedPayload);

  return validatedPayload;
}
