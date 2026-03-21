import { AppError } from '../errors/appError';
import type { ConfluenceClient } from '../clients/confluenceClient';
import type {
  ConfluencePageReadModel,
  ConfluencePageUpdateRequest,
  ConfluencePageUpdateResponse,
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

  private async createPageForRoute(
    routedPageTitle: string,
    fallbackPage: ConfluencePageReadModel
  ): Promise<ConfluencePageReadModel> {
    /**
     * We use the configured page as a hierarchy anchor instead of a content fallback.
     *
     * When that anchor already has a parent, the new feature page is created as a sibling by reusing the same parentId.
     * If the anchor page is top-level, we omit parentId so Confluence creates the new page at the top level of the
     * target space. This keeps page placement predictable without introducing extra configuration.
     */
    const createdPage = await this.confluenceClient.createPage({
      spaceId: fallbackPage.spaceId,
      status: 'current',
      title: routedPageTitle,
      ...(fallbackPage.parentId ? { parentId: fallbackPage.parentId } : {}),
      body: {
        representation: 'storage',
        value: '',
      },
    });

    return this.confluenceClient.getPage(createdPage.id);
  }

  async resolvePageTarget(fallbackPageId: string, routedPageTitle: string): Promise<ResolvedConfluencePageTarget> {
    const fallbackPage = await this.confluenceClient.getPage(fallbackPageId);
    const routedPage = await this.confluenceClient.findPageByTitleInSpace(routedPageTitle, fallbackPage.spaceId);

    if (routedPage) {
      this.logResolvedPageTarget({
        routedPageTitle,
        pageFound: true,
        createdPage: false,
        usedFallbackPage: false,
        pageId: routedPage.id,
        spaceId: routedPage.spaceId,
        parentPageId: routedPage.parentId,
      });

      return {
        page: routedPage,
        usedFallbackPage: false,
        createdPage: false,
      };
    }

    const createdPage = await this.createPageForRoute(routedPageTitle, fallbackPage);

    this.logResolvedPageTarget({
      routedPageTitle,
      pageFound: false,
      createdPage: true,
      usedFallbackPage: false,
      pageId: createdPage.id,
      spaceId: createdPage.spaceId,
      parentPageId: createdPage.parentId,
    });

    return {
      page: createdPage,
      usedFallbackPage: false,
      createdPage: true,
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
