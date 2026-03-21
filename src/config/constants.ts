export const CONFLUENCE_SITE_BASE_URL = 'https://maxckasel-1768672708733.atlassian.net/wiki';
export const CONFLUENCE_TARGET_SPACE_KEY = 'TC';
export const CONFLUENCE_TARGET_PAGE_ID = '21692417';

/**
 * The known page id remains our safe fallback while routing is still in its first pass.
 *
 * If a feature-specific page title cannot be resolved to an existing page yet, we keep sending updates here so the
 * webhook remains reliable instead of failing on a missing route target.
 */
export const CONFLUENCE_FALLBACK_PAGE_TITLE = 'Docs Sync Test Page';

export const SUPPORTED_SOURCES = ['nextjs-app'] as const;
export const SUPPORTED_EVENT_TYPES = ['feature-update'] as const;

export const WEBHOOK_SUCCESS_MESSAGE = 'Documentation sync completed successfully.';
export const DEFAULT_JSON_HEADERS = {
  'Content-Type': ['application/json'],
} as const;
