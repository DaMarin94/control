import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import * as argon2 from 'argon2';
import { AuthService } from '../../../src/auth/auth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  category: {
    createMany: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mocked.jwt.token'),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-cuid-123',
  email: 'test@example.com',
  name: null as string | null,
  image: null as string | null,
  passwordHash: null as string | null,
  timezone: 'America/Argentina/Buenos_Aires',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------
  describe('register', () => {
    it('devuelve accessToken + usuario público al registrar exitosamente', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const newUser = makeUser({ passwordHash: 'hashed' });
      mockPrismaService.user.create.mockResolvedValue(newUser);
      mockPrismaService.category.createMany.mockResolvedValue({ count: 4 });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.user.id).toBe(newUser.id);
      expect(result.user.email).toBe(newUser.email);
      // Los campos sensibles no están en el resultado
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('hashea la contraseña con argon2id antes de guardar', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockImplementation(
        ({ data }: { data: { passwordHash: string } }) => {
          // Verificar que el hash es argon2id
          expect(data.passwordHash).toMatch(/^\$argon2id\$/);
          return Promise.resolve(makeUser({ passwordHash: data.passwordHash }));
        },
      );
      mockPrismaService.category.createMany.mockResolvedValue({ count: 4 });

      await service.register({ email: 'test@example.com', password: 'password123' });

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            timezone: 'America/Argentina/Buenos_Aires',
          }),
        }),
      );
    });

    it('lanza ConflictException si el email ya está registrado', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(makeUser());

      await expect(
        service.register({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('crea las 4 categorías por defecto al registrar', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(makeUser());
      mockPrismaService.category.createMany.mockResolvedValue({ count: 4 });

      await service.register({ email: 'test@example.com', password: 'password123' });

      expect(mockPrismaService.category.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Consumibles', scope: 'BOTH' }),
            expect.objectContaining({ name: 'Tarjeta de crédito', scope: 'BOTH' }),
            expect.objectContaining({ name: 'Gastos fijos', scope: 'BOTH' }),
            expect.objectContaining({ name: 'Servicios', scope: 'BOTH' }),
          ]),
          skipDuplicates: true,
        }),
      );
    });

    it('asigna la timezone por defecto America/Argentina/Buenos_Aires', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(makeUser());
      mockPrismaService.category.createMany.mockResolvedValue({ count: 4 });

      await service.register({ email: 'test@example.com', password: 'password123' });

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timezone: 'America/Argentina/Buenos_Aires',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  describe('login', () => {
    it('devuelve accessToken + usuario público con credenciales válidas', async () => {
      const hash = await argon2.hash('correctPassword', { type: argon2.argon2id });
      const user = makeUser({ passwordHash: hash });
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.login({
        email: 'test@example.com',
        password: 'correctPassword',
      });

      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.user.id).toBe(user.id);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('lanza UnauthorizedException si el email no existe (error genérico)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'noexiste@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña es incorrecta (error genérico)', async () => {
      const hash = await argon2.hash('correctPassword', { type: argon2.argon2id });
      const user = makeUser({ passwordHash: hash });
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('el mensaje de error no distingue email vs contraseña (RF-AUTH-005 A1)', async () => {
      // Caso: email no existe
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      let error1: UnauthorizedException | null = null;
      try {
        await service.login({ email: 'noexiste@example.com', password: 'any' });
      } catch (e) {
        error1 = e as UnauthorizedException;
      }

      // Caso: contraseña incorrecta
      const hash = await argon2.hash('correct', { type: argon2.argon2id });
      mockPrismaService.user.findUnique.mockResolvedValue(makeUser({ passwordHash: hash }));
      let error2: UnauthorizedException | null = null;
      try {
        await service.login({ email: 'test@example.com', password: 'wrong' });
      } catch (e) {
        error2 = e as UnauthorizedException;
      }

      expect(error1).not.toBeNull();
      expect(error2).not.toBeNull();
      // Ambos errores tienen exactamente el mismo mensaje
      expect(error1!.message).toBe(error2!.message);
    });

    it('lanza UnauthorizedException si el usuario existe pero no tiene passwordHash (solo-Google)', async () => {
      // Cuenta solo-Google: sin passwordHash
      mockPrismaService.user.findUnique.mockResolvedValue(makeUser({ passwordHash: null }));

      await expect(
        service.login({ email: 'google@example.com', password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  // googleAuth
  // -------------------------------------------------------------------------
  describe('googleAuth', () => {
    it('crea un usuario nuevo y sus categorías si no existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const newUser = makeUser({
        name: 'Google User',
        image: 'https://img.url/photo.jpg',
      });
      mockPrismaService.user.create.mockResolvedValue(newUser);
      mockPrismaService.category.createMany.mockResolvedValue({ count: 4 });

      const result = await service.googleAuth({
        email: 'google@example.com',
        name: 'Google User',
        image: 'https://img.url/photo.jpg',
      });

      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockPrismaService.category.createMany).toHaveBeenCalled();
    });

    it('no crea categorías si el usuario ya existe', async () => {
      const existingUser = makeUser({ name: 'Old Name' });
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        name: 'New Name',
      });

      await service.googleAuth({
        email: 'google@example.com',
        name: 'New Name',
      });

      expect(mockPrismaService.category.createMany).not.toHaveBeenCalled();
    });

    it('actualiza nombre e imagen si el usuario ya existe y cambiaron', async () => {
      const existingUser = makeUser({ name: 'Old Name', image: 'old.jpg' });
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        name: 'New Name',
        image: 'new.jpg',
      });

      await service.googleAuth({
        email: 'google@example.com',
        name: 'New Name',
        image: 'new.jpg',
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New Name', image: 'new.jpg' }),
        }),
      );
    });

    it('devuelve accessToken + usuario público para usuario ya existente', async () => {
      const existingUser = makeUser();
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      // Sin campos de perfil cambiados → no llama a update
      const result = await service.googleAuth({ email: 'google@example.com' });

      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.user.id).toBe(existingUser.id);
    });
  });
});
