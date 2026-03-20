import { AppError } from '../errors/appError';
import type { ConfluenceClient } from '../clients/confluenceClient';
import type {
  ConfluencePageReadModel,
  ConfluencePageUpdateRequest,
  ConfluencePageUpdateResponse,
} from '../types/confluence';

export interface AppendPageEntryResult {
  previousPage: ConfluencePageReadModel;
  updatedPage: ConfluencePageUpdateResponse;
}

export interface ResolvedConfluencePageTarget {
  page: ConfluencePageReadModel;
  usedFallbackPage: boolean;
}

export class ConfluencePageService {
  constructor(private readonly confluenceClient: ConfluenceClient) {}

  async resolvePageTarget(fallbackPageId: string, routedPageTitle: string): Promise<ResolvedConfluencePageTarget> {
    const fallbackPage = await this.confluenceClient.getPage(fallbackPageId);
    const routedPage = await this.confluenceClient.findPageByTitleInSpace(routedPageTitle, fallbackPage.spaceId);

    /**
     * We deliberately keep fallback behavior stable in this first routing pass.
     *
     * If a feature-specific title has not been created in Confluence yet, we continue writing to the existing known
     * page instead of creating new pages automatically. That keeps the sync pipeline predictable while page routing is
     * still being introduced.
     */
    if (!routedPage) {
      return {
        page: fallbackPage,
        usedFallbackPage: true,
      };
    }

    return {
      page: routedPage,
      usedFallbackPage: false,
    };
  }

  async appendStorageEntry(pageId: string, expectedSpaceId: string | undefined, entry: string): Promise<AppendPageEntryResult> {
    const currentPage = await this.confluenceClient.getPage(pageId);

    if (expectedSpaceId && currentPage.spaceId !== expectedSpaceId) {
      throw new AppError('BAD_REQUEST', 'Configured Confluence page does not belong to the expected space.', 400, {
        expectedSpaceId,
        receivedSpaceId: currentPage.spaceId,
      });
    }

    /**
     * Appending to the current storage body keeps this first version pragmatic.
     *
     * The page service is the right place for body merge rules because future refinements—such as inserting entries
     * into a specific section, deduplicating repeated payloads, or preserving anchor locations—are page concerns rather
     * than HTTP or validation concerns.
     */
    const existingBody = currentPage.body?.storage?.value ?? '';
    const updatedBody = `${existingBody}
${entry}`.trim();

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

    return {
      previousPage: currentPage,
      updatedPage,
    };
  }
}
