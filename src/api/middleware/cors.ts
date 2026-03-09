import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logging/logger';

export function corsMiddleware(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (req.method === 'OPTIONS') {
      if (!origin || !allowedOrigins.includes(origin)) {
        logger.warn('CORS preflight rejected', { origin, ip: req.ip });
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