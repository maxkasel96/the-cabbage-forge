"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDocsSync = handleDocsSync;
const documentationWebhook_1 = require("./handlers/documentationWebhook");
/**
 * Thin Forge entry point.
 *
 * Keeping this file intentionally small makes it easier to understand where the Forge runtime enters the app,
 * while allowing the rest of the codebase to grow into focused modules that can be tested and maintained in isolation.
 */
async function handleDocsSync(request) {
    return (0, documentationWebhook_1.documentationWebhookHandler)(request);
}
