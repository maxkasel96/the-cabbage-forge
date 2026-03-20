"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertHttpMethod = assertHttpMethod;
exports.parseJsonBody = parseJsonBody;
exports.getHeaderValue = getHeaderValue;
const appError_1 = require("../errors/appError");
function assertHttpMethod(request, expectedMethod) {
    const receivedMethod = request.method?.toUpperCase() ?? 'GET';
    if (receivedMethod !== expectedMethod) {
        throw new appError_1.AppError('METHOD_NOT_ALLOWED', `Only ${expectedMethod} requests are supported by this web trigger.`, 405, { receivedMethod });
    }
}
function parseJsonBody(request) {
    if (!request.body || !request.body.trim()) {
        throw new appError_1.AppError('BAD_REQUEST', 'Request body must contain JSON.', 400);
    }
    try {
        return JSON.parse(request.body);
    }
    catch (error) {
        throw new appError_1.AppError('BAD_REQUEST', 'Request body must be valid JSON.', 400, {
            cause: error instanceof Error ? error.message : String(error),
        });
    }
}
function getHeaderValue(request, headerName) {
    const matchingHeaderEntry = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === headerName.toLowerCase());
    if (!matchingHeaderEntry) {
        return undefined;
    }
    const [, value] = matchingHeaderEntry;
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
