/**
 * Tests unitarios de PreferencesService.
 *
 * Cubre:
 * - GET: devuelve el blob para usuario con fila existente
 * - GET: devuelve {} para usuario sin fila (back-compat, usuarios viejos)
 * - PUT (update): upsert correcto — crea si no existe, actualiza si existe
 * - PUT: reemplaza el blob completo (no hace merge)
 * - Aislamiento por userId
 * - getPreferencesForAuth: helper de auth devuelve {} cuando no hay fila
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { PreferencesService } from '../../../src/preferences/preferences.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { UpdatePreferencesDto } from '../../../src/preferences/dto/update-preferences.dto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  userPreferences: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
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

const USER_A = 'user-a-id';
const USER_B = 'user-b-id';

function makePreferences(
  userId: string,
  data: Record<string, unknown> = {},
) {
  return {
    id: `prefs-${userId}`,
    userId,
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<PreferencesService>(PreferencesService);
  });

  // -------------------------------------------------------------------------
  // getPreferences
  // -------------------------------------------------------------------------
  describe('getPreferences', () => {
    it('devuelve el blob del usuario cuando existe la fila', async () => {
      const blob = { monthSections: { collapsed: ['cuotas'] } };
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(
        makePreferences(USER_A, blob),
      );

      const result = await service.getPreferences(USER_A);

      expect(result).toEqual(blob);
      expect(mockPrismaService.userPreferences.findUnique).toHaveBeenCalledWith({
        where: { userId: USER_A },
      });
    });

    it('devuelve {} cuando no existe fila (usuario previo a Fase 1.1.0)', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getPreferences(USER_A);

      expect(result).toEqual({});
    });

    it('devuelve {} cuando el blob es vacío', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(
        makePreferences(USER_A, {}),
      );

      const result = await service.getPreferences(USER_A);

      expect(result).toEqual({});
    });

    it('no mezcla datos de otro usuario (aislamiento por userId)', async () => {
      const blobA = { theme: 'dark' };
      const blobB = { theme: 'light' };

      mockPrismaService.userPreferences.findUnique
        .mockResolvedValueOnce(makePreferences(USER_A, blobA))
        .mockResolvedValueOnce(makePreferences(USER_B, blobB));

      const resultA = await service.getPreferences(USER_A);
      const resultB = await service.getPreferences(USER_B);

      expect(resultA).toEqual(blobA);
      expect(resultB).toEqual(blobB);
      expect(resultA).not.toEqual(resultB);
    });
  });

  // -------------------------------------------------------------------------
  // updatePreferences
  // -------------------------------------------------------------------------
  describe('updatePreferences', () => {
    it('hace upsert y devuelve el blob actualizado', async () => {
      const newBlob = { monthSections: { order: ['fijos', 'unicos', 'cuotas'] } };
      const dto: UpdatePreferencesDto = { data: newBlob };

      mockPrismaService.userPreferences.upsert.mockResolvedValue(
        makePreferences(USER_A, newBlob),
      );

      const result = await service.updatePreferences(USER_A, dto);

      expect(result).toEqual(newBlob);
    });

    it('llama upsert con where userId correcto', async () => {
      const dto: UpdatePreferencesDto = { data: { key: 'value' } };
      mockPrismaService.userPreferences.upsert.mockResolvedValue(
        makePreferences(USER_A, dto.data),
      );

      await service.updatePreferences(USER_A, dto);

      expect(mockPrismaService.userPreferences.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_A },
        }),
      );
    });

    it('reemplaza el blob completo — NO hace merge', async () => {
      // Simula que la fila existente tenía datos distintos
      const newBlob = { onlyNewKey: true };
      const dto: UpdatePreferencesDto = { data: newBlob };

      mockPrismaService.userPreferences.upsert.mockResolvedValue(
        makePreferences(USER_A, newBlob),
      );

      const result = await service.updatePreferences(USER_A, dto);

      // El resultado es exactamente lo que se mandó, sin combinar con lo previo
      expect(result).toEqual(newBlob);
      // Verifica que el campo update contiene exactamente el nuevo blob
      expect(mockPrismaService.userPreferences.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ data: newBlob }),
          create: expect.objectContaining({ userId: USER_A }),
        }),
      );
    });

    it('acepta un blob vacío {}', async () => {
      const dto: UpdatePreferencesDto = { data: {} };
      mockPrismaService.userPreferences.upsert.mockResolvedValue(
        makePreferences(USER_A, {}),
      );

      const result = await service.updatePreferences(USER_A, dto);

      expect(result).toEqual({});
    });

    it('acepta blobs con valores anidados complejos', async () => {
      const complexBlob = {
        monthSections: {
          collapsed: ['cuotas', 'fijos'],
          order: ['unicos', 'fijos', 'cuotas'],
        },
        reports: [
          { type: 'income-vs-expense', year: 2026, categories: [] },
        ],
      };
      const dto: UpdatePreferencesDto = { data: complexBlob };

      mockPrismaService.userPreferences.upsert.mockResolvedValue(
        makePreferences(USER_A, complexBlob),
      );

      const result = await service.updatePreferences(USER_A, dto);

      expect(result).toEqual(complexBlob);
    });
  });

  // -------------------------------------------------------------------------
  // getPreferencesForAuth
  // -------------------------------------------------------------------------
  describe('getPreferencesForAuth', () => {
    it('devuelve el blob cuando existe la fila', async () => {
      const blob = { reportCards: [] };
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(
        makePreferences(USER_A, blob),
      );

      const result = await service.getPreferencesForAuth(USER_A);

      expect(result).toEqual(blob);
    });

    it('devuelve {} cuando no existe fila — sin lanzar error (back-compat)', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getPreferencesForAuth(USER_A);

      expect(result).toEqual({});
    });
  });
});
