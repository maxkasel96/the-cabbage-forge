export const CONFLUENCE_SITE_BASE_URL = 'https://maxckasel-1768672708733.atlassian.net/wiki';
export const CONFLUENCE_TARGET_SPACE_KEY = 'TC';
export const CONFLUENCE_TARGET_PAGE_ID = '21692417';

export const SUPPORTED_SOURCES = ['nextjs-app'] as const;
export const SUPPORTED_EVENT_TYPES = ['feature-update'] as const;

export const WEBHOOK_SUCCESS_MESSAGE = 'Documentation sync completed successfully.';
export const DEFAULT_JSON_HEADERS = {
  'Content-Type': ['application/json'],
} as const;
