import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
}

/**
 * Interceptor global que envuelve todas las respuestas exitosas en el sobre estándar:
 * { success: true, statusCode, data }
 *
 * El statusCode coincide con el HTTP status de la respuesta.
 * Los errores NO pasan por este interceptor — los maneja AllExceptionsFilter.
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        statusCode: response.statusCode,
        data,
      })),
    );
  }
}
