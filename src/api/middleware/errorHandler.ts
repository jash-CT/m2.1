import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logging/logger';

function sanitizeStackTrace(stack: string): string {
  if (!stack) return stack;
  // Remove file paths while preserving function names and line numbers
  return stack.replace(/(\/.*?)\/([^/]+):(\d+):(\d+)/g, '[key])$2:$3:$4');
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: sanitizeStackTrace(err.stack),+    path: req.path,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(err.status || 500).json({ error: 'Internal server error' });
}