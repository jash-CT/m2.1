import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { createClient } from 'redis';
import { configLoader } from './infrastructure/config/config';
import { DatabaseClient } from './infrastructure/database/client';
import { logger } from './infrastructure/logging/logger';
import { errorHandler } from './api/middleware/errorHandler';
import { authMiddleware } from './api/middleware/auth';
import { rateLimitMiddleware } from './api/middleware/rateLimit';
import { corsMiddleware } from './api/middleware/cors';
import { setupRoutes } from './api/routes';
import { runMigrations } from './infrastructure/database/migrate';

let dbClient: DatabaseClient;
let redisClient: ReturnType<typeof createClient>;

async function bootstrap(): Promise<void> {
  try {
    logger.info('Starting Healthcare Coordination System...');

    const config = configLoader();
    logger.info('Configuration validated successfully');

    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        tls: config.redis.tls,
      },
      password: config.redis.password,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
      process.exit(1);
    });

    await redisClient.connect();
    logger.info('Redis connected successfully');

    dbClient = new DatabaseClient({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: true } : false,
      max: config.database.maxConnections,
    });

    await dbClient.connect();
    logger.info('Database connected successfully');

    await runMigrations(dbClient);
    logger.info('Database migrations completed');

    const app: Application = express();

    app.set('trust proxy', 1);
    app.use(helmet({
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

    app.use(corsMiddleware(config.cors.allowedOrigins));

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use((req: Request, res: Response, next: NextFunction) => {
      const contentType = req.headers['content-type'];
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (!contentType || (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded'))) {
          return res.status(415).json({ error: 'Unsupported Media Type' });
        }
      }
      next();
    });

    app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    app.use(rateLimitMiddleware(redisClient, config.rateLimit));
    app.use(authMiddleware(config.jwt, config.apiKey));

    setupRoutes(app, dbClient, config);

    app.use(errorHandler);

    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`Server listening on ${config.server.host}:${config.server.port}`);
    });

    const gracefulShutdown = async () => {
      logger.info('Received shutdown signal, closing gracefully...');
      server.close(async () => {
        await dbClient.close();
        await redisClient.quit();
        logger.info('Shutdown complete');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error: any) {
    logger.error('Fatal startup error', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

bootstrap();