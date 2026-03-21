import { AppError } from '../errors/appError';
import type { ConfluenceClient } from '../clients/confluenceClient';
import type {
  ConfluencePageReadModel,
  ConfluencePageUpdateRequest,
  ConfluencePageUpdateResponse,
  EnsureConfluencePageResult,
} from '../types/confluence';

export interface UpdateStructuredPageResult {
  previousPage: ConfluencePageReadModel;
  updatedPage: ConfluencePageUpdateResponse;
  pageInitialized: boolean;
  structuredContentUpdated: boolean;
  historyEntryCount: number;
  usedLegacyMigrationEntry: boolean;
}

export interface ResolvedConfluencePageTarget {
  page: ConfluencePageReadModel;
  usedFallbackPage: boolean;
  createdPage: boolean;
}

export class ConfluencePageService {
  constructor(private readonly confluenceClient: ConfluenceClient) {}

  private logResolvedPageTarget(details: {
    routedPageTitle: string;
    pageFound: boolean;
    createdPage: boolean;
    usedFallbackPage: boolean;
    pageId: string;
    spaceId: string;
    parentPageId?: string;
  }): void {
    /**
     * The sync webhook is an integration surface, so verbose structured logs are far more useful than compact strings.
     *
     * Logging the routed title, whether a page already existed, whether we created one, and the final page id makes it
     * much easier to diagnose routing mistakes or Confluence content placement issues from Forge logs.
     */
    console.info('[DocumentationSync] Resolved Confluence page target', details);
  }

  private async createPageForTitle(
    pageTitle: string,
    fallbackPage: ConfluencePageReadModel
  ): Promise<ConfluencePageReadModel> {
    /**
     * We use the configured page as a hierarchy anchor instead of a content fallback.
     *
     * When that anchor already has a parent, the new page is created as a sibling by reusing the same parentId.
     * If the anchor page is top-level, we omit parentId so Confluence creates the new page at the top level of the
     * target space. This keeps page placement predictable without introducing extra configuration.
     */
    const createdPage = await this.confluenceClient.createPage({
      spaceId: fallbackPage.spaceId,
      status: 'current',
      title: pageTitle,
      ...(fallbackPage.parentId ? { parentId: fallbackPage.parentId } : {}),
      body: {
        representation: 'storage',
        value: '',
      },
    });

    return this.confluenceClient.getPage(createdPage.id);
  }

  async ensurePageExists(fallbackPageId: string, pageTitle: string): Promise<EnsureConfluencePageResult> {
    const fallbackPage = await this.confluenceClient.getPage(fallbackPageId);
    const existingPage = await this.confluenceClient.findPageByTitleInSpace(pageTitle, fallbackPage.spaceId);

    if (existingPage) {
      this.logResolvedPageTarget({
        routedPageTitle: pageTitle,
        pageFound: true,
        createdPage: false,
        usedFallbackPage: false,
        pageId: existingPage.id,
        spaceId: existingPage.spaceId,
        parentPageId: existingPage.parentId,
      });

      return {
        page: existingPage,
        createdPage: false,
      };
    }

    const createdPage = await this.createPageForTitle(pageTitle, fallbackPage);

    this.logResolvedPageTarget({
      routedPageTitle: pageTitle,
      pageFound: false,
      createdPage: true,
      usedFallbackPage: false,
      pageId: createdPage.id,
      spaceId: createdPage.spaceId,
      parentPageId: createdPage.parentId,
    });

    return {
      page: createdPage,
      createdPage: true,
    };
  }

  async resolvePageTarget(fallbackPageId: string, routedPageTitle: string): Promise<ResolvedConfluencePageTarget> {
    const resolvedPage = await this.ensurePageExists(fallbackPageId, routedPageTitle);

    return {
      page: resolvedPage.page,
      usedFallbackPage: false,
      createdPage: resolvedPage.createdPage,
    };
  }

  async updatePageBody(
    pageId: string,
    expectedSpaceId: string | undefined,
    updatedBody: string,
    options: {
      pageInitialized: boolean;
      structuredContentUpdated: boolean;
      historyEntryCount: number;
      usedLegacyMigrationEntry: boolean;
    }
  ): Promise<UpdateStructuredPageResult> {
    const currentPage = await this.confluenceClient.getPage(pageId);

    if (expectedSpaceId && currentPage.spaceId !== expectedSpaceId) {
      throw new AppError('BAD_REQUEST', 'Configured Confluence page does not belong to the expected space.', 400, {
        expectedSpaceId,
        receivedSpaceId: currentPage.spaceId,
      });
    }

    const updateRequest: ConfluencePageUpdateRequest = {
      id: currentPage.id,
      status: 'current',
      title: currentPage.title,
      spaceId: currentPage.spaceId,
      version: {
        number: currentPage.version.number + 1,
      },
      body: {
        representation: 'storage',
        value: updatedBody,
      },
    };

    // TODO: Add retry-safe version conflict handling if concurrent sync requests begin colliding on page version numbers.
    const updatedPage = await this.confluenceClient.updatePage(updateRequest);

    console.info('[DocumentationSync] Structured Confluence page update applied', {
      pageId: currentPage.id,
      title: currentPage.title,
      pageInitialized: options.pageInitialized,
      structuredContentUpdated: options.structuredContentUpdated,
      historyEntryCount: options.historyEntryCount,
      usedLegacyMigrationEntry: options.usedLegacyMigrationEntry,
    });

    return {
      previousPage: currentPage,
      updatedPage,
      pageInitialized: options.pageInitialized,
      structuredContentUpdated: options.structuredContentUpdated,
      historyEntryCount: options.historyEntryCount,
      usedLegacyMigrationEntry: options.usedLegacyMigrationEntry,
    };
  }
}
