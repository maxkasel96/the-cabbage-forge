"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_JSON_HEADERS = exports.WEBHOOK_SUCCESS_MESSAGE = exports.SUPPORTED_EVENT_TYPES = exports.SUPPORTED_SOURCES = exports.CONFLUENCE_FALLBACK_PAGE_TITLE = exports.CONFLUENCE_TARGET_PAGE_ID = exports.CONFLUENCE_TARGET_SPACE_KEY = exports.CONFLUENCE_SITE_BASE_URL = void 0;
exports.CONFLUENCE_SITE_BASE_URL = 'https://maxckasel-1768672708733.atlassian.net/wiki';
exports.CONFLUENCE_TARGET_SPACE_KEY = 'TC';
/**
 * The configured page id still matters even though valid feature routes no longer write to it by default.
 *
 * We now use this page as the space-and-hierarchy anchor for routed page creation. If routing is ever missing or
 * invalid, this same configured page remains the safest fallback target because it is already known to exist.
 */
exports.CONFLUENCE_TARGET_PAGE_ID = '21692417';
exports.CONFLUENCE_FALLBACK_PAGE_TITLE = 'Docs Sync Test Page';
exports.SUPPORTED_SOURCES = ['nextjs-app'];
exports.SUPPORTED_EVENT_TYPES = ['feature-update'];
exports.WEBHOOK_SUCCESS_MESSAGE = 'Documentation sync completed successfully.';
exports.DEFAULT_JSON_HEADERS = {
    'Content-Type': ['application/json'],
};
