"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationSyncService = void 0;
const confluenceEntryBuilder_1 = require("../builders/confluenceEntryBuilder");
const constants_1 = require("../config/constants");
const documentationPageRouter_1 = require("../routing/documentationPageRouter");
const confluencePageService_1 = require("./confluencePageService");
class DocumentationSyncService {
    confluencePageService;
    constructor(confluenceClient) {
        this.confluencePageService = new confluencePageService_1.ConfluencePageService(confluenceClient);
    }
    async syncDocumentation(payload) {
        /**
         * The orchestration layer deliberately stays small: derive the page route, build the Confluence-safe storage body,
         * refresh the structured sections with the newest payload, preserve prior history entries, and then return a stable
         * response contract for the caller. This gives us a clean place to add richer workflows later without bloating the
         * HTTP handler.
         */
        const route = (0, documentationPageRouter_1.resolveRoute)(payload);
        const resolvedTarget = await this.confluencePageService.resolvePageTarget(constants_1.CONFLUENCE_TARGET_PAGE_ID, route.pageTitle);
        const existingContent = resolvedTarget.page.body?.storage?.value ?? '';
        const mergeResult = (0, confluenceEntryBuilder_1.mergeExistingContentWithNewUpdate)(existingContent, payload);
        const renderedPage = (0, confluenceEntryBuilder_1.renderDocumentationPage)(payload, route, mergeResult.historyEntries);
        const updateResult = await this.confluencePageService.updatePageBody(resolvedTarget.page.id, resolvedTarget.page.spaceId, renderedPage, {
            pageInitialized: mergeResult.pageInitialized,
            structuredContentUpdated: mergeResult.structuredContentUpdated,
            historyEntryCount: mergeResult.historyEntries.length,
            usedLegacyMigrationEntry: mergeResult.usedLegacyMigrationEntry,
        });
        console.info('[DocumentationSync] Documentation route resolved', {
            pageType: route.pageType,
            pageTitle: route.pageTitle,
            routingSource: route.routingSource,
            identifier: route.identifier,
            eventType: payload.eventType,
        });
        return {
            pageId: updateResult.updatedPage.id,
            title: updateResult.updatedPage.title,
            pageTitle: route.pageTitle,
            pageType: route.pageType,
            routingSource: route.routingSource,
            spaceId: updateResult.updatedPage.spaceId,
            spaceKey: constants_1.CONFLUENCE_TARGET_SPACE_KEY,
            previousVersion: updateResult.previousPage.version.number,
            updatedVersion: updateResult.updatedPage.version.number,
            eventType: payload.eventType,
            source: payload.source,
            timestamp: payload.timestamp,
            message: constants_1.WEBHOOK_SUCCESS_MESSAGE,
            route,
            usedFallbackPage: resolvedTarget.usedFallbackPage,
            createdPage: resolvedTarget.createdPage,
        };
    }
}
exports.DocumentationSyncService = DocumentationSyncService;
