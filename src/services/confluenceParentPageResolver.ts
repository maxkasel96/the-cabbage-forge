import { CONFLUENCE_TARGET_SPACE_KEY } from '../config/constants';
import { AppError } from '../errors/appError';
import type { ConfluenceClient } from '../clients/confluenceClient';
import type { ConfluencePageReadModel } from '../types/confluence';
import type { DocumentationPageType } from '../types/webhook';

declare const process: { env: Record<string, string | undefined> };

const CONTAINER_PAGE_PROPERTY_KEY = 'docsync.container';

interface RoutedParentPageConfig {
  containerKey: 'features' | 'integrations' | 'systems';
  pageType: 'feature-page' | 'integration-page' | 'system-page';
  containerTitle: string;
  envVarName: 'CONFLUENCE_PARENT_FEATURES_ID' | 'CONFLUENCE_PARENT_INTEGRATIONS_ID' | 'CONFLUENCE_PARENT_SYSTEMS_ID';
}

interface ContainerPagePropertyValue {
  containerKey: RoutedParentPageConfig['containerKey'];
  pageType: RoutedParentPageConfig['pageType'];
  managedBy: 'forge-doc-sync';
  spaceKey: string;
}

const ROUTED_PARENT_PAGE_CONFIG_BY_TYPE: Partial<Record<DocumentationPageType, RoutedParentPageConfig>> = {
  'feature-page': {
    containerKey: 'features',
    pageType: 'feature-page',
    containerTitle: 'Features',
    envVarName: 'CONFLUENCE_PARENT_FEATURES_ID',
  },
  'integration-page': {
    containerKey: 'integrations',
    pageType: 'integration-page',
    containerTitle: 'Integrations',
    envVarName: 'CONFLUENCE_PARENT_INTEGRATIONS_ID',
  },
  'system-page': {
    containerKey: 'systems',
    pageType: 'system-page',
    containerTitle: 'Systems',
    envVarName: 'CONFLUENCE_PARENT_SYSTEMS_ID',
  },
};

function readConfiguredParentPageId(envVarName: RoutedParentPageConfig['envVarName']): string | undefined {
  const rawValue = process.env[envVarName]?.trim();

  return rawValue ? rawValue : undefined;
}

export class ConfluenceParentPageResolver {
  constructor(private readonly confluenceClient: ConfluenceClient) {}

  private getParentPageConfig(pageType: DocumentationPageType): RoutedParentPageConfig | undefined {
    return ROUTED_PARENT_PAGE_CONFIG_BY_TYPE[pageType];
  }

  private isPageInExpectedSpace(page: ConfluencePageReadModel, expectedSpaceId: string): boolean {
    return page.spaceId === expectedSpaceId;
  }

  private async resolveConfiguredParentPage(
    config: RoutedParentPageConfig,
    targetSpaceId: string
  ): Promise<string | undefined> {
    const configuredParentPageId = readConfiguredParentPageId(config.envVarName);

    if (!configuredParentPageId) {
      return undefined;
    }

    try {
      const configuredParentPage = await this.confluenceClient.getPage(configuredParentPageId);

      if (!this.isPageInExpectedSpace(configuredParentPage, targetSpaceId)) {
        console.warn('[DocumentationSync] Configured parent page is not in the target space. Falling back to title lookup.', {
          envVarName: config.envVarName,
          configuredParentPageId,
          configuredSpaceId: configuredParentPage.spaceId,
          expectedSpaceId: targetSpaceId,
          containerTitle: config.containerTitle,
          pageType: config.pageType,
        });

        return undefined;
      }

      return configuredParentPage.id;
    } catch (error) {
      console.warn('[DocumentationSync] Configured parent page could not be resolved. Falling back to title lookup.', {
        envVarName: config.envVarName,
        configuredParentPageId,
        containerTitle: config.containerTitle,
        pageType: config.pageType,
        error: error instanceof Error ? error.message : String(error),
      });

      return undefined;
    }
  }

  private async resolveParentPageByExactTitle(
    config: RoutedParentPageConfig,
    targetSpaceId: string
  ): Promise<string | undefined> {
    /**
     * We intentionally gather all exact-title matches instead of stopping at the first result.
     *
     * A duplicate container title means a human needs to clean up Confluence configuration, and silently choosing one
     * would make child page placement non-deterministic.
     */
    const exactMatches = await this.confluenceClient.findPagesByTitleInSpace(config.containerTitle, targetSpaceId);

    if (exactMatches.length > 1) {
      throw new AppError(
        'BAD_REQUEST',
        'Multiple exact-match Confluence container pages were found. Please configure a single parent page ID.',
        400,
        {
          containerTitle: config.containerTitle,
          pageType: config.pageType,
          targetSpaceId,
          matchedPageIds: exactMatches.map((page) => page.id),
        }
      );
    }

    return exactMatches[0]?.id;
  }

  private async createContainerPageAtSpaceRoot(
    config: RoutedParentPageConfig,
    targetSpaceId: string
  ): Promise<string> {
    /**
     * Container pages are created at the space root on purpose.
     *
     * These pages act as durable routing anchors for future child-page creation, so keeping them top-level makes the
     * resulting tree easy to inspect manually and avoids coupling the new behavior to the legacy fallback page's parent.
     */
    const createdPage = await this.confluenceClient.createPage({
      spaceId: targetSpaceId,
      status: 'current',
      title: config.containerTitle,
      body: {
        representation: 'storage',
        value: '',
      },
    });

    const propertyValue: ContainerPagePropertyValue = {
      containerKey: config.containerKey,
      pageType: config.pageType,
      managedBy: 'forge-doc-sync',
      spaceKey: CONFLUENCE_TARGET_SPACE_KEY,
    };

    await this.confluenceClient.createPageProperty(createdPage.id, {
      key: CONTAINER_PAGE_PROPERTY_KEY,
      value: propertyValue,
    });

    console.info('[DocumentationSync] Auto-created routed container page', {
      pageId: createdPage.id,
      title: createdPage.title,
      spaceId: createdPage.spaceId,
      containerKey: config.containerKey,
      pageType: config.pageType,
      propertyKey: CONTAINER_PAGE_PROPERTY_KEY,
    });

    return createdPage.id;
  }

  async resolveParentPageId(
    pageType: DocumentationPageType,
    targetSpaceId: string
  ): Promise<string | undefined> {
    const config = this.getParentPageConfig(pageType);

    if (!config) {
      return undefined;
    }

    const configuredParentPageId = await this.resolveConfiguredParentPage(config, targetSpaceId);

    if (configuredParentPageId) {
      return configuredParentPageId;
    }

    const exactTitleParentPageId = await this.resolveParentPageByExactTitle(config, targetSpaceId);

    if (exactTitleParentPageId) {
      return exactTitleParentPageId;
    }

    return this.createContainerPageAtSpaceRoot(config, targetSpaceId);
  }
}
