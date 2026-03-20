import type {
  DocumentationPageRoute,
  ValidatedDocumentationWebhookPayload,
} from '../types/webhook';

function toFeatureKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toReadableFeatureTitle(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Page routing lives outside the web trigger handler so the HTTP entry point stays focused on transport concerns.
 *
 * This first-pass router is intentionally small and deterministic: feature update events map to a readable Confluence
 * page title using the `Feature - {feature}` convention. Returning a structured result now gives us room to add more
 * route metadata later without reworking the handler contract again.
 */
export function routeDocumentationPage(
  payload: ValidatedDocumentationWebhookPayload
): DocumentationPageRoute {
  const normalizedFeature = toReadableFeatureTitle(payload.feature);

  return {
    pageTitle: `Feature - ${normalizedFeature}`,
    pageType: 'feature-page',
    featureKey: toFeatureKey(payload.feature),
    normalizedFeature,
  };
}
