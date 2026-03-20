"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluencePageService = void 0;
const appError_1 = require("../errors/appError");
class ConfluencePageService {
    confluenceClient;
    constructor(confluenceClient) {
        this.confluenceClient = confluenceClient;
    }
    async appendStorageEntry(pageId, expectedSpaceId, entry) {
        const currentPage = await this.confluenceClient.getPage(pageId);
        if (expectedSpaceId && currentPage.spaceId !== expectedSpaceId) {
            throw new appError_1.AppError('BAD_REQUEST', 'Configured Confluence page does not belong to the expected space.', 400, {
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
        const updateRequest = {
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
exports.ConfluencePageService = ConfluencePageService;
