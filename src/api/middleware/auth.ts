import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { logger } from '../../infrastructure/logging/logger';

const ALLOWED_ALGORITHMS: jwt.Algorithm[] = ['HS256'];
const CLOCK_TOLERANCE = 60;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function authMiddleware(jwtConfig: { secret: string; expiry: number }, apiKeyConfig: { secret: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn('Missing authorization header', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }

    const [scheme, token] = parts;

    if (scheme === 'Bearer') {
      try {
        const decoded = jwt.verify(token, jwtConfig.secret, {
          algorithms: ALLOWED_ALGORITHMS,
          clockTolerance: CLOCK_TOLERANCE,
        }) as jwt.JwtPayload;

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
      } catch (error: any) {
        logger.warn('JWT verification failed', { error: error.message, ip: req.ip });
        return res.status(401).json({ error: 'Invalid token' });
      }
    } else if (scheme === 'ApiKey') {
      if (!constantTimeCompare(token, apiKeyConfig.secret)) {
        logger.warn('API key validation failed', { ip: req.ip });
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