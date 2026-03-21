"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationSyncService = void 0;
const confluenceIndexBuilder_1 = require("../builders/confluenceIndexBuilder");
const confluenceEntryBuilder_1 = require("../builders/confluenceEntryBuilder");
const constants_1 = require("../config/constants");
const documentationIndexing_1 = require("../helpers/documentationIndexing");
const documentationPageRouter_1 = require("../routing/documentationPageRouter");
const confluencePageService_1 = require("./confluencePageService");
class DocumentationSyncService {
    confluencePageService;
    constructor(confluenceClient) {
        this.confluencePageService = new confluencePageService_1.ConfluencePageService(confluenceClient);
    }
    async syncDocumentation(payload) {
        /**
         * The orchestration layer deliberately stays small: derive the page route, ensure the routed page and its matching
         * index page both exist, refresh the structured sections with the newest payload, preserve prior history entries,
         * and then return a stable response contract for the caller.
         */
        const route = (0, documentationPageRouter_1.resolveRoute)(payload);
        const indexPageTitle = (0, documentationIndexing_1.getIndexPageTitle)(route.pageType);
        const relatedIndexPageType = (0, documentationIndexing_1.getRelatedIndexPageType)(route.pageType);
        const resolvedTarget = await this.confluencePageService.resolvePageTarget(constants_1.CONFLUENCE_TARGET_PAGE_ID, route.pageTitle);
        const ensuredIndexPage = await (0, documentationIndexing_1.ensureIndexPageExists)(this.confluencePageService, constants_1.CONFLUENCE_TARGET_PAGE_ID, route.pageType);
        const existingContent = resolvedTarget.page.body?.storage?.value ?? '';
        const mergeResult = (0, confluenceEntryBuilder_1.mergeExistingContentWithNewUpdate)(existingContent, payload);
        const navigationSection = (0, documentationIndexing_1.buildNavigationSection)(route, ensuredIndexPage.page);
        const renderedPage = (0, confluenceEntryBuilder_1.renderDocumentationPage)(payload, route, mergeResult.historyEntries, navigationSection);
        const updateResult = await this.confluencePageService.updatePageBody(resolvedTarget.page.id, resolvedTarget.page.spaceId, renderedPage, {
            pageInitialized: mergeResult.pageInitialized,
            structuredContentUpdated: mergeResult.structuredContentUpdated,
            historyEntryCount: mergeResult.historyEntries.length,
            usedLegacyMigrationEntry: mergeResult.usedLegacyMigrationEntry,
        });
        const indexState = await this.confluencePageService.loadIndexEntries(ensuredIndexPage.page);
        const indexEntry = (0, documentationIndexing_1.buildIndexEntry)(route, updateResult.updatedPage, payload.timestamp);
        const nextIndexState = (0, documentationIndexing_1.updateIndexPage)(indexState.entries, indexEntry);
        const renderedIndexPage = (0, confluenceIndexBuilder_1.renderIndexPage)({
            indexPageTitle,
            indexPageType: relatedIndexPageType,
            entries: nextIndexState.entries,
        });
        const existingIndexBody = ensuredIndexPage.page.body?.storage?.value ?? '';
        const indexBodyChanged = renderedIndexPage !== existingIndexBody;
        const indexPropertyChanged = indexState.usedLegacyBodyFallback ||
            !indexState.property ||
            JSON.stringify(indexState.entries) !== JSON.stringify(nextIndexState.entries);
        let indexUpdated = ensuredIndexPage.createdPage ||
            nextIndexState.indexUpdated ||
            indexBodyChanged ||
            indexPropertyChanged;
        if (indexUpdated) {
            /**
             * Re-rendering the entire index page body is more reliable than trying to mutate fragments in place.
             *
             * That keeps the visible Confluence markup deterministic while letting the page property carry any richer state
             * we still need for duplicate prevention and future updates.
             */
            if (indexBodyChanged) {
                await this.confluencePageService.updatePageBody(ensuredIndexPage.page.id, ensuredIndexPage.page.spaceId, renderedIndexPage, {
                    pageInitialized: ensuredIndexPage.createdPage,
                    structuredContentUpdated: !ensuredIndexPage.createdPage,
                    historyEntryCount: nextIndexState.entries.length,
                    usedLegacyMigrationEntry: indexState.usedLegacyBodyFallback,
                });
            }
            if (indexPropertyChanged) {
                await this.confluencePageService.saveIndexEntries(ensuredIndexPage.page.id, nextIndexState.entries, indexState.property);
            }
            if (!indexBodyChanged && !indexPropertyChanged) {
                indexUpdated = false;
            }
        }
        console.info('[DocumentationSync] Documentation route resolved', {
            pageType: route.pageType,
            pageTitle: route.pageTitle,
            routingSource: route.routingSource,
            identifier: route.identifier,
            eventType: payload.eventType,
            indexPageTitle,
            relatedIndexPageType,
            indexUpdated,
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
            indexPageTitle,
            relatedIndexPageType,
            indexUpdated,
        };
    }
}
exports.DocumentationSyncService = DocumentationSyncService;
