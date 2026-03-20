"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.toAppError = toAppError;
class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode, details) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}
exports.AppError = AppError;
function toAppError(error) {
    if (error instanceof AppError) {
        return error;
    }
    if (error instanceof Error) {
        return new AppError('INTERNAL_ERROR', error.message, 500);
    }
    return new AppError('INTERNAL_ERROR', 'An unexpected error occurred.', 500, error);
}
