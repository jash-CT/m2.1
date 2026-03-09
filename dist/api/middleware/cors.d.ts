import { Request, Response, NextFunction } from 'express';
export declare function corsMiddleware(allowedOrigins: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=cors.d.ts.map