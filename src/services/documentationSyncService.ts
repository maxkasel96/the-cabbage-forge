import { renderIndexPage } from '../builders/confluenceIndexBuilder';
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
import {
  buildIndexEntry,
  buildNavigationSection,
  ensureIndexPageExists,
  getIndexPageTitle,
  getRelatedIndexPageType,
  updateIndexPage,
} from '../helpers/documentationIndexing';
import {
  buildRelatedDocumentationSection,
  extractRelatedPageReferencesFromPayload,
  resolveRelatedPages,
} from '../helpers/documentationRelationships';
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
     * The orchestration layer deliberately stays small: derive the page route, ensure the routed page and its matching
     * index page both exist, refresh the structured sections with the newest payload, preserve prior history entries,
     * and then return a stable response contract for the caller.
     */
    const route = resolveRoute(payload);
    const indexPageTitle = getIndexPageTitle(route.pageType);
    const relatedIndexPageType = getRelatedIndexPageType(route.pageType);
    const relatedPageReferences = extractRelatedPageReferencesFromPayload(payload, route);

    const resolvedTarget = await this.confluencePageService.resolvePageTarget(
      CONFLUENCE_TARGET_PAGE_ID,
      route.pageTitle
    );
    const ensuredIndexPage = await ensureIndexPageExists(
      this.confluencePageService,
      CONFLUENCE_TARGET_PAGE_ID,
      route.pageType
    );
    const relatedPages = await resolveRelatedPages(
      this.confluencePageService,
      resolvedTarget.page.spaceId,
      relatedPageReferences
    );
    const existingContent = resolvedTarget.page.body?.storage?.value ?? '';
    const mergeResult = mergeExistingContentWithNewUpdate(existingContent, payload);
    const navigationSection = buildNavigationSection(route, ensuredIndexPage.page);
    const relatedDocumentationSection = buildRelatedDocumentationSection(relatedPages);
    const renderedPage = renderDocumentationPage(
      payload,
      route,
      mergeResult.historyEntries,
      navigationSection,
      relatedDocumentationSection
    );
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

    const indexState = await this.confluencePageService.loadIndexEntries(ensuredIndexPage.page);
    const indexEntry = buildIndexEntry(route, updateResult.updatedPage, payload.timestamp);
    const nextIndexState = updateIndexPage(indexState.entries, indexEntry);
    const renderedIndexPage = renderIndexPage({
      indexPageTitle,
      indexPageType: relatedIndexPageType,
      entries: nextIndexState.entries,
    });
    const existingIndexBody = ensuredIndexPage.page.body?.storage?.value ?? '';
    const indexBodyChanged = renderedIndexPage !== existingIndexBody;
    const indexPropertyChanged =
      indexState.usedLegacyBodyFallback ||
      !indexState.property ||
      JSON.stringify(indexState.entries) !== JSON.stringify(nextIndexState.entries);
    let indexUpdated =
      ensuredIndexPage.createdPage ||
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
        await this.confluencePageService.updatePageBody(
          ensuredIndexPage.page.id,
          ensuredIndexPage.page.spaceId,
          renderedIndexPage,
          {
            pageInitialized: ensuredIndexPage.createdPage,
            structuredContentUpdated: !ensuredIndexPage.createdPage,
            historyEntryCount: nextIndexState.entries.length,
            usedLegacyMigrationEntry: indexState.usedLegacyBodyFallback,
          }
        );
      }

      if (indexPropertyChanged) {
        await this.confluencePageService.saveIndexEntries(
          ensuredIndexPage.page.id,
          nextIndexState.entries,
          indexState.property
        );
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
      relatedPagesConsidered: relatedPageReferences.length,
      relatedPagesLinked: relatedPages.length,
      relatedPageTitles: relatedPages.map((page) => page.pageTitle),
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
      indexPageTitle,
      relatedIndexPageType,
      indexUpdated,
      relatedPagesConsidered: relatedPageReferences.length,
      relatedPagesLinked: relatedPages.length,
      relatedPageTitles: relatedPages.map((page) => page.pageTitle),
    };
  }
}
