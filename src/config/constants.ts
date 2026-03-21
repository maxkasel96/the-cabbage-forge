export const CONFLUENCE_SITE_BASE_URL = 'https://maxckasel-1768672708733.atlassian.net/wiki';
export const CONFLUENCE_TARGET_SPACE_KEY = 'TC';

/**
 * The configured page id still matters even though valid feature routes no longer write to it by default.
 *
 * We now use this page as the space-and-hierarchy anchor for routed page creation. If routing is ever missing or
 * invalid, this same configured page remains the safest fallback target because it is already known to exist.
 */
export const CONFLUENCE_TARGET_PAGE_ID = '21692417';

export const CONFLUENCE_FALLBACK_PAGE_TITLE = 'Docs Sync Test Page';

export const SUPPORTED_SOURCES = ['nextjs-app'] as const;
export const SUPPORTED_EVENT_TYPES = [
  'feature-update',
  'system-update',
  'integration-update',
  'release',
  'incident',
] as const;

export const WEBHOOK_SUCCESS_MESSAGE = 'Documentation sync completed successfully.';
export const DEFAULT_JSON_HEADERS = {
  'Content-Type': ['application/json'],
} as const;
