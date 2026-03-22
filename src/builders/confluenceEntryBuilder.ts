import type { DocumentationPageRoute, ValidatedDocumentationWebhookPayload } from '../types/webhook';

export interface DocumentationPageBodyRenderResult {
  body: string;
  usedIncomingContent: true;
}

/**
 * The upstream Next.js producer already renders the final page HTML, so Forge should treat that HTML as canonical and
 * persist it without rebuilding legacy summary, metadata, or history sections around it.
 */
export function renderDocumentationPage(
  payload: ValidatedDocumentationWebhookPayload,
  _route: DocumentationPageRoute
): DocumentationPageBodyRenderResult {
  return {
    body: payload.content.trim(),
    usedIncomingContent: true,
  };
}
