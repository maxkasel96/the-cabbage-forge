"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_JSON_HEADERS = exports.WEBHOOK_SUCCESS_MESSAGE = exports.SUPPORTED_EVENT_TYPES = exports.SUPPORTED_SOURCES = exports.CONFLUENCE_FALLBACK_PAGE_TITLE = exports.CONFLUENCE_TARGET_PAGE_ID = exports.CONFLUENCE_TARGET_SPACE_KEY = exports.CONFLUENCE_SITE_BASE_URL = void 0;
exports.CONFLUENCE_SITE_BASE_URL = 'https://maxckasel-1768672708733.atlassian.net/wiki';
exports.CONFLUENCE_TARGET_SPACE_KEY = 'TC';
exports.CONFLUENCE_TARGET_PAGE_ID = '21692417';
/**
 * The known page id remains our safe fallback while routing is still in its first pass.
 *
 * If a feature-specific page title cannot be resolved to an existing page yet, we keep sending updates here so the
 * webhook remains reliable instead of failing on a missing route target.
 */
exports.CONFLUENCE_FALLBACK_PAGE_TITLE = 'Docs Sync Test Page';
exports.SUPPORTED_SOURCES = ['nextjs-app'];
exports.SUPPORTED_EVENT_TYPES = ['feature-update'];
exports.WEBHOOK_SUCCESS_MESSAGE = 'Documentation sync completed successfully.';
exports.DEFAULT_JSON_HEADERS = {
    'Content-Type': ['application/json'],
};
