"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const redactSensitive = winston_1.default.format((info) => {
    const sensitiveKeys = ['password', 'secret', 'token', 'authorization', 'api_key', 'ssn', 'dob', 'insurance_number'];
    const redact = (obj) => {
        if (typeof obj !== 'object' || obj === null)
            return obj;
        const result = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                result[key] = '[REDACTED]';
            }
            else if (typeof obj[key] === 'object') {
                result[key] = redact(obj[key]);
            }
            else {
                result[key] = obj[key];
            }
        }
        return result;
    };
    return redact(info);
});
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), redactSensitive(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
    ],
});
//# sourceMappingURL=logger.js.map