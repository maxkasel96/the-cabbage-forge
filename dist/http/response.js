"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJsonResponse = createJsonResponse;
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
const constants_1 = require("../config/constants");
const appError_1 = require("../errors/appError");
function createJsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: Object.fromEntries(Object.entries(constants_1.DEFAULT_JSON_HEADERS).map(([key, value]) => [key, [...value]])),
        body: JSON.stringify(body),
    };
}
function createSuccessResponse(statusCode, data) {
    return createJsonResponse(statusCode, {
        ok: true,
        data,
    });
}
function createErrorResponse(error) {
    const appError = (0, appError_1.toAppError)(error);
    return createJsonResponse(appError.statusCode, {
        ok: false,
        error: {
            code: appError.code,
            message: appError.message,
            details: appError.details,
        },
    });
}
