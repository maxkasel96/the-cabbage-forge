import {
  mergeExistingContentWithNewUpdate,
  renderFeaturePage,
} from '../builders/confluenceEntryBuilder';
import {
  CONFLUENCE_TARGET_PAGE_ID,
  CONFLUENCE_TARGET_SPACE_KEY,
  WEBHOOK_SUCCESS_MESSAGE,
} from '../config/constants';
import type { ConfluenceClient } from '../clients/confluenceClient';
import { routeDocumentationPage } from '../routing/documentationPageRouter';
import type { DocumentationSyncResult, ValidatedDocumentationWebhookPayload } from '../types/webhook';
import { ConfluencePageService } from './confluencePageService';

export class DocumentationSyncService {
  private readonly confluencePageService: ConfluencePageService;

  constructor(confluenceClient: ConfluenceClient) {
    this.confluencePageService = new ConfluencePageService(confluenceClient);
  }

  async syncDocumentation(
    payload: ValidatedDocumentationWebhookPayload
  ): Promise<DocumentationSyncResult> {
    /**
     * The orchestration layer deliberately stays small: derive the page route, build the Confluence-safe storage body,
     * refresh the structured sections with the newest payload, preserve prior history entries, and then return a stable
     * response contract for the caller. This gives us a clean place to add richer workflows later without bloating the
     * HTTP handler.
     */
    const route = routeDocumentationPage(payload);
    const resolvedTarget = await this.confluencePageService.resolvePageTarget(
      CONFLUENCE_TARGET_PAGE_ID,
      route.pageTitle
    );
    const existingContent = resolvedTarget.page.body?.storage?.value ?? '';
    const mergeResult = mergeExistingContentWithNewUpdate(existingContent, payload);
    const renderedPage = renderFeaturePage(payload, mergeResult.historyEntries);
    const updateResult = await this.confluencePageService.updatePageBody(
      resolvedTarget.page.id,
      resolvedTarget.page.spaceId,
      renderedPage,
      {
        pageInitialized: mergeResult.pageInitialized,
        structuredContentUpdated: mergeResult.structuredContentUpdated,
        historyEntryCount: mergeResult.historyEntries.length,
        usedLegacyMigrationEntry: mergeResult.usedLegacyMigrationEntry,
      }
    );

    return {
      pageId: updateResult.updatedPage.id,
      title: updateResult.updatedPage.title,
      spaceId: updateResult.updatedPage.spaceId,
      spaceKey: CONFLUENCE_TARGET_SPACE_KEY,
      previousVersion: updateResult.previousPage.version.number,
      updatedVersion: updateResult.updatedPage.version.number,
      eventType: payload.eventType,
      source: payload.source,
      timestamp: payload.timestamp,
      message: WEBHOOK_SUCCESS_MESSAGE,
      route,
      usedFallbackPage: resolvedTarget.usedFallbackPage,
      createdPage: resolvedTarget.createdPage,
    };
  }
}
