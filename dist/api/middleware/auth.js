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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto = __importStar(require("crypto"));
const logger_1 = require("../../infrastructure/logging/logger");
const ALLOWED_ALGORITHMS = ['HS256'];
const CLOCK_TOLERANCE = 60;
function constantTimeCompare(a, b) {
    if (a.length !== b.length)
        return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function authMiddleware(jwtConfig, apiKeyConfig) {
    return (req, res, next) => {
        if (req.path === '/health') {
            return next();
        }
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            logger_1.logger.warn('Missing authorization header', { ip: req.ip, path: req.path });
            return res.status(401).json({ error: 'Authentication required' });
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2) {
            return res.status(401).json({ error: 'Invalid authorization format' });
        }
        const [scheme, token] = parts;
        if (scheme === 'Bearer') {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, jwtConfig.secret, {
                    algorithms: ALLOWED_ALGORITHMS,
                    clockTolerance: CLOCK_TOLERANCE,
                });
                if (!decoded.sub || !decoded.email || !decoded.role) {
                    return res.status(401).json({ error: 'Invalid token claims' });
                }
                const now = Math.floor(Date.now() / 1000);
                if (decoded.exp && decoded.exp < now) {
                    return res.status(401).json({ error: 'Token expired' });
                }
                if (decoded.iat && decoded.iat > now + CLOCK_TOLERANCE) {
                    return res.status(401).json({ error: 'Token not yet valid' });
                }
                if (decoded.nbf && decoded.nbf > now + CLOCK_TOLERANCE) {
                    return res.status(401).json({ error: 'Token not yet valid' });
                }
                req.user = {
                    id: decoded.sub,
                    email: decoded.email,
                    role: decoded.role,
                };
                return next();
            }
            catch (error) {
                logger_1.logger.warn('JWT verification failed', { error: error.message, ip: req.ip });
                return res.status(401).json({ error: 'Invalid token' });
            }
        }
        else if (scheme === 'ApiKey') {
            if (!constantTimeCompare(token, apiKeyConfig.secret)) {
                logger_1.logger.warn('API key validation failed', { ip: req.ip });
                return res.status(401).json({ error: 'Invalid API key' });
            }
            req.user = {
                id: 'system',
                email: 'system@internal',
                role: 'system',
            };
            return next();
        }
        return res.status(401).json({ error: 'Unsupported authentication scheme' });
    };
}
//# sourceMappingURL=auth.js.map