"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluenceParentPageResolver = void 0;
const constants_1 = require("../config/constants");
const appError_1 = require("../errors/appError");
const CONTAINER_PAGE_PROPERTY_KEY = 'docsync.container';
const ROUTED_PARENT_PAGE_CONFIG_BY_TYPE = {
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
function readConfiguredParentPageId(envVarName) {
    const rawValue = process.env[envVarName]?.trim();
    return rawValue ? rawValue : undefined;
}
class ConfluenceParentPageResolver {
    confluenceClient;
    constructor(confluenceClient) {
        this.confluenceClient = confluenceClient;
    }
    getParentPageConfig(pageType) {
        return ROUTED_PARENT_PAGE_CONFIG_BY_TYPE[pageType];
    }
    isPageInExpectedSpace(page, expectedSpaceId) {
        return page.spaceId === expectedSpaceId;
    }
    async resolveConfiguredParentPage(config, targetSpaceId) {
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
            return {
                parentPageId: configuredParentPage.id,
                parentPageTitle: configuredParentPage.title,
                parentResolutionSource: 'env',
            };
        }
        catch (error) {
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
    async resolveParentPageByExactTitle(config, targetSpaceId) {
        /**
         * We intentionally gather all exact-title matches instead of stopping at the first result.
         *
         * A duplicate container title means a human needs to clean up Confluence configuration, and silently choosing one
         * would make child page placement non-deterministic.
         */
        const exactMatches = await this.confluenceClient.findPagesByTitleInSpace(config.containerTitle, targetSpaceId);
        if (exactMatches.length > 1) {
            throw new appError_1.AppError('BAD_REQUEST', 'Multiple exact-match Confluence container pages were found. Please configure a single parent page ID.', 400, {
                containerTitle: config.containerTitle,
                pageType: config.pageType,
                targetSpaceId,
                matchedPageIds: exactMatches.map((page) => page.id),
            });
        }
        const exactMatch = exactMatches[0];
        if (!exactMatch) {
            return undefined;
        }
        return {
            parentPageId: exactMatch.id,
            parentPageTitle: exactMatch.title,
            parentResolutionSource: 'lookup',
        };
    }
    async createContainerPageAtSpaceRoot(config, targetSpaceId) {
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
        const propertyValue = {
            containerKey: config.containerKey,
            pageType: config.pageType,
            managedBy: 'forge-doc-sync',
            spaceKey: constants_1.CONFLUENCE_TARGET_SPACE_KEY,
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
        return {
            parentPageId: createdPage.id,
            parentPageTitle: createdPage.title,
            parentResolutionSource: 'created',
        };
    }
    async resolveParentPageId(pageType, targetSpaceId) {
        const config = this.getParentPageConfig(pageType);
        if (!config) {
            return {};
        }
        const configuredParentPage = await this.resolveConfiguredParentPage(config, targetSpaceId);
        if (configuredParentPage) {
            return configuredParentPage;
        }
        const exactTitleParentPage = await this.resolveParentPageByExactTitle(config, targetSpaceId);
        if (exactTitleParentPage) {
            return exactTitleParentPage;
        }
        return this.createContainerPageAtSpaceRoot(config, targetSpaceId);
    }
}
exports.ConfluenceParentPageResolver = ConfluenceParentPageResolver;
