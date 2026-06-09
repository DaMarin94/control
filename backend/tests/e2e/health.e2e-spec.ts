import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { Logger } from 'nestjs-pino';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.PORT = '3001';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });

    const logger = app.get(Logger);
    app.useLogger(logger);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(logger));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → sobre { success: true, statusCode: 200, data: { status: "ok" } }', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: Record<string, unknown> }) => {
        expect(res.body).toEqual({
          success: true,
          statusCode: 200,
          data: { status: 'ok' },
        });
      });
  });

  it('GET /ruta-inexistente → sobre de error { success: false, statusCode: 404 }', () => {
    return request(app.getHttpServer())
      .get('/ruta-que-no-existe')
      .expect(404)
      .expect((res: { body: Record<string, unknown> }) => {
        expect(res.body.success).toBe(false);
        expect(res.body.statusCode).toBe(404);
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('timestamp');
        expect(res.body.error).toHaveProperty('path');
      });
  });
});
