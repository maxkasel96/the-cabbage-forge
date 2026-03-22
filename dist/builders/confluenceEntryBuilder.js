"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDocumentationPage = renderDocumentationPage;
/**
 * The upstream Next.js producer already renders the final page HTML, so Forge should treat that HTML as canonical and
 * persist it without rebuilding legacy summary, metadata, or history sections around it.
 */
function renderDocumentationPage(payload, _route) {
    return {
        body: payload.content.trim(),
        usedIncomingContent: true,
    };
}
