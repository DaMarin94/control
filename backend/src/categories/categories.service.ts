import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryScope } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import {
  CategoriesRepository,
  CategoryWithCount,
  normalizeName,
} from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { COLOR_POOL, normalizeColorHex } from './color-pool';
import {
  ReactivableConflictException,
  ReactivableCategoryPayload,
} from '../common/exceptions/reactivable-conflict.exception';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly repo: CategoriesRepository,
    private readonly logger: Logger,
  ) {}

  // -------------------------------------------------------------------------
  // GET /categories — lista activas con contador de movimientos
  // -------------------------------------------------------------------------

  async findAll(userId: string): Promise<CategoryWithCount[]> {
    const categories = await this.repo.findActiveByUser(userId);
    this.logger.debug(
      { userId, count: categories.length },
      'Categorías listadas',
    );
    return categories;
  }

  // -------------------------------------------------------------------------
  // POST /categories — crear (flujo crear-o-reactivar, RF-CAT-002)
  // -------------------------------------------------------------------------

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryWithCount> {
    // 1. Normalizar nombre (RN-014)
    const normalizedInput = normalizeName(dto.name);

    if (!normalizedInput) {
      throw new ConflictException(
        'El nombre de la categoría no puede estar vacío',
      );
    }

    // 2. Buscar colisiones (activa y eliminada)
    const { active, deleted } = await this.repo.findByNormalizedName(
      userId,
      normalizedInput,
    );

    // 3a. Colisión con activa → 409 duplicado (RN-008)
    if (active) {
      this.logger.warn(
        { userId, name: dto.name },
        'Intento de crear categoría duplicada (activa)',
      );
      throw new ConflictException(
        `Ya existe una categoría activa con el nombre "${active.name}"`,
      );
    }

    // 3b. Colisión con eliminada → 409 reactivable (RF-CAT-002 A3)
    if (deleted) {
      this.logger.warn(
        { userId, name: dto.name, deletedCategoryId: deleted.id },
        'Intento de crear categoría con nombre de una eliminada — reactivable',
      );
      const payload: ReactivableCategoryPayload = {
        reactivable: true,
        category: {
          id: deleted.id,
          name: deleted.name,
          scope: deleted.scope,
          color: deleted.color,
        },
      };
      throw new ReactivableConflictException(
        `Ya tenés una categoría eliminada con el nombre "${deleted.name}". Podés reactivarla.`,
        payload,
      );
    }

    // 4. Sin colisión → usar color provisto o asignar del pool (RF-CAT-005)
    const color = dto.color !== undefined
      ? normalizeColorHex(dto.color)
      : await this.assignColor(userId);
    const scope = dto.scope ?? CategoryScope.BOTH;

    const category = await this.repo.create({
      user: { connect: { id: userId } },
      name: dto.name,
      scope,
      color,
    });

    this.logger.log(
      { userId, categoryId: category.id, name: category.name },
      'Categoría creada',
    );

    return category;
  }

  // -------------------------------------------------------------------------
  // POST /categories/:id/reactivate — reactivar (RF-CAT-002 A3.1)
  // -------------------------------------------------------------------------

  async reactivate(
    userId: string,
    id: string,
  ): Promise<CategoryWithCount> {
    const category = await this.repo.findById(id);

    // Validar existencia y ownership
    if (!category || category.userId !== userId) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Debe estar efectivamente eliminada
    if (category.deletedAt === null) {
      throw new ConflictException('La categoría ya está activa');
    }

    const reactivated = await this.repo.update(id, { deletedAt: null });

    this.logger.log(
      { userId, categoryId: id },
      'Categoría reactivada',
    );

    return reactivated;
  }

  // -------------------------------------------------------------------------
  // PATCH /categories/:id — editar (RF-CAT-003)
  // -------------------------------------------------------------------------

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryWithCount> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Solo permite editar categorías activas
    if (existing.deletedAt !== null) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Revalidar unicidad si el nombre cambia (RN-014)
    if (dto.name !== undefined) {
      const normalizedInput = normalizeName(dto.name);

      if (!normalizedInput) {
        throw new ConflictException(
          'El nombre de la categoría no puede estar vacío',
        );
      }

      const activeExcluding = await this.repo.findActiveExcluding(userId, id);
      const collision = activeExcluding.find(
        (cat) => normalizeName(cat.name) === normalizedInput,
      );

      if (collision) {
        this.logger.warn(
          { userId, categoryId: id, name: dto.name },
          'Edición: colisión de nombre con categoría activa',
        );
        throw new ConflictException(
          `Ya existe una categoría activa con el nombre "${collision.name}"`,
        );
      }
    }

    const updated = await this.repo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.color !== undefined && { color: normalizeColorHex(dto.color) }),
    });

    this.logger.log(
      { userId, categoryId: id },
      'Categoría actualizada',
    );

    return updated;
  }

  // -------------------------------------------------------------------------
  // DELETE /categories/:id — soft delete (RF-CAT-004)
  // -------------------------------------------------------------------------

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Si ya está eliminada → 404 (no es idempotente: se considera no existente)
    if (existing.deletedAt !== null) {
      throw new NotFoundException('Categoría no encontrada');
    }

    await this.repo.update(id, { deletedAt: new Date() });

    this.logger.log(
      { userId, categoryId: id },
      'Categoría eliminada (soft delete)',
    );
  }

  // -------------------------------------------------------------------------
  // Helper privado: asignación automática de color (RF-CAT-005)
  // -------------------------------------------------------------------------

  /**
   * Asigna el color del pool menos usado entre las categorías ACTIVAS del usuario.
   *
   * Estrategia:
   * 1. Contar cuántas categorías activas usa cada color del pool.
   * 2. Elegir el color con menor conteo.
   * 3. En caso de empate, elegir el que aparece primero en COLOR_POOL (orden de definición).
   * 4. Si todos los colores ya están en uso, cicla (mismo criterio: menor uso primero).
   *
   * Esta estrategia es determinística: dado el mismo estado de la DB, siempre
   * elige el mismo color. No requiere estado externo ni randomización.
   */
  private async assignColor(userId: string): Promise<string> {
    const colorCount = await this.repo.countActiveByColor(userId);

    let minColor = COLOR_POOL[0];
    let minCount = colorCount.get(COLOR_POOL[0]) ?? 0;

    for (let i = 1; i < COLOR_POOL.length; i++) {
      const count = colorCount.get(COLOR_POOL[i]) ?? 0;
      if (count < minCount) {
        minCount = count;
        minColor = COLOR_POOL[i];
      }
    }

    return minColor;
  }
}
