"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentationWebhookHandler = documentationWebhookHandler;
const confluenceClient_1 = require("../clients/confluenceClient");
const request_1 = require("../http/request");
const response_1 = require("../http/response");
const documentationSyncService_1 = require("../services/documentationSyncService");
const webhookPayload_1 = require("../validation/webhookPayload");
const documentationSyncService = new documentationSyncService_1.DocumentationSyncService(new confluenceClient_1.ConfluenceClient());
async function documentationWebhookHandler(request) {
    try {
        (0, request_1.assertHttpMethod)(request, 'POST');
        /**
         * We read the Authorization header even though we do not enforce it yet so the integration point is obvious.
         *
         * When the external Next.js caller is wired in, this is the natural place to verify a shared secret or a request
         * signature before any Confluence write is attempted.
         */
        const authorizationHeader = (0, request_1.getHeaderValue)(request, 'authorization');
        void authorizationHeader;
        const parsedPayload = (0, request_1.parseJsonBody)(request);
        const validatedPayload = (0, webhookPayload_1.validateDocumentationWebhookPayload)(parsedPayload);
        // TODO: Persist and check an idempotency key so retried webhook deliveries do not create duplicate page entries.
        // Page routing now lives in a dedicated helper so the handler stays focused on request parsing and payload validation.
        const syncResult = await documentationSyncService.syncDocumentation(validatedPayload);
        return (0, response_1.createSuccessResponse)(200, syncResult);
    }
    catch (error) {
        return (0, response_1.createErrorResponse)(error);
    }
}
