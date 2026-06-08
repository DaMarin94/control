/**
 * Tests unitarios de CategoriesService.
 *
 * Cubre:
 * - Normalización RN-014 (colisión por mayúsculas y acentos)
 * - Colisión con activa → 409 duplicado
 * - Colisión con eliminada → ReactivableConflictException con id correcto
 * - Reactivar (vuelve con scope/color original)
 * - Edición con revalidación de unicidad
 * - Soft delete
 * - Contador de movimientos
 * - Aislamiento por userId
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { CategoriesService } from '../../../src/categories/categories.service';
import { CategoriesRepository, CategoryWithCount } from '../../../src/categories/categories.repository';
import { ReactivableConflictException } from '../../../src/common/exceptions/reactivable-conflict.exception';
import { normalizeName } from '../../../src/categories/categories.repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepo = {
  findActiveByUser: jest.fn(),
  findByNormalizedName: jest.fn(),
  findActiveExcluding: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  countActiveByColor: jest.fn(),
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

function makeCategory(overrides: Partial<CategoryWithCount> = {}): CategoryWithCount {
  return {
    id: 'cat-001',
    userId: USER_A,
    name: 'Consumibles',
    scope: CategoryScope.BOTH,
    color: '#4F86C6',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    movementCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: mockRepo },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  // -------------------------------------------------------------------------
  // normalizeName (helper — tests directos)
  // -------------------------------------------------------------------------

  describe('normalizeName (RN-014)', () => {
    it('hace trim y lowercase', () => {
      expect(normalizeName('  HOLA  ')).toBe('hola');
    });

    it('es insensible a acentos', () => {
      expect(normalizeName('Café')).toBe('cafe');
      expect(normalizeName('café')).toBe('cafe');
      expect(normalizeName('CAFÉ')).toBe('cafe');
    });

    it('detecta colisión entre "café" y "Cafe"', () => {
      expect(normalizeName('café')).toBe(normalizeName('Cafe'));
    });

    it('detecta colisión entre "Héroe" y "heroe"', () => {
      expect(normalizeName('Héroe')).toBe(normalizeName('heroe'));
    });

    it('detecta colisión entre "SERVICIOS" y "servicios"', () => {
      expect(normalizeName('SERVICIOS')).toBe(normalizeName('servicios'));
    });

    it('conserva el nombre original — la función solo normaliza, no muta el original', () => {
      const original = 'Café con Leche';
      normalizeName(original);
      expect(original).toBe('Café con Leche');
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('devuelve categorías activas del usuario', async () => {
      const cats = [makeCategory(), makeCategory({ id: 'cat-002', name: 'Servicios' })];
      mockRepo.findActiveByUser.mockResolvedValue(cats);

      const result = await service.findAll(USER_A);

      expect(result).toEqual(cats);
      expect(mockRepo.findActiveByUser).toHaveBeenCalledWith(USER_A);
    });

    it('aislamiento: usa el userId correcto sin mezclar con otro usuario', async () => {
      mockRepo.findActiveByUser.mockResolvedValue([]);

      await service.findAll(USER_B);

      expect(mockRepo.findActiveByUser).toHaveBeenCalledWith(USER_B);
      expect(mockRepo.findActiveByUser).not.toHaveBeenCalledWith(USER_A);
    });

    it('incluye el contador de movimientos en cada categoría', async () => {
      const catWithMovements = makeCategory({ movementCount: 5 });
      mockRepo.findActiveByUser.mockResolvedValue([catWithMovements]);

      const result = await service.findAll(USER_A);

      expect(result[0].movementCount).toBe(5);
    });

    it('devuelve lista vacía si no hay categorías', async () => {
      mockRepo.findActiveByUser.mockResolvedValue([]);

      const result = await service.findAll(USER_A);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    const setupNoCollision = () => {
      mockRepo.findByNormalizedName.mockResolvedValue({ active: null, deleted: null });
      mockRepo.countActiveByColor.mockResolvedValue(new Map());
    };

    it('crea categoría sin colisión y devuelve la creada', async () => {
      setupNoCollision();
      const created = makeCategory({ name: 'Nueva' });
      mockRepo.create.mockResolvedValue(created);

      const result = await service.create(USER_A, { name: 'Nueva' });

      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nueva',
          scope: CategoryScope.BOTH, // default
        }),
      );
    });

    it('aplica scope BOTH por defecto si no se provee', async () => {
      setupNoCollision();
      mockRepo.create.mockResolvedValue(makeCategory());

      await service.create(USER_A, { name: 'Test' });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: CategoryScope.BOTH }),
      );
    });

    it('aplica el scope provisto en el DTO', async () => {
      setupNoCollision();
      mockRepo.create.mockResolvedValue(makeCategory({ scope: CategoryScope.EXPENSE }));

      await service.create(USER_A, { name: 'Gastos', scope: CategoryScope.EXPENSE });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ scope: CategoryScope.EXPENSE }),
      );
    });

    it('colisión con activa → ConflictException 409 (RN-008)', async () => {
      const activeCategory = makeCategory({ name: 'Consumibles' });
      mockRepo.findByNormalizedName.mockResolvedValue({ active: activeCategory, deleted: null });

      await expect(
        service.create(USER_A, { name: 'consumibles' }),
      ).rejects.toThrow(ConflictException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('colisión por mayúsculas → ConflictException (RN-014)', async () => {
      const activeCategory = makeCategory({ name: 'Servicios' });
      mockRepo.findByNormalizedName.mockResolvedValue({ active: activeCategory, deleted: null });

      await expect(
        service.create(USER_A, { name: 'SERVICIOS' }),
      ).rejects.toThrow(ConflictException);
    });

    it('colisión por acentos → ConflictException (RN-014)', async () => {
      const activeCategory = makeCategory({ name: 'Café' });
      mockRepo.findByNormalizedName.mockResolvedValue({ active: activeCategory, deleted: null });

      await expect(
        service.create(USER_A, { name: 'cafe' }),
      ).rejects.toThrow(ConflictException);
    });

    it('colisión con eliminada → ReactivableConflictException con id y datos correctos', async () => {
      const deletedCategory = makeCategory({
        id: 'deleted-cat-id',
        name: 'Viajes',
        scope: CategoryScope.EXPENSE,
        color: '#E07B54',
        deletedAt: new Date('2024-01-01'),
      });
      mockRepo.findByNormalizedName.mockResolvedValue({ active: null, deleted: deletedCategory });

      let thrownError: unknown;
      try {
        await service.create(USER_A, { name: 'viajes' });
      } catch (e) {
        thrownError = e;
      }

      expect(thrownError).toBeInstanceOf(ReactivableConflictException);
      const err = thrownError as ReactivableConflictException;
      expect(err.reactivablePayload.reactivable).toBe(true);
      expect(err.reactivablePayload.category.id).toBe('deleted-cat-id');
      expect(err.reactivablePayload.category.name).toBe('Viajes');
      expect(err.reactivablePayload.category.scope).toBe(CategoryScope.EXPENSE);
      expect(err.reactivablePayload.category.color).toBe('#E07B54');

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('colisión por acentos con eliminada → ReactivableConflictException (RN-014)', async () => {
      const deletedCategory = makeCategory({
        id: 'del-id',
        name: 'Héroe',
        deletedAt: new Date(),
      });
      mockRepo.findByNormalizedName.mockResolvedValue({ active: null, deleted: deletedCategory });

      await expect(
        service.create(USER_A, { name: 'heroe' }),
      ).rejects.toThrow(ReactivableConflictException);
    });

    it('asigna color del pool automáticamente (no toma color del body)', async () => {
      setupNoCollision();
      const created = makeCategory({ color: '#4F86C6' });
      mockRepo.create.mockResolvedValue(created);

      await service.create(USER_A, { name: 'Nueva' });

      // El color asignado viene del pool, no lo pone el usuario
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ color: expect.stringMatching(/^#[0-9A-F]{6}$/i) }),
      );
    });

    it('aislamiento: llama a findByNormalizedName con el userId correcto', async () => {
      setupNoCollision();
      mockRepo.create.mockResolvedValue(makeCategory({ userId: USER_B }));

      await service.create(USER_B, { name: 'Test' });

      expect(mockRepo.findByNormalizedName).toHaveBeenCalledWith(USER_B, expect.any(String));
    });
  });

  // -------------------------------------------------------------------------
  // Asignación de color (RF-CAT-005)
  // -------------------------------------------------------------------------

  describe('asignación de color', () => {
    const setupNoCollision = () => {
      mockRepo.findByNormalizedName.mockResolvedValue({ active: null, deleted: null });
    };

    it('elige el color menos usado (primero del pool si todos en 0)', async () => {
      setupNoCollision();
      mockRepo.countActiveByColor.mockResolvedValue(new Map());
      // Capturamos el color que se pasa al create para verificarlo
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeCategory({ color: data['color'] as string })),
      );

      const result = await service.create(USER_A, { name: 'Cat' });

      // Con todos los colores en 0, elige el primero del pool: #4F86C6
      expect(result.color).toBe('#4F86C6');
    });

    it('elige el color menos usado entre los existentes (todos los colores del pool cubiertos)', async () => {
      setupNoCollision();
      // Todos los colores del pool cubiertos, #6DBF67 tiene el conteo más bajo
      const colorCount = new Map([
        ['#4F86C6', 3],
        ['#E07B54', 3],
        ['#6DBF67', 1], // este es el menos usado
        ['#A98BD6', 2],
        ['#E8C84A', 5],
        ['#5BC4B8', 5],
        ['#E06B8B', 5],
        ['#8B9DBF', 5],
        ['#C47D3E', 5],
        ['#7DBF9E', 5],
      ]);
      mockRepo.countActiveByColor.mockResolvedValue(colorCount);
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeCategory({ color: data['color'] as string })),
      );

      const result = await service.create(USER_A, { name: 'Cat' });

      expect(result.color).toBe('#6DBF67');
    });

    it('en empate elige el primero en orden del pool', async () => {
      setupNoCollision();
      // #4F86C6 y #E07B54 tienen el mismo conteo mínimo
      // Los otros colores del pool no están en el map → cuentan como 0
      // (menos que #4F86C6 y #E07B54 que tienen 2)
      // Para que el empate sea entre los primeros, necesitamos que todos
      // los colores del pool sin mapear también estén en conteo alto.
      // Mejor: todos tienen count=2 excepto los primeros dos que tienen count=2 también.
      // En realidad los colores no en el map tienen count=0, que es menor.
      // Usamos un map que cubre todos los colores del pool con igual conteo
      // excepto un subconjunto donde los primeros dos están empatados en mínimo.
      const colorCount = new Map([
        ['#4F86C6', 2],
        ['#E07B54', 2],
        ['#6DBF67', 5],
        ['#A98BD6', 5],
        ['#E8C84A', 5],
        ['#5BC4B8', 5],
        ['#E06B8B', 5],
        ['#8B9DBF', 5],
        ['#C47D3E', 5],
        ['#7DBF9E', 5],
      ]);
      mockRepo.countActiveByColor.mockResolvedValue(colorCount);
      mockRepo.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(makeCategory({ color: data['color'] as string })),
      );

      const result = await service.create(USER_A, { name: 'Cat' });

      // #4F86C6 va primero en el pool y está empatado en mínimo (2) con #E07B54
      expect(result.color).toBe('#4F86C6');
    });
  });

  // -------------------------------------------------------------------------
  // reactivate
  // -------------------------------------------------------------------------

  describe('reactivate', () => {
    it('reactiva categoría eliminada del usuario → deletedAt = null', async () => {
      const deletedCat = makeCategory({
        id: 'cat-del',
        deletedAt: new Date('2024-01-01'),
        scope: CategoryScope.EXPENSE,
        color: '#E07B54',
      });
      mockRepo.findById.mockResolvedValue(deletedCat);
      const reactivated = { ...deletedCat, deletedAt: null };
      mockRepo.update.mockResolvedValue(reactivated);

      const result = await service.reactivate(USER_A, 'cat-del');

      expect(result.deletedAt).toBeNull();
      expect(mockRepo.update).toHaveBeenCalledWith('cat-del', { deletedAt: null });
    });

    it('vuelve con el scope original intacto', async () => {
      const deletedCat = makeCategory({
        id: 'cat-del',
        deletedAt: new Date(),
        scope: CategoryScope.INCOME,
      });
      mockRepo.findById.mockResolvedValue(deletedCat);
      mockRepo.update.mockResolvedValue({ ...deletedCat, deletedAt: null });

      const result = await service.reactivate(USER_A, 'cat-del');

      expect(result.scope).toBe(CategoryScope.INCOME);
    });

    it('vuelve con el color original intacto', async () => {
      const deletedCat = makeCategory({
        id: 'cat-del',
        deletedAt: new Date(),
        color: '#A98BD6',
      });
      mockRepo.findById.mockResolvedValue(deletedCat);
      mockRepo.update.mockResolvedValue({ ...deletedCat, deletedAt: null });

      const result = await service.reactivate(USER_A, 'cat-del');

      expect(result.color).toBe('#A98BD6');
    });

    it('vuelve con el mismo id', async () => {
      const deletedCat = makeCategory({ id: 'original-id', deletedAt: new Date() });
      mockRepo.findById.mockResolvedValue(deletedCat);
      mockRepo.update.mockResolvedValue({ ...deletedCat, deletedAt: null });

      const result = await service.reactivate(USER_A, 'original-id');

      expect(result.id).toBe('original-id');
    });

    it('404 si la categoría no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.reactivate(USER_A, 'no-existe')).rejects.toThrow(NotFoundException);
    });

    it('aislamiento: 404 si la categoría pertenece a otro usuario', async () => {
      const catOtherUser = makeCategory({ id: 'cat-b', userId: USER_B });
      mockRepo.findById.mockResolvedValue(catOtherUser);

      await expect(service.reactivate(USER_A, 'cat-b')).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('ConflictException si la categoría ya está activa', async () => {
      const activecat = makeCategory({ id: 'cat-active', deletedAt: null });
      mockRepo.findById.mockResolvedValue(activecat);

      await expect(service.reactivate(USER_A, 'cat-active')).rejects.toThrow(ConflictException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // update (PATCH)
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('actualiza nombre exitosamente sin colisión', async () => {
      const existing = makeCategory({ id: 'cat-001', name: 'Viejo' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findActiveExcluding.mockResolvedValue([]);
      const updated = { ...existing, name: 'Nuevo' };
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, 'cat-001', { name: 'Nuevo' });

      expect(result.name).toBe('Nuevo');
      expect(mockRepo.update).toHaveBeenCalledWith('cat-001', { name: 'Nuevo' });
    });

    it('actualiza scope exitosamente', async () => {
      const existing = makeCategory({ id: 'cat-001', scope: CategoryScope.BOTH });
      mockRepo.findById.mockResolvedValue(existing);
      const updated = { ...existing, scope: CategoryScope.EXPENSE };
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.update(USER_A, 'cat-001', { scope: CategoryScope.EXPENSE });

      expect(result.scope).toBe(CategoryScope.EXPENSE);
    });

    it('colisión de nombre con otra activa → ConflictException (RN-014)', async () => {
      const existing = makeCategory({ id: 'cat-001', name: 'Mi Cat' });
      const otherActive = makeCategory({ id: 'cat-002', name: 'Servicios' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findActiveExcluding.mockResolvedValue([otherActive]);

      await expect(
        service.update(USER_A, 'cat-001', { name: 'servicios' }),
      ).rejects.toThrow(ConflictException);

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('colisión por acentos al editar → ConflictException (RN-014)', async () => {
      const existing = makeCategory({ id: 'cat-001', name: 'Mi Cat' });
      const otherActive = makeCategory({ id: 'cat-002', name: 'Café' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findActiveExcluding.mockResolvedValue([otherActive]);

      await expect(
        service.update(USER_A, 'cat-001', { name: 'cafe' }),
      ).rejects.toThrow(ConflictException);
    });

    it('no colisiona consigo misma al editar (se excluye la propia)', async () => {
      const existing = makeCategory({ id: 'cat-001', name: 'Consumibles' });
      mockRepo.findById.mockResolvedValue(existing);
      // findActiveExcluding excluye la propia → sin colisión
      mockRepo.findActiveExcluding.mockResolvedValue([]);
      mockRepo.update.mockResolvedValue({ ...existing, name: 'consumibles actualizado' });

      await expect(
        service.update(USER_A, 'cat-001', { name: 'Consumibles Actualizado' }),
      ).resolves.not.toThrow();
    });

    it('404 si no existe o es de otro usuario', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.update(USER_A, 'no-existe', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('aislamiento: 404 si la categoría pertenece a otro usuario', async () => {
      const catOtherUser = makeCategory({ id: 'cat-b', userId: USER_B });
      mockRepo.findById.mockResolvedValue(catOtherUser);

      await expect(service.update(USER_A, 'cat-b', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('404 al editar una categoría eliminada', async () => {
      const deleted = makeCategory({ id: 'cat-del', deletedAt: new Date() });
      mockRepo.findById.mockResolvedValue(deleted);

      await expect(service.update(USER_A, 'cat-del', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // remove (DELETE / soft delete)
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('soft delete: actualiza deletedAt a now', async () => {
      const existing = makeCategory({ id: 'cat-001' });
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.remove(USER_A, 'cat-001');

      expect(mockRepo.update).toHaveBeenCalledWith(
        'cat-001',
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('404 si no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.remove(USER_A, 'no-existe')).rejects.toThrow(NotFoundException);
    });

    it('aislamiento: 404 si pertenece a otro usuario', async () => {
      const catOtherUser = makeCategory({ id: 'cat-b', userId: USER_B });
      mockRepo.findById.mockResolvedValue(catOtherUser);

      await expect(service.remove(USER_A, 'cat-b')).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('404 si ya está eliminada (no es idempotente)', async () => {
      const alreadyDeleted = makeCategory({ id: 'cat-del', deletedAt: new Date('2024-01-01') });
      mockRepo.findById.mockResolvedValue(alreadyDeleted);

      await expect(service.remove(USER_A, 'cat-del')).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });
});
