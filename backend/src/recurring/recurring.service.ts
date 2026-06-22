import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, FormulaOperator, MovementType, RecurringFrequency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { CategoryValidatorService } from '../categories/category-validator.service';
import {
  RecurringRepository,
  RecurringWithCategory,
  SkipToggleResult,
} from './recurring.repository';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { CreateCalculatedRecurringDto } from './dto/create-calculated-recurring.dto';
import { UpdateCalculatedRecurringDto } from './dto/update-calculated-recurring.dto';
import { CreateCalculatedFromTransactionDto } from './dto/create-calculated-from-transaction.dto';
import { UpdateCalculatedFromTransactionDto } from './dto/update-calculated-from-transaction.dto';
import { CreateCalculatedFromInstallmentDto } from './dto/create-calculated-from-installment.dto';
import { UpdateCalculatedFromInstallmentDto } from './dto/update-calculated-from-installment.dto';
import { validateFormulaOperand } from './formula.helper';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class RecurringService {
  constructor(
    private readonly repo: RecurringRepository,
    private readonly categoryValidator: CategoryValidatorService,
    private readonly logger: Logger,
    private readonly settingsService: SettingsService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /recurring — crear fijo normal (RF-MF-001)
  // ---------------------------------------------------------------------------

  async create(
    userId: string,
    dto: CreateRecurringDto,
  ): Promise<RecurringWithCategory> {
    // Validar mes semántico de startMonth
    this.validateMonthValue(dto.startMonth);

    // Validar categoría: propia + activa + scope compatible (RN-010)
    await this.categoryValidator.validateCategory(userId, dto.categoryId, dto.type);

    const effectiveExchangeRate = dto.exchangeRate ?? 1;

    // Cargar la defaultCurrency del usuario para anclarla como anchor (Fase 1.2.4)
    const userSettings = await this.settingsService.getSettings(userId);
    const anchorCurrency = userSettings.defaultCurrency;

    const r = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: dto.type,
      amountCents: dto.amountCents,
      startMonth: dto.startMonth,
      frequency: dto.frequency ?? RecurringFrequency.MONTHLY,
      description: dto.description ?? null,
      ...(dto.currency !== undefined && { currency: dto.currency }),
      exchangeRate: effectiveExchangeRate,
      anchorCurrency,
      // chainId se genera por el @default(cuid()) del schema;
      // sourceChainId/formulaOperator/formulaOperand/formulaSign son null (fijo normal)
    });

    await this.settingsService.updateLastExchangeRate(userId, effectiveExchangeRate);

    this.logger.log(
      {
        userId,
        recurringId: r.id,
        chainId: r.chainId,
        type: r.type,
        amountCents: r.amountCents,
        startMonth: r.startMonth,
      },
      'Movimiento fijo creado',
    );

    return r;
  }

  // ---------------------------------------------------------------------------
  // POST /recurring/:id/calculated — crear calculado desde un fijo (RF-MCALC-001)
  // ---------------------------------------------------------------------------

  /**
   * Crea un movimiento calculado derivado de un fijo de origen.
   *
   * El origen es el fijo con id = originId (parámetro de ruta).
   * El calculado es un nuevo fijo (cadena nueva) con:
   *   - sus propios type/categoryId/description (del DTO)
   *   - su propia chainId nueva (cadena independiente del calculado)
   *   - sourceChainId = chainId del origen (vínculo estable a la cadena del origen)
   *   - fórmula: operator + operand + sign
   *   - amountCents = 0 (campo requerido en DB; el monto real se deriva on-the-fly
   *     en GET /movements. No se usa este campo para calculados.)
   *
   * El calculado NO puede ser a su vez un calculado (sin encadenamiento — RF-MCALC-001).
   * Su presencia en los meses queda gate-ada por el origen (aparece donde aparece el origen).
   * Restricción de frecuencia, skip y deletedFrom del origen se aplican en la lectura.
   *
   * 400 si el origen es a su vez un calculado, o si la categoría es inválida,
   *     o si el operando es 0 en DIV/PCT.
   * 404 si el origen no existe o no es del usuario.
   */
  async createCalculated(
    userId: string,
    originId: string,
    dto: CreateCalculatedRecurringDto,
  ): Promise<RecurringWithCategory> {
    // Validar mes semántico de startMonth
    this.validateMonthValue(dto.startMonth);

    // Localizar el fijo de origen
    const origin = await this.repo.findById(originId);
    if (!origin || origin.userId !== userId) {
      throw new NotFoundException('Movimiento fijo de origen no encontrado');
    }

    // Sin encadenamiento: el origen no puede ser a su vez un calculado (RF-MCALC-001)
    if (origin.sourceChainId !== null) {
      throw new BadRequestException(
        'Un movimiento calculado no puede ser origen de otro calculado',
      );
    }

    // Validar operando: DIV y PCT rechazan operando 0 (RN-017)
    validateFormulaOperand(dto.formulaOperator, dto.formulaOperand);

    // Validar categoría propia del calculado.
    // El type del calculado se deriva on-the-fly del signo del monto (RF-MCALC-003),
    // por lo que no hay un type fijo para validar scope. Se valida con BOTH para
    // aceptar cualquier categoría compatible (EXPENSE, INCOME o BOTH son todas válidas).
    await this.categoryValidator.validateCategory(userId, dto.categoryId, MovementType.EXPENSE, true);

    // Crear el calculado.
    // chainId: nuevo (el calculado es su propia cadena independiente).
    // sourceChainId: chainId del origen (vínculo estable a la cadena del origen).
    // type: EXPENSE como placeholder en DB (campo NOT NULL requerido por el schema).
    //   El type real se deriva on-the-fly del signo del monto en cada mes (RF-MCALC-003);
    //   este valor en DB nunca se usa para lógica de tipo en los calculados.
    // amountCents: 0 (campo requerido; el monto real se deriva on-the-fly).
    // frequency: hereda del origen (la presencia del calculado está gate-ada por el origen;
    //   el calculado "nativo" no tiene frecuencia propia — su frecuencia efectiva la determina el origen).
    // startMonth: el mes desde el que el frontend lo crea (mes visualizado en /mes).
    const calc = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: MovementType.EXPENSE, // placeholder en DB; el type real se deriva on-the-fly (RF-MCALC-003)
      amountCents: 0, // placeholder; el monto se deriva on-the-fly en GET /movements
      startMonth: dto.startMonth,
      frequency: origin.frequency, // hereda la frecuencia del origen (gating)
      description: dto.description ?? null,
      sourceChainId: origin.chainId,
      formulaOperator: dto.formulaOperator,
      formulaOperand: dto.formulaOperand,
      formulaSign: dto.formulaSign,
    });

    this.logger.log(
      {
        userId,
        calculatedId: calc.id,
        calculatedChainId: calc.chainId,
        sourceChainId: origin.chainId,
        originId,
        operator: dto.formulaOperator,
        sign: dto.formulaSign,
        startMonth: dto.startMonth,
      },
      'Movimiento calculado creado',
    );

    return calc;
  }

  // ---------------------------------------------------------------------------
  // PATCH /recurring/:id — editar fijo con lógica de split (RF-MF-003, D1)
  // ---------------------------------------------------------------------------

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringDto,
  ): Promise<RecurringWithCategory> {
    // Validar mes semántico de currentMonth
    this.validateMonthValue(dto.currentMonth);

    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento fijo no encontrado');
    }

    // PATCH /recurring/:id solo aplica a fijos NORMALES.
    // Si es un calculado, usar PATCH /recurring/:id/calculated.
    if (existing.sourceChainId !== null) {
      throw new BadRequestException(
        'Para editar un movimiento calculado use PATCH /recurring/:id/calculated',
      );
    }

    // Si cambia categoryId, revalidar scope contra el type vigente (que NO cambia — D1)
    if (dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(userId, dto.categoryId, existing.type);
    }

    // Lógica de split (D1):
    // Si currentMonth > R.startMonth → hay pasado: split
    // Si currentMonth <= R.startMonth → sin pasado: update in-place
    let result: RecurringWithCategory;

    if (dto.currentMonth > existing.startMonth) {
      // SPLIT: guardar pasado hasta currentMonth, crear nueva fila desde currentMonth
      // 1. Marcar la fila existente con deletedFrom = currentMonth (la "cierra" en el pasado)
      await this.repo.update(id, { deletedFrom: dto.currentMonth });

      // 2. Crear la nueva fila R2 con los valores nuevos (type NO cambia).
      // R2 hereda: type, frequency, deletedFrom, chainId, currency, exchangeRate del original.
      // currency y exchangeRate: el DTO puede sobreescribirlos para el mes editado.
      // chainId: R2 hereda el mismo chainId de R1 (invariante — el split no rompe la cadena).
      const effectiveExchangeRate = dto.exchangeRate ?? existing.exchangeRate;
      // anchorCurrency: si se actualiza la cotización, usar la default vigente; si no, heredar del original
      const effectiveAnchorCurrency = (dto.exchangeRate !== undefined || dto.currency !== undefined)
        ? (await this.settingsService.getSettings(userId)).defaultCurrency
        : existing.anchorCurrency;
      result = await this.repo.create({
        user: { connect: { id: userId } },
        category: { connect: { id: dto.categoryId ?? existing.categoryId } },
        type: existing.type, // type es inmutable (RF-MF-003)
        frequency: existing.frequency, // frequency es inmutable — hereda siempre
        amountCents: dto.amountCents ?? existing.amountCents,
        startMonth: dto.currentMonth,
        deletedFrom: existing.deletedFrom,
        chainId: existing.chainId, // CRÍTICO: preservar la identidad de cadena (Fase 1.1.7)
        currency: dto.currency ?? existing.currency, // heredar o sobreescribir
        exchangeRate: effectiveExchangeRate,
        anchorCurrency: effectiveAnchorCurrency,
        description: dto.description !== undefined
          ? dto.description
          : existing.description,
        // fijo normal: sourceChainId/formulaOperator/formulaOperand/formulaSign son null
      });

      await this.settingsService.updateLastExchangeRate(userId, effectiveExchangeRate);

      this.logger.log(
        {
          userId,
          originalId: id,
          newId: result.id,
          chainId: existing.chainId,
          currentMonth: dto.currentMonth,
          splitType: 'split',
        },
        'Movimiento fijo editado (split — preserva pasado)',
      );
    } else {
      // UPDATE IN-PLACE: currentMonth <= startMonth, no hay meses pasados
      let inPlaceAnchor: Currency | undefined = undefined;
      if (dto.exchangeRate !== undefined || dto.currency !== undefined) {
        const s = await this.settingsService.getSettings(userId);
        inPlaceAnchor = s.defaultCurrency;
      }

      result = await this.repo.update(id, {
        ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
        ...(dto.categoryId !== undefined && {
          category: { connect: { id: dto.categoryId } },
        }),
        // description: actualizar si se incluye en el body (puede ser null para limpiarla)
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.exchangeRate !== undefined && { exchangeRate: dto.exchangeRate }),
        ...(inPlaceAnchor !== undefined && { anchorCurrency: inPlaceAnchor }),
      });

      if (dto.exchangeRate !== undefined) {
        await this.settingsService.updateLastExchangeRate(userId, dto.exchangeRate);
      }

      this.logger.log(
        {
          userId,
          recurringId: id,
          chainId: existing.chainId,
          currentMonth: dto.currentMonth,
          splitType: 'in-place',
        },
        'Movimiento fijo editado (in-place)',
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // PATCH /recurring/:id/calculated — editar calculado (RF-MCALC-006)
  // ---------------------------------------------------------------------------

  /**
   * Edita un movimiento calculado.
   *
   * Sigue la misma mecánica de split del pasado que PATCH /recurring/:id (RF-MCALC-006).
   * Campos editables: type, categoryId, description, formulaOperator, formulaOperand, formulaSign.
   * NO editable: sourceChainId (el vínculo al origen es inmutable).
   *
   * En el split, R2 hereda: sourceChainId, frequency, deletedFrom, chainId del original
   * (igual que un fijo normal hereda sus campos invariantes).
   *
   * 400 si el id no corresponde a un calculado, o si operando=0 para DIV/PCT.
   * 404 si no existe o no es del usuario.
   */
  async updateCalculated(
    userId: string,
    id: string,
    dto: UpdateCalculatedRecurringDto,
  ): Promise<RecurringWithCategory> {
    // Validar mes semántico de currentMonth
    this.validateMonthValue(dto.currentMonth);

    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento calculado no encontrado');
    }

    // Verificar que es un calculado (sourceChainId != null)
    if (existing.sourceChainId === null) {
      throw new BadRequestException(
        'El movimiento no es un calculado. Para editar un fijo normal use PATCH /recurring/:id',
      );
    }

    // Determinar el operator y operand efectivos para validación de operando=0
    const effectiveOperator = dto.formulaOperator ?? existing.formulaOperator!;
    const effectiveOperand = dto.formulaOperand ?? existing.formulaOperand!;
    validateFormulaOperand(effectiveOperator, effectiveOperand);

    // Validar categoría si cambia.
    // El type del calculado se deriva on-the-fly (RF-MCALC-003), no hay un type fijo
    // para validar scope; se usa skipScopeCheck=true para aceptar cualquier categoría.
    if (dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(userId, dto.categoryId, MovementType.EXPENSE, true);
    }

    let result: RecurringWithCategory;

    if (dto.currentMonth > existing.startMonth) {
      // SPLIT: cerrar R1, crear R2
      await this.repo.update(id, { deletedFrom: dto.currentMonth });

      result = await this.repo.create({
        user: { connect: { id: userId } },
        category: { connect: { id: dto.categoryId ?? existing.categoryId } },
        type: MovementType.EXPENSE, // placeholder en DB; el type real se deriva on-the-fly (RF-MCALC-003)
        frequency: existing.frequency, // hereda del origen (inmutable)
        amountCents: 0, // placeholder para calculados
        startMonth: dto.currentMonth,
        deletedFrom: existing.deletedFrom,
        chainId: existing.chainId, // preservar identidad de cadena
        sourceChainId: existing.sourceChainId, // vínculo al origen: inmutable
        formulaOperator: dto.formulaOperator ?? existing.formulaOperator!,
        formulaOperand: dto.formulaOperand ?? existing.formulaOperand!,
        formulaSign: dto.formulaSign ?? existing.formulaSign!,
        description: dto.description !== undefined
          ? dto.description
          : existing.description,
      });

      this.logger.log(
        {
          userId,
          originalId: id,
          newId: result.id,
          chainId: existing.chainId,
          sourceChainId: existing.sourceChainId,
          currentMonth: dto.currentMonth,
          splitType: 'split',
        },
        'Movimiento calculado editado (split — preserva pasado)',
      );
    } else {
      // UPDATE IN-PLACE
      // type NO se actualiza (se deriva on-the-fly — RF-MCALC-003)
      result = await this.repo.update(id, {
        ...(dto.categoryId !== undefined && {
          category: { connect: { id: dto.categoryId } },
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.formulaOperator !== undefined && { formulaOperator: dto.formulaOperator }),
        ...(dto.formulaOperand !== undefined && { formulaOperand: dto.formulaOperand }),
        ...(dto.formulaSign !== undefined && { formulaSign: dto.formulaSign }),
      });

      this.logger.log(
        {
          userId,
          recurringId: id,
          chainId: existing.chainId,
          sourceChainId: existing.sourceChainId,
          currentMonth: dto.currentMonth,
          splitType: 'in-place',
        },
        'Movimiento calculado editado (in-place)',
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // POST /transactions/:id/calculated — crear calculado desde un único (Fase 1.1.7.ext)
  // ---------------------------------------------------------------------------

  /**
   * Crea un movimiento calculado derivado de un Transaction (movimiento único).
   *
   * El calculado aparece en UN solo mes: el mes del único (derivado de occurredAt + timezone).
   * Autolimitado con startMonth = mes del único, deletedFrom = nextMonth(startMonth).
   * La cascada de borrado la maneja la FK onDelete:Cascade del lado Recurring.
   *
   * Sin encadenamiento: el Transaction no puede ser a su vez un calculado (no aplica —
   * los Transactions nunca son calculados; la restricción here es solo para Recurrings).
   *
   * 404 si el Transaction no existe o no es del usuario.
   * 400 si operando=0 para DIV/PCT.
   * 400 si la categoría es inválida.
   */
  async createCalculatedFromTransaction(
    userId: string,
    transactionId: string,
    dto: CreateCalculatedFromTransactionDto,
  ): Promise<RecurringWithCategory> {
    // Localizar el Transaction de origen
    const tx = await this.repo.findTransactionById(transactionId);
    if (!tx || tx.userId !== userId) {
      throw new NotFoundException('Movimiento único de origen no encontrado');
    }

    // Validar operando: DIV y PCT rechazan operando 0 (RN-017)
    validateFormulaOperand(dto.formulaOperator, dto.formulaOperand);

    // Validar categoría con skipScopeCheck (tipo derivado on-the-fly — RF-MCALC-003)
    await this.categoryValidator.validateCategory(userId, dto.categoryId, MovementType.EXPENSE, true);

    // Derivar el mes del Transaction a partir de occurredAt + timezone
    const startMonth = this.occurrenceToMonth(tx.occurredAt, tx.timezone);
    const deletedFromMonth = this.nextMonth(startMonth);

    const calc = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: MovementType.EXPENSE, // placeholder en DB; type real se deriva on-the-fly
      amountCents: 0, // placeholder; monto real se deriva on-the-fly
      startMonth,
      deletedFrom: deletedFromMonth, // autolimitado a 1 mes
      frequency: RecurringFrequency.MONTHLY, // default; no se usa para el gating
      description: dto.description ?? null,
      sourceMovement: { connect: { id: tx.id } }, // FK a Transaction
      formulaOperator: dto.formulaOperator,
      formulaOperand: dto.formulaOperand,
      formulaSign: dto.formulaSign,
    });

    this.logger.log(
      {
        userId,
        calculatedId: calc.id,
        calculatedChainId: calc.chainId,
        sourceMovementId: tx.id,
        startMonth,
        deletedFrom: deletedFromMonth,
        operator: dto.formulaOperator,
        sign: dto.formulaSign,
      },
      'Movimiento calculado de único creado',
    );

    return calc;
  }

  // ---------------------------------------------------------------------------
  // PATCH /transactions/:id/calculated — editar calculado de único (Fase 1.1.7.ext)
  // ---------------------------------------------------------------------------

  /**
   * Edita un movimiento calculado derivado de un Transaction.
   *
   * El calculado de único edita in-place siempre (no hay split: su rango es 1 mes).
   * Campos editables: categoryId, description, formulaOperator, formulaOperand, formulaSign.
   * NO editable: sourceMovementId (el vínculo al origen es inmutable).
   *
   * 404 si el calculado no existe o no es del usuario.
   * 404 si el calculado no tiene sourceMovementId = transactionId (no pertenece a ese origen).
   * 400 si operando=0 para DIV/PCT.
   * 400 si la categoría es inválida.
   */
  async updateCalculatedFromTransaction(
    userId: string,
    transactionId: string,
    dto: UpdateCalculatedFromTransactionDto,
  ): Promise<RecurringWithCategory> {
    // Verificar que el Transaction de origen existe y es del usuario
    const tx = await this.repo.findTransactionById(transactionId);
    if (!tx || tx.userId !== userId) {
      throw new NotFoundException('Movimiento único de origen no encontrado');
    }

    // Buscar el calculado vinculado a este Transaction
    const existing = await this.repo.findCalculatedBySourceMovement(transactionId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento calculado no encontrado para este origen');
    }

    // Validar operando efectivo
    const effectiveOperator = dto.formulaOperator ?? existing.formulaOperator!;
    const effectiveOperand = dto.formulaOperand ?? existing.formulaOperand!;
    validateFormulaOperand(effectiveOperator, effectiveOperand);

    // Validar categoría si cambia
    if (dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(userId, dto.categoryId, MovementType.EXPENSE, true);
    }

    // Update in-place (sin split — calculado de único no tiene inmutabilidad del pasado)
    const result = await this.repo.update(existing.id, {
      ...(dto.categoryId !== undefined && {
        category: { connect: { id: dto.categoryId } },
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.formulaOperator !== undefined && { formulaOperator: dto.formulaOperator }),
      ...(dto.formulaOperand !== undefined && { formulaOperand: dto.formulaOperand }),
      ...(dto.formulaSign !== undefined && { formulaSign: dto.formulaSign }),
    });

    this.logger.log(
      {
        userId,
        calculatedId: existing.id,
        sourceMovementId: transactionId,
      },
      'Movimiento calculado de único actualizado',
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // POST /installments/:id/calculated — crear calculado desde cuota (Fase 1.1.7.ext)
  // ---------------------------------------------------------------------------

  /**
   * Crea un movimiento calculado derivado de un InstallmentGroup (grupo de cuotas).
   *
   * El calculado aparece en cada mes del grupo: startMonth = grupo.startMonth,
   * deletedFrom = null (el rango lo limita la proyección on-the-fly del grupo).
   * Deriva del monto POR CUOTA (amountCents del InstallmentGroup).
   * La cascada de borrado la maneja la FK onDelete:Cascade del lado Recurring.
   *
   * 404 si el InstallmentGroup no existe o no es del usuario.
   * 400 si operando=0 para DIV/PCT.
   * 400 si la categoría es inválida.
   */
  async createCalculatedFromInstallment(
    userId: string,
    installmentGroupId: string,
    dto: CreateCalculatedFromInstallmentDto,
  ): Promise<RecurringWithCategory> {
    // Localizar el InstallmentGroup de origen
    const group = await this.repo.findInstallmentGroupById(installmentGroupId);
    if (!group || group.userId !== userId) {
      throw new NotFoundException('Grupo de cuotas de origen no encontrado');
    }

    // Validar operando: DIV y PCT rechazan operando 0 (RN-017)
    validateFormulaOperand(dto.formulaOperator, dto.formulaOperand);

    // Validar categoría con skipScopeCheck (tipo derivado on-the-fly — RF-MCALC-003)
    await this.categoryValidator.validateCategory(userId, dto.categoryId, MovementType.EXPENSE, true);

    const calc = await this.repo.create({
      user: { connect: { id: userId } },
      category: { connect: { id: dto.categoryId } },
      type: MovementType.EXPENSE, // placeholder en DB; type real se deriva on-the-fly
      amountCents: 0, // placeholder; monto real se deriva on-the-fly
      startMonth: group.startMonth, // hereda el startMonth del grupo
      deletedFrom: null, // rango ilimitado: lo limita la proyección on-the-fly del grupo
      frequency: RecurringFrequency.MONTHLY, // default; no se usa para el gating
      description: dto.description ?? null,
      sourceInstallmentGroup: { connect: { id: group.id } }, // FK a InstallmentGroup
      formulaOperator: dto.formulaOperator,
      formulaOperand: dto.formulaOperand,
      formulaSign: dto.formulaSign,
    });

    this.logger.log(
      {
        userId,
        calculatedId: calc.id,
        calculatedChainId: calc.chainId,
        sourceInstallmentGroupId: group.id,
        startMonth: group.startMonth,
        operator: dto.formulaOperator,
        sign: dto.formulaSign,
      },
      'Movimiento calculado de cuota creado',
    );

    return calc;
  }

  // ---------------------------------------------------------------------------
  // PATCH /installments/:id/calculated — editar calculado de cuota (Fase 1.1.7.ext)
  // ---------------------------------------------------------------------------

  /**
   * Edita un movimiento calculado derivado de un InstallmentGroup.
   *
   * El calculado de cuota edita in-place siempre (no hay split: cuotas no tienen
   * inmutabilidad del pasado — ver PATCH /installments/:id).
   * Campos editables: categoryId, description, formulaOperator, formulaOperand, formulaSign.
   * NO editable: sourceInstallmentGroupId (el vínculo al origen es inmutable).
   *
   * 404 si el InstallmentGroup no existe o no es del usuario.
   * 404 si no existe calculado vinculado a ese origen.
   * 400 si operando=0 para DIV/PCT.
   * 400 si la categoría es inválida.
   */
  async updateCalculatedFromInstallment(
    userId: string,
    installmentGroupId: string,
    dto: UpdateCalculatedFromInstallmentDto,
  ): Promise<RecurringWithCategory> {
    // Verificar que el InstallmentGroup de origen existe y es del usuario
    const group = await this.repo.findInstallmentGroupById(installmentGroupId);
    if (!group || group.userId !== userId) {
      throw new NotFoundException('Grupo de cuotas de origen no encontrado');
    }

    // Buscar el calculado vinculado a este InstallmentGroup
    const existing = await this.repo.findCalculatedBySourceInstallment(installmentGroupId);
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento calculado no encontrado para este origen');
    }

    // Validar operando efectivo
    const effectiveOperator = dto.formulaOperator ?? existing.formulaOperator!;
    const effectiveOperand = dto.formulaOperand ?? existing.formulaOperand!;
    validateFormulaOperand(effectiveOperator, effectiveOperand);

    // Validar categoría si cambia
    if (dto.categoryId !== undefined) {
      await this.categoryValidator.validateCategory(userId, dto.categoryId, MovementType.EXPENSE, true);
    }

    // Update in-place (sin split)
    const result = await this.repo.update(existing.id, {
      ...(dto.categoryId !== undefined && {
        category: { connect: { id: dto.categoryId } },
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.formulaOperator !== undefined && { formulaOperator: dto.formulaOperator }),
      ...(dto.formulaOperand !== undefined && { formulaOperand: dto.formulaOperand }),
      ...(dto.formulaSign !== undefined && { formulaSign: dto.formulaSign }),
    });

    this.logger.log(
      {
        userId,
        calculatedId: existing.id,
        sourceInstallmentGroupId: installmentGroupId,
      },
      'Movimiento calculado de cuota actualizado',
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // DELETE /recurring/:id — soft-set deletedFrom o hard-delete (RF-MF-004, D2)
  // ---------------------------------------------------------------------------

  /**
   * Elimina (o marca para eliminar) un fijo o calculado.
   *
   * --- Calculado de único o cuota (sourceMovementId != null || sourceInstallmentGroupId != null) ---
   * Hard-delete total de la fila. El corte por boundary no aplica: un calculado de único
   * existe solo 1 mes y un calculado de cuota se borra como grupo completo, igual que
   * su origen. Los params currentMonth/fromCurrentMonth se aceptan pero se ignoran.
   *
   * --- Fijo normal y calculado de fijo (los demás casos) ---
   * Lógica (D2) — aplicada a TODA la cadena (chainId):
   * - boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)
   * - Para CADA fila de la cadena:
   *   - Si boundary <= fila.startMonth → hard delete de esa fila
   *   - Si boundary > fila.startMonth y la fila extiende más allá del boundary
   *     (deletedFrom IS NULL o deletedFrom > boundary) → set deletedFrom = boundary
   *   - Si la fila ya terminó antes del boundary → no tocar (pasado inmutable)
   *
   * La lógica opera sobre la cadena completa porque un fijo lógico es una cadena
   * de filas con el mismo chainId (splits de PATCH). Borrar solo la fila clickeada
   * deja filas R2+ huérfanas que siguen apareciendo en GET /movements.
   *
   * 404 si no existe o no es del usuario.
   *
   * Cascada a calculados de fijo (RF-MCALC-005):
   * Al eliminar un fijo de origen (no calculado), los calculados de fijo de su cadena
   * (sourceChainId == chainId del origen) siguen el mismo boundary con la misma
   * lógica por fila sobre toda la cadena del calculado.
   * Eliminar un calculado NO afecta al origen.
   */
  async remove(
    userId: string,
    id: string,
    currentMonth: string,
    fromCurrentMonth: boolean,
  ): Promise<void> {
    // Validar formato y semántica del mes (siempre, incluso para calculados de único/cuota)
    this.validateMonthFormat(currentMonth);
    this.validateMonthValue(currentMonth);

    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento fijo no encontrado');
    }

    // Calculado de único o de cuota: hard-delete total, sin lógica de boundary.
    // La decisión de producto es que se borran igual que su origen:
    // el único se borra de una, la cuota se borra como grupo entero.
    if (existing.sourceMovementId !== null || existing.sourceInstallmentGroupId !== null) {
      await this.repo.delete(existing.id);

      this.logger.log(
        {
          userId,
          recurringId: id,
          sourceMovementId: existing.sourceMovementId,
          sourceInstallmentGroupId: existing.sourceInstallmentGroupId,
        },
        'Calculado de único/cuota eliminado (hard-delete total, sin boundary)',
      );

      return;
    }

    const boundary = fromCurrentMonth
      ? currentMonth
      : this.nextMonth(currentMonth);

    // Aplicar la lógica de boundary a TODA la cadena (todas las filas con el mismo chainId)
    await this.applyBoundaryToChain(existing.chainId, boundary);

    this.logger.log(
      { userId, recurringId: id, chainId: existing.chainId, boundary },
      'Cadena de fijo eliminada/truncada (boundary aplicado a toda la cadena)',
    );

    // Cascada a calculados de fijo del origen (RF-MCALC-005).
    // Solo si es un fijo de origen (sourceChainId === null): eliminar un calculado no afecta al origen.
    if (existing.sourceChainId === null) {
      await this.cascadeDeleteCalculados(existing.chainId, boundary, userId);
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: aplicar boundary a toda una cadena (chainId) — fila por fila
  // ---------------------------------------------------------------------------

  /**
   * Aplica la lógica de boundary a TODAS las filas de una cadena (chainId).
   *
   * Por cada fila de la cadena:
   * - Si boundary <= fila.startMonth → hard delete de esa fila (nunca habría aparecido)
   * - Si boundary > fila.startMonth y la fila extiende más allá del boundary
   *   (deletedFrom IS NULL o deletedFrom > boundary) → set deletedFrom = boundary
   * - Si la fila ya terminó en o antes del boundary → no tocar (pasado inmutable)
   *
   * Esto garantiza que borrar "desde un mes temprano" elimine filas R2+ que
   * nacieron de splits posteriores al boundary.
   */
  private async applyBoundaryToChain(
    chainId: string,
    boundary: string,
  ): Promise<void> {
    const rows = await this.repo.findChainRows(chainId);

    for (const row of rows) {
      if (boundary <= row.startMonth) {
        // La fila no debería existir desde el boundary → hard delete
        await this.repo.delete(row.id);
      } else if (row.deletedFrom === null || row.deletedFrom > boundary) {
        // La fila está activa más allá del boundary → truncar
        await this.repo.update(row.id, { deletedFrom: boundary });
      }
      // Si row.deletedFrom <= boundary: la fila ya terminó en el pasado → no tocar
    }
  }

  // ---------------------------------------------------------------------------
  // Cascada de eliminación a calculados (RF-MCALC-005)
  // ---------------------------------------------------------------------------

  /**
   * Propaga la eliminación del origen a todos los calculados de esa cadena.
   *
   * Para cada cadena de calculado vinculada (sourceChainId = originChainId):
   * - Aplica la misma lógica de boundary fila por fila sobre la cadena del calculado.
   *
   * Esto garantiza que, si el origen fue eliminado desde un mes temprano (lo que
   * borra filas R2+ del origen), los calculados también pierdan sus filas R2+
   * correspondientes (o se truncan si el boundary cae en medio de una fila activa).
   *
   * RF-MCALC-005: eliminar el origen arrastra a sus calculados.
   * Eliminar un calculado NO llama a esta función (no afecta al origen).
   */
  private async cascadeDeleteCalculados(
    originChainId: string,
    boundary: string,
    userId: string,
  ): Promise<void> {
    // Encontrar todas las filas de calculados cuyo origen es esta cadena.
    // findCalculadosBySourceChain devuelve todas las filas (sourceChainId = originChainId),
    // incluyendo splits de calculados. Necesitamos los chainIds únicos de esas cadenas.
    const calcRows = await this.repo.findCalculadosBySourceChain(originChainId);

    if (calcRows.length === 0) return;

    // Recolectar los chainIds únicos de los calculados (para operar por cadena)
    const calcChainIds = new Set<string>();
    for (const row of calcRows) {
      // row ahora incluye chainId directamente (sin re-fetch)
      calcChainIds.add(row.chainId);
    }

    // Para cada cadena de calculado, aplicar el mismo boundary fila por fila
    for (const calcChainId of calcChainIds) {
      await this.applyBoundaryToChain(calcChainId, boundary);

      this.logger.log(
        { originChainId, calculadoChainId: calcChainId, boundary },
        'Calculado truncado/eliminado por cascada del origen',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // POST /recurring/:id/skip — toggle anular/des-anular (P1 — Fase 1.1.1)
  // ---------------------------------------------------------------------------

  /**
   * Toglea el skip de un fijo para un mes puntual (P1).
   *
   * - Si (fijo, mes) ya está skippeado → lo des-anula (borra el skip).
   * - Si no → lo anula (crea el skip).
   * Devuelve { skipped, month } con el estado resultante.
   *
   * 404 si el fijo no existe o no pertenece al usuario (RN-003).
   * 400 si el formato del mes es inválido.
   *
   * NOTA: no se valida que el mes sea una aparición válida según la frecuencia del fijo.
   * Esa validación semántica es responsabilidad del frontend (que ya tiene el ítem
   * del mes desde GET /movements). El backend solo valida formato y ownership.
   *
   * NOTA: el skip en el origen gatea automáticamente al calculado en la lectura
   * (el calculado aparece solo donde aparece el origen; si el origen está skippeado,
   * el calculado no aparece en ese mes — ver MovementsRepository.findFijosByMonth).
   */
  async toggleSkip(
    userId: string,
    id: string,
    month: string,
  ): Promise<SkipToggleResult> {
    // Validar formato y semántica del mes
    this.validateMonthFormat(month);
    this.validateMonthValue(month);

    const existing = await this.repo.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Movimiento fijo no encontrado');
    }

    const alreadySkipped = await this.repo.findSkip(id, month);

    if (alreadySkipped) {
      // Des-anular: eliminar el skip
      await this.repo.deleteSkip(id, month);

      this.logger.log(
        { userId, recurringId: id, month, action: 'unskip' },
        'Fijo des-anulado para el mes',
      );

      return { skipped: false, month };
    } else {
      // Anular: crear el skip
      await this.repo.createSkip(id, month);

      this.logger.log(
        { userId, recurringId: id, month, action: 'skip' },
        'Fijo anulado para el mes',
      );

      return { skipped: true, month };
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers de validación de mes
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Helper: derivar YYYY-MM a partir de un Date (UTC) y timezone IANA
  // ---------------------------------------------------------------------------

  /**
   * Convierte un instante UTC a la string YYYY-MM en la zona horaria dada.
   * Usa Intl.DateTimeFormat para obtener año y mes en la zona local del usuario.
   */
  private occurrenceToMonth(occurredAt: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
    });
    // Formato en-CA produce "YYYY-MM" (ISO-like)
    const parts = formatter.formatToParts(occurredAt);
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    return `${year}-${month}`;
  }

  /**
   * Valida que el string tenga formato YYYY-MM.
   */
  private validateMonthFormat(month: string): void {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'El mes debe tener formato YYYY-MM (ej: 2026-06)',
      );
    }
  }

  /**
   * Valida que el número de mes esté entre 01 y 12.
   */
  private validateMonthValue(month: string): void {
    const monthNum = parseInt(month.split('-')[1], 10);
    if (monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('El mes debe estar entre 01 y 12');
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: mes siguiente con rollover de año
  // ---------------------------------------------------------------------------

  nextMonth(month: string): string {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    let nextYear = year;
    let nextMonthNum = monthNum + 1;
    if (nextMonthNum > 12) {
      nextMonthNum = 1;
      nextYear = year + 1;
    }

    return `${nextYear}-${String(nextMonthNum).padStart(2, '0')}`;
  }
}
