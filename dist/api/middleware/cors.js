"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = corsMiddleware;
const logger_1 = require("../../infrastructure/logging/logger");
function corsMiddleware(allowedOrigins) {
    return (req, res, next) => {
        const origin = req.headers.origin;
        if (req.method === 'OPTIONS') {
            if (!origin || !allowedOrigins.includes(origin)) {
                logger_1.logger.warn('CORS preflight rejected', { origin, ip: req.ip });
                return res.status(403).json({ error: 'Forbidden' });
            }
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '86400');
            return res.status(204).send();
        }
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        next();
    };
}
//# sourceMappingURL=cors.js.map