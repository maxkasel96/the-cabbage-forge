import { AppError } from '../errors/appError';
import type { ForgeWebTriggerRequest } from '../types/webhook';

export function assertHttpMethod(request: ForgeWebTriggerRequest, expectedMethod: 'POST'): void {
  const receivedMethod = request.method?.toUpperCase() ?? 'GET';

  if (receivedMethod !== expectedMethod) {
    throw new AppError(
      'METHOD_NOT_ALLOWED',
      `Only ${expectedMethod} requests are supported by this web trigger.`,
      405,
      { receivedMethod }
    );
  }
}

export function parseJsonBody<TBody>(request: ForgeWebTriggerRequest): TBody {
  if (!request.body || !request.body.trim()) {
    throw new AppError('BAD_REQUEST', 'Request body must contain JSON.', 400);
  }

  try {
    return JSON.parse(request.body) as TBody;
  } catch (error) {
    throw new AppError('BAD_REQUEST', 'Request body must be valid JSON.', 400, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getHeaderValue(
  request: ForgeWebTriggerRequest,
  headerName: string
): string | undefined {
  const matchingHeaderEntry = Object.entries(request.headers ?? {}).find(
    ([key]) => key.toLowerCase() === headerName.toLowerCase()
  );

  if (!matchingHeaderEntry) {
    return undefined;
  }

  const [, value] = matchingHeaderEntry;

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
