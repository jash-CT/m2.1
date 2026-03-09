"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
const logger_1 = require("../../infrastructure/logging/logger");
function rateLimitMiddleware(redis, config) {
    return async (req, res, next) => {
        if (req.path === '/health') {
            return next();
        }
        const clientKey = req.ip || 'unknown';
        const key = `ratelimit:${clientKey}`;
        const now = Date.now();
        const windowStart = now - config.windowMs;
        try {
            await redis.zRemRangeByScore(key, 0, windowStart);
            const requestCount = await redis.zCard(key);
            if (requestCount >= config.maxRequests) {
                logger_1.logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
                return res.status(429).json({ error: 'Too many requests' });
            }
            await redis.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
            await redis.expire(key, Math.ceil(config.windowMs / 1000));
            next();
        }
        catch (error) {
            logger_1.logger.error('Rate limit middleware error', { error: error.message });
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}
//# sourceMappingURL=rateLimit.js.map