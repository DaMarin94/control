import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { ReactivableConflictException } from '../exceptions/reactivable-conflict.exception';

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: {
    message: string;
    timestamp: string;
    path: string;
    // Presente solo en ReactivableConflictException (colisión con categoría eliminada)
    data?: unknown;
  };
}

/**
 * Exception Filter global que intercepta toda excepción de cualquier endpoint.
 *
 * Comportamiento:
 * - Errores esperados (validación 400, 401, 403, 404) → log warn
 * - Errores inesperados (500, bugs, DB caída) → log error con stack completo
 * - Los detalles internos de un 500 NUNCA se filtran al cliente (mensaje genérico)
 * - Siempre responde con el sobre estándar { success: false, statusCode, error }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.url;
    // requestId inyectado por pino-http
    const requestId = (request as Request & { id?: string }).id;

    let statusCode: number;
    let clientMessage: string;
    let extraData: unknown = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // class-validator devuelve un objeto con { message: string[] }
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const msg = (exceptionResponse as { message: unknown }).message;
        clientMessage = Array.isArray(msg) ? msg.join(', ') : String(msg);
      } else if (typeof exceptionResponse === 'string') {
        clientMessage = exceptionResponse;
      } else {
        clientMessage = exception.message;
      }

      // Excepción especial: colisión con categoría eliminada (RF-CAT-002, A3)
      // Incluye payload estructurado { reactivable, category } en error.data
      if (exception instanceof ReactivableConflictException) {
        extraData = exception.reactivablePayload;
      }

      // Errores esperados: 400, 401, 403, 404, 409, 422 → warn
      this.logger.warn({
        requestId,
        statusCode,
        path,
        message: `[${statusCode}] ${clientMessage}`,
      });
    } else {
      // Error inesperado (bug, DB caída, etc.) → 500
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      clientMessage = 'Error interno del servidor';

      // Loggeamos el stack completo para diagnóstico, nunca lo enviamos al cliente
      this.logger.error({
        requestId,
        statusCode,
        path,
        message: 'Unhandled exception',
        error:
          exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      error: {
        message: clientMessage,
        timestamp,
        path,
        ...(extraData !== undefined && { data: extraData }),
      },
    };

    response.status(statusCode).json(body);
  }
}
