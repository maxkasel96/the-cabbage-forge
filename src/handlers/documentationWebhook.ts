import { ConfluenceClient } from '../clients/confluenceClient';
import { getHeaderValue, assertHttpMethod, parseJsonBody } from '../http/request';
import { createErrorResponse, createSuccessResponse } from '../http/response';
import { DocumentationSyncService } from '../services/documentationSyncService';
import type {
  DocumentationWebhookPayload,
  ForgeWebTriggerRequest,
  ForgeWebTriggerResponse,
} from '../types/webhook';
import { validateDocumentationWebhookPayload } from '../validation/webhookPayload';

const documentationSyncService = new DocumentationSyncService(new ConfluenceClient());

export async function documentationWebhookHandler(
  request: ForgeWebTriggerRequest
): Promise<ForgeWebTriggerResponse> {
  try {
    assertHttpMethod(request, 'POST');

    /**
     * We read the Authorization header even though we do not enforce it yet so the integration point is obvious.
     *
     * When the external Next.js caller is wired in, this is the natural place to verify a shared secret or a request
     * signature before any Confluence write is attempted.
     */
    const authorizationHeader = getHeaderValue(request, 'authorization');
    void authorizationHeader;

    const parsedPayload = parseJsonBody<DocumentationWebhookPayload>(request);
    const validatedPayload = validateDocumentationWebhookPayload(parsedPayload);

    // TODO: Persist and check an idempotency key so retried webhook deliveries do not create duplicate page entries.
    // TODO: Route multiple event types to specialized builders once the webhook contract expands beyond feature updates.
    // TODO: Support multiple Confluence page destinations based on payload routing rules when more docs surfaces are introduced.
    const syncResult = await documentationSyncService.syncDocumentation(validatedPayload);

    return createSuccessResponse(200, syncResult);
  } catch (error) {
    return createErrorResponse(error);
  }
}
