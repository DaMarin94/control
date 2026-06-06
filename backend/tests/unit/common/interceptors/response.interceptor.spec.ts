import { ResponseInterceptor } from '../../../../src/common/interceptors/response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('debe estar definido', () => {
    expect(interceptor).toBeDefined();
  });

  it('debe envolver la respuesta en el sobre { success, statusCode, data }', (done) => {
    const mockResponseData = { status: 'ok' };
    const mockStatusCode = 200;

    const mockExecutionContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: mockStatusCode }),
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler = {
      handle: () => of(mockResponseData),
    } as CallHandler;

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toEqual({
          success: true,
          statusCode: mockStatusCode,
          data: mockResponseData,
        });
        done();
      },
      error: done,
    });
  });
});
