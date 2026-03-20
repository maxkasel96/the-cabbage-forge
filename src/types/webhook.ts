import type { AppErrorCode } from '../errors/appError';
import type { SUPPORTED_EVENT_TYPES, SUPPORTED_SOURCES } from '../config/constants';

export type SupportedSource = (typeof SUPPORTED_SOURCES)[number];
export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export interface DocumentationWebhookPayload {
  source: string;
  eventType: string;
  feature: string;
  summary: string;
  message: string;
  timestamp: string;
}

export interface ValidatedDocumentationWebhookPayload {
  source: SupportedSource;
  eventType: SupportedEventType;
  feature: string;
  summary: string;
  message: string;
  timestamp: string;
}

export interface ForgeWebTriggerRequest {
  method?: string;
  headers?: Record<string, string[] | string | undefined>;
  body?: string;
}

export interface ForgeWebTriggerResponse {
  statusCode: number;
  headers: Record<string, string[]>;
  body: string;
}

export interface ErrorResponseBody {
  ok: false;
  error: {
    code: AppErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface SuccessResponseBody<TData> {
  ok: true;
  data: TData;
}

export interface DocumentationSyncResult {
  pageId: string;
  title: string;
  spaceId: string;
  spaceKey: string;
  previousVersion: number;
  updatedVersion: number;
  eventType: SupportedEventType;
  source: SupportedSource;
  timestamp: string;
  message: string;
}
