import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@latif/shared';
import { Prisma } from '../../generated/prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) this.logger.error(exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(e: unknown): ApiErrorBody {
    if (e instanceof ZodValidationException) {
      const zodError = e.getZodError() as ZodError;
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        code: 'validation_error',
        errors: zodError.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
    }
    if (e instanceof HttpException) {
      const r = e.getResponse();
      const message =
        typeof r === 'string' ? r : ((r as { message?: string | string[] }).message ?? e.message);
      return {
        statusCode: e.getStatus(),
        message: Array.isArray(message) ? message.join(', ') : message,
        code: (r as { code?: string }).code,
      };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002')
        return { statusCode: HttpStatus.CONFLICT, message: 'Already exists', code: 'conflict' };
      if (e.code === 'P2025')
        return { statusCode: HttpStatus.NOT_FOUND, message: 'Not found', code: 'not_found' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
