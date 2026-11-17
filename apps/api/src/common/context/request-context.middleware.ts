import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  res.setHeader('x-request-id', requestId);
  RequestContext.run({ requestId, ip: req.ip, userAgent: req.headers['user-agent'] }, () => next());
}
