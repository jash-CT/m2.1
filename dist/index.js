"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const redis_1 = require("redis");
const config_1 = require("./infrastructure/config/config");
const client_1 = require("./infrastructure/database/client");
const logger_1 = require("./infrastructure/logging/logger");
const errorHandler_1 = require("./api/middleware/errorHandler");
const auth_1 = require("./api/middleware/auth");
const rateLimit_1 = require("./api/middleware/rateLimit");
const cors_1 = require("./api/middleware/cors");
const routes_1 = require("./api/routes");
const migrate_1 = require("./infrastructure/database/migrate");
let dbClient;
let redisClient;
async function bootstrap() {
    try {
        logger_1.logger.info('Starting Healthcare Coordination System...');
        const config = (0, config_1.configLoader)();
        logger_1.logger.info('Configuration validated successfully');
        redisClient = (0, redis_1.createClient)({
            socket: {
                host: config.redis.host,
                port: config.redis.port,
                tls: config.redis.tls,
            },
            password: config.redis.password,
        });
        redisClient.on('error', (err) => {
            logger_1.logger.error('Redis client error', { error: err.message });
            process.exit(1);
        });
        await redisClient.connect();
        logger_1.logger.info('Redis connected successfully');
        dbClient = new client_1.DatabaseClient({
            host: config.database.host,
            port: config.database.port,
            database: config.database.name,
            user: config.database.user,
            password: config.database.password,
            ssl: config.database.ssl ? { rejectUnauthorized: true } : false,
            max: config.database.maxConnections,
        });
        await dbClient.connect();
        logger_1.logger.info('Database connected successfully');
        await (0, migrate_1.runMigrations)(dbClient);
        logger_1.logger.info('Database migrations completed');
        const app = (0, express_1.default)();
        app.set('trust proxy', 1);
        app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
            },
        }));
        app.use((0, cors_1.corsMiddleware)(config.cors.allowedOrigins));
        app.use(express_1.default.json({ limit: '10mb' }));
        app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        app.use((req, res, next) => {
            const contentType = req.headers['content-type'];
            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                if (!contentType || (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded'))) {
                    return res.status(415).json({ error: 'Unsupported Media Type' });
                }
            }
            next();
        });
        app.get('/health', (req, res) => {
            res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
        });
        app.use((0, rateLimit_1.rateLimitMiddleware)(redisClient, config.rateLimit));
        app.use((0, auth_1.authMiddleware)(config.jwt, config.apiKey));
        (0, routes_1.setupRoutes)(app, dbClient, config);
        app.use(errorHandler_1.errorHandler);
        const server = app.listen(config.server.port, config.server.host, () => {
            logger_1.logger.info(`Server listening on ${config.server.host}:${config.server.port}`);
        });
        const gracefulShutdown = async () => {
            logger_1.logger.info('Received shutdown signal, closing gracefully...');
            server.close(async () => {
                await dbClient.close();
                await redisClient.quit();
                logger_1.logger.info('Shutdown complete');
                process.exit(0);
            });
            setTimeout(() => {
                logger_1.logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    }
    catch (error) {
        logger_1.logger.error('Fatal startup error', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=index.js.map