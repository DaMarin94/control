import { BadRequestException, Injectable } from '@nestjs/common';
import { CategoryScope, MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * CategoryValidatorService — validador compartido de categoría para movimientos.
 *
 * Consolidado en Fase 7 (D3) para evitar la duplicación que existía en
 * TransactionsService y RecurringService. Lo consumen los tres módulos de
 * movimientos: transactions, recurring, installments.
 *
 * Regla (RN-010): la categoría debe ser propia del usuario, activa (deletedAt null)
 * y con scope compatible con el type del movimiento:
 *   - EXPENSE: scope EXPENSE o BOTH
 *   - INCOME:  scope INCOME o BOTH
 *
 * Todos los errores son 400 BadRequest (es validación de input, no conflicto).
 * La categoría ajena NO se distingue de inexistente (no se revela si el id existe
 * en la DB de otro usuario).
 */
@Injectable()
export class CategoryValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida que la categoría:
   * 1. Exista en la DB
   * 2. Pertenezca al userId (RN-003, aislamiento)
   * 3. Esté activa (deletedAt null)
   * 4. Su scope sea compatible con el type del movimiento (RN-010)
   *
   * @throws BadRequestException en cualquier caso de fallo.
   */
  async validateCategory(
    userId: string,
    categoryId: string,
    type: MovementType,
  ): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, userId: true, scope: true, deletedAt: true },
    });

    // Inexistente o ajena: mismo error (no revelar ajenidad — RN-003)
    if (!category || category.userId !== userId) {
      throw new BadRequestException(
        'La categoría no existe o no pertenece al usuario',
      );
    }

    if (category.deletedAt !== null) {
      throw new BadRequestException('La categoría está eliminada');
    }

    if (!this.isScopeCompatible(category.scope, type)) {
      throw new BadRequestException(
        `La categoría no es compatible con el tipo "${type}". ` +
          `Su scope es "${category.scope}" y solo acepta movimientos de tipo ` +
          (category.scope === CategoryScope.EXPENSE ? 'EXPENSE' : 'INCOME') +
          '.',
      );
    }
  }

  /**
   * Verifica si el scope de una categoría es compatible con el type de un movimiento.
   *
   * Regla (RN-010):
   * - EXPENSE: scope EXPENSE o BOTH ✓; scope INCOME ✗
   * - INCOME:  scope INCOME o BOTH ✓; scope EXPENSE ✗
   */
  isScopeCompatible(scope: CategoryScope, type: MovementType): boolean {
    if (scope === CategoryScope.BOTH) return true;
    if (scope === CategoryScope.EXPENSE && type === MovementType.EXPENSE)
      return true;
    if (scope === CategoryScope.INCOME && type === MovementType.INCOME)
      return true;
    return false;
  }
}
