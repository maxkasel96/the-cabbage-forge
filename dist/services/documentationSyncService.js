"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationSyncService = void 0;
const confluenceEntryBuilder_1 = require("../builders/confluenceEntryBuilder");
const constants_1 = require("../config/constants");
const confluencePageService_1 = require("./confluencePageService");
class DocumentationSyncService {
    confluencePageService;
    constructor(confluenceClient) {
        this.confluencePageService = new confluencePageService_1.ConfluencePageService(confluenceClient);
    }
    async syncDocumentation(payload) {
        /**
         * The orchestration layer deliberately stays small: build the Confluence-safe storage block, append it to the
         * configured page, and then return a stable response contract for the caller. This gives us a clean place to add
         * richer workflows later without bloating the HTTP handler.
         */
        const entry = (0, confluenceEntryBuilder_1.buildConfluenceDocumentationEntry)(payload);
        const appendResult = await this.confluencePageService.appendStorageEntry(constants_1.CONFLUENCE_TARGET_PAGE_ID, undefined, entry);
        return {
            pageId: appendResult.updatedPage.id,
            title: appendResult.updatedPage.title,
            spaceId: appendResult.updatedPage.spaceId,
            spaceKey: constants_1.CONFLUENCE_TARGET_SPACE_KEY,
            previousVersion: appendResult.previousPage.version.number,
            updatedVersion: appendResult.updatedPage.version.number,
            eventType: payload.eventType,
            source: payload.source,
            timestamp: payload.timestamp,
            message: constants_1.WEBHOOK_SUCCESS_MESSAGE,
        };
    }
}
exports.DocumentationSyncService = DocumentationSyncService;
