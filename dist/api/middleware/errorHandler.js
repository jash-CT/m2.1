"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../../infrastructure/logging/logger");
function errorHandler(err, req, res, next) {
    logger_1.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });
    res.status(err.status || 500).json({ error: 'Internal server error' });
}
//# sourceMappingURL=errorHandler.js.map