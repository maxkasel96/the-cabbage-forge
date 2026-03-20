import { documentationWebhookHandler } from './handlers/documentationWebhook';

import type { ForgeWebTriggerRequest, ForgeWebTriggerResponse } from './types/webhook';

/**
 * Thin Forge entry point.
 *
 * Keeping this file intentionally small makes it easier to understand where the Forge runtime enters the app,
 * while allowing the rest of the codebase to grow into focused modules that can be tested and maintained in isolation.
 */
export async function handleDocsSync(
  request: ForgeWebTriggerRequest
): Promise<ForgeWebTriggerResponse> {
  return documentationWebhookHandler(request);
}
