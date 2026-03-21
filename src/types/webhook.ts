import type { AppErrorCode } from '../errors/appError';
import type { SUPPORTED_EVENT_TYPES, SUPPORTED_SOURCES } from '../config/constants';

export type SupportedSource = (typeof SUPPORTED_SOURCES)[number];
export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export type DocumentationPageType =
  | 'feature-page'
  | 'system-page'
  | 'integration-page'
  | 'release-page'
  | 'incident-page';

export type DocumentationIndexPageType =
  | 'features-index'
  | 'systems-index'
  | 'integrations-index'
  | 'releases-index'
  | 'incidents-index';

export type DocumentationRoutingSource =
  | 'feature'
  | 'system'
  | 'integration'
  | 'release'
  | 'incidentId'
  | 'timestamp';

export interface DocumentationWebhookPayload {
  source: string;
  eventType: string;
  feature?: string;
  system?: string;
  integration?: string;
  release?: string;
  incidentId?: string;
  summary: string;
  message: string;
  timestamp: string;
}

export interface ValidatedDocumentationWebhookPayload {
  source: SupportedSource;
  eventType: SupportedEventType;
  feature?: string;
  system?: string;
  integration?: string;
  release?: string;
  incidentId?: string;
  summary: string;
  message: string;
  timestamp: string;
}

export interface DocumentationPageRoute {
  pageType: DocumentationPageType;
  pageTitle: string;
  pageHeading: string;
  identifier: string;
  routingSource: DocumentationRoutingSource;
}

export interface ResolvedRelatedPage {
  pageId: string;
  pageTitle: string;
  pageType: DocumentationPageType;
  identifier: string;
  pageUrl: string;
  createdPage: boolean;
}

export interface DocumentationIndexEntry {
  pageId: string;
  pageTitle: string;
  pageType: DocumentationPageType;
  identifier: string;
  pageUrl: string;
  lastUpdated?: string;
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
  pageTitle: string;
  pageType: DocumentationPageType;
  routingSource: DocumentationRoutingSource;
  spaceId: string;
  spaceKey: string;
  previousVersion: number;
  updatedVersion: number;
  eventType: SupportedEventType;
  source: SupportedSource;
  timestamp: string;
  message: string;
  route: DocumentationPageRoute;
  usedFallbackPage: boolean;
  createdPage: boolean;
  indexPageTitle: string;
  relatedIndexPageType: DocumentationIndexPageType;
  indexUpdated: boolean;
  relatedPagesConsidered: number;
  relatedPagesLinked: number;
  relatedPageTitles: string[];
}
