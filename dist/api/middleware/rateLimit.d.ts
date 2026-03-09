import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
export declare function rateLimitMiddleware(redis: ReturnType<typeof createClient>, config: {
    windowMs: number;
    maxRequests: number;
}): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=rateLimit.d.ts.map