import {
  mergeExistingContentWithNewUpdate,
  renderDocumentationPage,
} from '../builders/confluenceEntryBuilder';
import {
  CONFLUENCE_TARGET_PAGE_ID,
  CONFLUENCE_TARGET_SPACE_KEY,
  WEBHOOK_SUCCESS_MESSAGE,
} from '../config/constants';
import type { ConfluenceClient } from '../clients/confluenceClient';
import { resolveRoute } from '../routing/documentationPageRouter';
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
    const route = resolveRoute(payload);
    const resolvedTarget = await this.confluencePageService.resolvePageTarget(
      CONFLUENCE_TARGET_PAGE_ID,
      route.pageTitle
    );
    const existingContent = resolvedTarget.page.body?.storage?.value ?? '';
    const mergeResult = mergeExistingContentWithNewUpdate(existingContent, payload);
    const renderedPage = renderDocumentationPage(payload, route, mergeResult.historyEntries);
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
