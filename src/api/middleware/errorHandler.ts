import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logging/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(err.status || 500).json({ error: 'Internal server error' });
}