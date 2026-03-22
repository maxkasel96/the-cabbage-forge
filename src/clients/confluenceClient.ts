import api, { route } from '@forge/api';

import { AppError } from '../errors/appError';
import type {
  ConfluenceContentProperty,
  ConfluenceContentPropertyCreateRequest,
  ConfluenceContentPropertyListResponse,
  ConfluenceContentPropertyUpdateRequest,
  ConfluencePageCreateRequest,
  ConfluencePageCreateResponse,
  ConfluencePageListResponse,
  ConfluencePageReadModel,
  ConfluencePageUpdateRequest,
  ConfluencePageUpdateResponse,
} from '../types/confluence';

interface ForgeApiResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}

/**
 * This client owns the raw REST v2 conversation with Confluence.
 *
 * That separation matters because it keeps the rest of the application focused on business workflow, while this file
 * handles transport details such as HTTP methods, JSON parsing, and translating non-2xx responses into structured
 * application errors.
 */
async function parseJsonResponse<TResponse>(response: ForgeApiResponseLike, operation: string): Promise<TResponse> {
  const responseText = await response.text();

  if (!response.ok) {
    throw new AppError('UPSTREAM_ERROR', `Confluence ${operation} request failed.`, 502, {
      operation,
      status: response.status,
      statusText: response.statusText,
      responseText,
    });
  }

  try {
    return JSON.parse(responseText) as TResponse;
  } catch (error) {
    throw new AppError('UPSTREAM_ERROR', `Confluence ${operation} response was not valid JSON.`, 502, {
      operation,
      cause: error instanceof Error ? error.message : String(error),
      responseText,
    });
  }
}

export class ConfluenceClient {
  async getPage(pageId: string): Promise<ConfluencePageReadModel> {
    const response = await api.asApp().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}?body-format=storage`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    return parseJsonResponse<ConfluencePageReadModel>(response, 'get page');
  }

  async findPagesByTitleInSpace(title: string, spaceId: string): Promise<ConfluencePageReadModel[]> {
    /**
     * Confluence's title search endpoint is the narrowest server-side filter available here, but we still apply our own
     * exact-title filter before the data leaves this client.
     *
     * That extra guard lets the calling service detect duplicate exact matches deterministically instead of relying on
     * implicit API ordering.
     */
    const response = await api.asApp().requestConfluence(
      route`/wiki/api/v2/pages?space-id=${spaceId}&title=${title}&body-format=storage&limit=25`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const parsedResponse = await parseJsonResponse<ConfluencePageListResponse>(response, 'find pages by title');

    return parsedResponse.results.filter((page) => page.title === title);
  }

  async findPageByTitleInSpace(title: string, spaceId: string): Promise<ConfluencePageReadModel | undefined> {
    const exactMatches = await this.findPagesByTitleInSpace(title, spaceId);

    return exactMatches[0];
  }

  async getPageProperty<TValue>(
    pageId: string,
    propertyKey: string
  ): Promise<ConfluenceContentProperty<TValue> | undefined> {
    /**
     * Confluence exposes content properties as a separate collection from the visible page body.
     *
     * Reading that collection lets us keep structured index-entry state without leaking raw serialized payloads into the
     * rendered page that end users see.
     */
    const response = await api.asApp().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}/properties?key=${propertyKey}&limit=1`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const parsedResponse = await parseJsonResponse<ConfluenceContentPropertyListResponse<TValue>>(
      response,
      'get page property'
    );

    return parsedResponse.results[0];
  }

  async createPageProperty<TValue>(
    pageId: string,
    payload: ConfluenceContentPropertyCreateRequest<TValue>
  ): Promise<ConfluenceContentProperty<TValue>> {
    const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}/properties`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse<ConfluenceContentProperty<TValue>>(response, 'create page property');
  }

  async updatePageProperty<TValue>(
    pageId: string,
    propertyId: string,
    payload: ConfluenceContentPropertyUpdateRequest<TValue>
  ): Promise<ConfluenceContentProperty<TValue>> {
    const response = await api.asApp().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}/properties/${propertyId}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    return parseJsonResponse<ConfluenceContentProperty<TValue>>(response, 'update page property');
  }

  async createPage(payload: ConfluencePageCreateRequest): Promise<ConfluencePageCreateResponse> {
    const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse<ConfluencePageCreateResponse>(response, 'create page');
  }

  async updatePage(payload: ConfluencePageUpdateRequest): Promise<ConfluencePageUpdateResponse> {
    const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${payload.id}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse<ConfluencePageUpdateResponse>(response, 'update page');
  }
}
