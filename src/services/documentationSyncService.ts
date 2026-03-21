import { buildConfluenceDocumentationEntry } from '../builders/confluenceEntryBuilder';
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
     * The orchestration layer deliberately stays small: derive the page route, build the Confluence-safe storage block,
     * append it to the resolved page, and then return a stable response contract for the caller. This gives us a clean
     * place to add richer workflows later without bloating the HTTP handler.
     */
    const route = routeDocumentationPage(payload);
    const resolvedTarget = await this.confluencePageService.resolvePageTarget(
      CONFLUENCE_TARGET_PAGE_ID,
      route.pageTitle
    );
    const entry = buildConfluenceDocumentationEntry(payload);
    const appendResult = await this.confluencePageService.appendStorageEntry(
      resolvedTarget.page.id,
      resolvedTarget.page.spaceId,
      entry
    );

    return {
      pageId: appendResult.updatedPage.id,
      title: appendResult.updatedPage.title,
      spaceId: appendResult.updatedPage.spaceId,
      spaceKey: CONFLUENCE_TARGET_SPACE_KEY,
      previousVersion: appendResult.previousPage.version.number,
      updatedVersion: appendResult.updatedPage.version.number,
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
