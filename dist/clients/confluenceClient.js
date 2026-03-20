"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluenceClient = void 0;
const api_1 = __importStar(require("@forge/api"));
const appError_1 = require("../errors/appError");
/**
 * This client owns the raw REST v2 conversation with Confluence.
 *
 * That separation matters because it keeps the rest of the application focused on business workflow, while this file
 * handles transport details such as HTTP methods, JSON parsing, and translating non-2xx responses into structured
 * application errors.
 */
async function parseJsonResponse(response, operation) {
    const responseText = await response.text();
    if (!response.ok) {
        throw new appError_1.AppError('UPSTREAM_ERROR', `Confluence ${operation} request failed.`, 502, {
            operation,
            status: response.status,
            statusText: response.statusText,
            responseText,
        });
    }
    try {
        return JSON.parse(responseText);
    }
    catch (error) {
        throw new appError_1.AppError('UPSTREAM_ERROR', `Confluence ${operation} response was not valid JSON.`, 502, {
            operation,
            cause: error instanceof Error ? error.message : String(error),
            responseText,
        });
    }
}
class ConfluenceClient {
    async getPage(pageId) {
        const response = await api_1.default.asApp().requestConfluence((0, api_1.route) `/wiki/api/v2/pages/${pageId}?body-format=storage`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });
        return parseJsonResponse(response, 'get page');
    }
    async updatePage(payload) {
        const response = await api_1.default.asApp().requestConfluence((0, api_1.route) `/wiki/api/v2/pages/${payload.id}`, {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        return parseJsonResponse(response, 'update page');
    }
}
exports.ConfluenceClient = ConfluenceClient;
