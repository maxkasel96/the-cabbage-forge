import { DEFAULT_JSON_HEADERS } from '../config/constants';
import { toAppError } from '../errors/appError';
import type {
  ErrorResponseBody,
  ForgeWebTriggerResponse,
  SuccessResponseBody,
} from '../types/webhook';

export function createJsonResponse<TData>(
  statusCode: number,
  body: SuccessResponseBody<TData> | ErrorResponseBody
): ForgeWebTriggerResponse {
  return {
    statusCode,
    headers: Object.fromEntries(
      Object.entries(DEFAULT_JSON_HEADERS).map(([key, value]) => [key, [...value]])
    ),
    body: JSON.stringify(body),
  };
}

export function createSuccessResponse<TData>(statusCode: number, data: TData): ForgeWebTriggerResponse {
  return createJsonResponse(statusCode, {
    ok: true,
    data,
  });
}

export function createErrorResponse(error: unknown): ForgeWebTriggerResponse {
  const appError = toAppError(error);

  return createJsonResponse(appError.statusCode, {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    },
  });
}
