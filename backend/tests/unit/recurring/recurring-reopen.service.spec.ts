/**
 * Tests unitarios de la reapertura de fijos terminados (RF-MF-008) en RecurringService.
 *
 * Cubre:
 * - elegibilidad: calculado, sin fin, ajeno/inexistente
 * - X < máx(currentMonth, endMonth) -> 400; X == endMonth (sin relleno); fin futuro; fin pasado
 * - relleno con frecuencia > 1 (solo apariciones según el ancla vieja) y X no alineado con la cadencia
 * - espejos: calculados con el mismo fin se reabren; los de otro fin quedan cerrados
 * - reemplazos obligatorios (categoría / método de pago / categoría de espejo) y rechazados si no hacen falta
 * - historial: una entrada REOPEN con snapshot (skips creados, filas nuevas, espejos)
 * - preview
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryScope, Currency, HistoryAction, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { RecurringService } from '../../../src/recurring/recurring.service';
import {
  RecurringRepository,
  RecurringWithCategory,
} from '../../../src/recurring/recurring.repository';
import { CategoryValidatorService } from '../../../src/categories/category-validator.service';
import { PaymentMethodValidatorService } from '../../../src/payment-methods/payment-method-validator.service';
import { SettingsService } from '../../../src/settings/settings.service';
import { HistoryService } from '../../../src/history/history.service';

const USER = 'user-a';
const CAT = 'cat-1';

const mockRepo = {
  findById: jest.fn(),
  findChainRows: jest.fn(),
  findCalculadosBySourceChain: jest.fn(),
  findCategoryDeletedMap: jest.fn(),
  findPaymentMethodDeletedMap: jest.fn(),
  findSkipsInRange: jest.fn(),
  applyReopen: jest.fn(),
};
const mockHistory = { record: jest.fn().mockResolvedValue('hist-1') };
const mockCategoryValidator = { validateCategory: jest.fn().mockResolvedValue(undefined) };
const mockPmValidator = {
  validatePaymentMethod: jest.fn().mockResolvedValue(undefined),
  resolveAutoDebit: jest.fn().mockResolvedValue(null),
};
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

function makeRec(o: Partial<RecurringWithCategory> = {}): RecurringWithCategory {
  return {
    id: 'rec-1',
    userId: USER,
    categoryId: CAT,
    type: MovementType.EXPENSE,
    amountCents: 5000,
    currency: Currency.ARS,
    exchangeRate: 1,
    anchorCurrency: Currency.ARS,
    description: 'Alquiler',
    startMonth: '2026-01',
    deletedFrom: '2026-12',
    frequency: 1,
    chainId: 'chain-1',
    sourceChainId: null,
    sourceMovementId: null,
    sourceInstallmentGroupId: null,
    formulaOperator: null,
    formulaOperand: null,
    formulaSign: null,
    sourceMonthOffset: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { id: CAT, name: 'Servicios', color: '#4F86C6', scope: CategoryScope.EXPENSE },
    paymentMethodId: null,
    paymentMethod: null,
    autoDebit: null,
    ...o,
  };
}

function makeCalc(o: Partial<RecurringWithCategory> = {}): RecurringWithCategory {
  return makeRec({
    id: 'calc-1',
    chainId: 'calc-chain-1',
    sourceChainId: 'chain-1',
    formulaOperator: 'PCT' as never,
    formulaOperand: 1000,
    formulaSign: 1,
    amountCents: 0,
    description: 'IVA',
    ...o,
  });
}

const BODY = { currentMonth: '2026-11', reopenMonth: '2026-12', amountCents: 9000 };

/** Wirea el repo para un origen `origin` (vigente) y calculados `calcs` (una fila vigente por cadena). */
function wire(origin: RecurringWithCategory, calcs: RecurringWithCategory[] = []) {
  const all = [origin, ...calcs];
  mockRepo.findById.mockImplementation(async (id: string) => all.find((r) => r.id === id) ?? null);
  mockRepo.findChainRows.mockResolvedValue([
    { id: origin.id, startMonth: origin.startMonth, deletedFrom: origin.deletedFrom },
  ]);
  mockRepo.findCalculadosBySourceChain.mockResolvedValue(
    calcs.map((c) => ({ id: c.id, chainId: c.chainId, startMonth: c.startMonth, deletedFrom: c.deletedFrom })),
  );
  mockRepo.applyReopen.mockImplementation(async (chains: unknown[]) =>
    chains.map((_, i) => `new-${i}`),
  );
}

describe('RecurringService — reopen (RF-MF-008)', () => {
  let service: RecurringService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.findCategoryDeletedMap.mockResolvedValue(new Map());
    mockRepo.findPaymentMethodDeletedMap.mockResolvedValue(new Map());
    mockRepo.findSkipsInRange.mockResolvedValue([]);
    mockHistory.record.mockResolvedValue('hist-1');
    mockCategoryValidator.validateCategory.mockResolvedValue(undefined);
    mockPmValidator.resolveAutoDebit.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: RecurringRepository, useValue: mockRepo },
        { provide: CategoryValidatorService, useValue: mockCategoryValidator },
        { provide: PaymentMethodValidatorService, useValue: mockPmValidator },
        { provide: Logger, useValue: mockLogger },
        {
          provide: SettingsService,
          useValue: { getSettings: jest.fn(), updateLastExchangeRate: jest.fn() },
        },
        { provide: HistoryService, useValue: mockHistory },
      ],
    }).compile();
    service = module.get(RecurringService);
  });

  describe('elegibilidad', () => {
    it('404 si no existe o es de otro usuario', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.reopen(USER, 'x', BODY)).rejects.toThrow(NotFoundException);
      mockRepo.findById.mockResolvedValue(makeRec({ userId: 'otro' }));
      await expect(service.reopen(USER, 'rec-1', BODY)).rejects.toThrow(NotFoundException);
      expect(mockRepo.applyReopen).not.toHaveBeenCalled();
    });

    it('400 si es un calculado (de fijo)', async () => {
      wire(makeRec());
      mockRepo.findById.mockResolvedValue(makeCalc());
      await expect(service.reopen(USER, 'calc-1', BODY)).rejects.toThrow(BadRequestException);
    });

    it('400 si la fila vigente no tiene fin', async () => {
      wire(makeRec({ deletedFrom: null }));
      await expect(service.reopen(USER, 'rec-1', BODY)).rejects.toThrow(/no tiene fin/);
    });

    it('opera sobre la fila VIGENTE de la cadena aunque el id sea de una fila vieja', async () => {
      const old = makeRec({ id: 'rec-old', startMonth: '2025-01', deletedFrom: '2026-03' });
      const vigente = makeRec({ id: 'rec-new', startMonth: '2026-03', deletedFrom: '2026-12' });
      mockRepo.findById.mockImplementation(async (id: string) => (id === 'rec-old' ? old : vigente));
      mockRepo.findChainRows.mockResolvedValue([
        { id: 'rec-old', startMonth: '2025-01', deletedFrom: '2026-03' },
        { id: 'rec-new', startMonth: '2026-03', deletedFrom: '2026-12' },
      ]);
      mockRepo.findCalculadosBySourceChain.mockResolvedValue([]);
      mockRepo.applyReopen.mockResolvedValue(['n0']);

      await service.reopen(USER, 'rec-old', BODY);
      expect(mockRepo.applyReopen.mock.calls[0][0][0].closeRowId).toBe('rec-new');
    });
  });

  describe('validación de X y monto', () => {
    it('400 si X es anterior al mes en curso', async () => {
      wire(makeRec({ deletedFrom: '2026-05' })); // fin pasado
      await expect(
        service.reopen(USER, 'rec-1', { ...BODY, reopenMonth: '2026-10' }),
      ).rejects.toThrow(/no puede ser anterior a 2026-11/);
    });

    it('400 si X es anterior al endMonth (fin futuro)', async () => {
      wire(makeRec({ deletedFrom: '2027-03' }));
      await expect(
        service.reopen(USER, 'rec-1', { ...BODY, reopenMonth: '2027-02' }),
      ).rejects.toThrow(/no puede ser anterior a 2027-03/);
    });

    it('400 si X supera el año 2200 o el formato/mes es inválido', async () => {
      wire(makeRec());
      await expect(
        service.reopen(USER, 'rec-1', { ...BODY, reopenMonth: '2201-01' }),
      ).rejects.toThrow(/2200/);
      await expect(
        service.reopen(USER, 'rec-1', { ...BODY, reopenMonth: '2027-13' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('mecánica y relleno', () => {
    it('fin futuro con X == endMonth: sin relleno, cierra V en X y crea N sin fin con el monto nuevo', async () => {
      wire(makeRec({ deletedFrom: '2027-03' }));
      const res = await service.reopen(USER, 'rec-1', {
        currentMonth: '2026-11',
        reopenMonth: '2027-03',
        amountCents: 7777,
      });

      const [chains] = mockRepo.applyReopen.mock.calls[0];
      expect(chains).toHaveLength(1);
      expect(chains[0].closeRowId).toBe('rec-1');
      expect(chains[0].closeDeletedFrom).toBe('2027-03');
      expect(chains[0].skips).toEqual([]);
      expect(chains[0].newRow).toMatchObject({
        startMonth: '2027-03',
        deletedFrom: null,
        amountCents: 7777,
        chainId: 'chain-1',
        frequency: 1,
        type: MovementType.EXPENSE,
        description: 'Alquiler',
      });
      expect(res).toMatchObject({
        id: 'new-0',
        chainId: 'chain-1',
        previousEndMonth: '2027-03',
        reopenMonth: '2027-03',
        skippedCount: 0,
        reopenedCalculatedChainIds: [],
        historyEntryId: 'hist-1',
      });
    });

    it('fin pasado, frecuencia 1: cada mes de [endMonth, X) queda anulado sobre la fila vieja', async () => {
      wire(makeRec({ deletedFrom: '2026-08' }));
      const res = await service.reopen(USER, 'rec-1', {
        currentMonth: '2026-11',
        reopenMonth: '2026-11',
        amountCents: 100,
      });
      expect(mockRepo.applyReopen.mock.calls[0][0][0].skips).toEqual([
        { recurringId: 'rec-1', month: '2026-08' },
        { recurringId: 'rec-1', month: '2026-09' },
        { recurringId: 'rec-1', month: '2026-10' },
      ]);
      expect(res.skippedCount).toBe(3);
    });

    it('frecuencia 3: solo se anulan las apariciones según el ancla VIEJA; X no necesita alinearse con ella', async () => {
      // ancla 2026-01, cada 3: ene, abr, jul, oct, ene...
      wire(makeRec({ startMonth: '2026-01', frequency: 3, deletedFrom: '2026-07' }));
      const res = await service.reopen(USER, 'rec-1', {
        currentMonth: '2026-11',
        reopenMonth: '2027-02', // X = feb: NO es aparición según el ancla vieja
        amountCents: 100,
      });
      const chain = mockRepo.applyReopen.mock.calls[0][0][0];
      expect(chain.skips.map((s: { month: string }) => s.month)).toEqual(['2026-07', '2026-10', '2027-01']);
      // N re-ancla en X conservando la frecuencia
      expect(chain.newRow).toMatchObject({ startMonth: '2027-02', frequency: 3 });
      expect(res.skippedCount).toBe(3);
    });

    it('no duplica anulaciones preexistentes y no las lista en el snapshot (no se borrarán al deshacer)', async () => {
      wire(makeRec({ deletedFrom: '2026-09' }));
      mockRepo.findSkipsInRange.mockResolvedValue([{ recurringId: 'rec-1', month: '2026-09' }]);
      await service.reopen(USER, 'rec-1', { currentMonth: '2026-11', reopenMonth: '2026-11', amountCents: 1 });
      expect(mockRepo.applyReopen.mock.calls[0][0][0].skips).toEqual([{ recurringId: 'rec-1', month: '2026-10' }]);
    });

    it('hereda moneda/método/autoDebit del fijo (solo cambia el monto)', async () => {
      wire(
        makeRec({
          currency: Currency.USD,
          exchangeRate: 1200,
          anchorCurrency: Currency.ARS,
          paymentMethodId: 'pm-1',
          paymentMethod: { id: 'pm-1', name: 'Débito', icon: 'x', type: 'DEBIT' },
          autoDebit: true,
        }),
      );
      mockPmValidator.resolveAutoDebit.mockResolvedValue(true);
      await service.reopen(USER, 'rec-1', BODY);
      const row = mockRepo.applyReopen.mock.calls[0][0][0].newRow;
      expect(row).toMatchObject({ currency: Currency.USD, exchangeRate: 1200, autoDebit: true });
      expect(row.paymentMethod).toEqual({ connect: { id: 'pm-1' } });
      expect(mockPmValidator.resolveAutoDebit).toHaveBeenCalledWith('pm-1', true);
    });
  });

  describe('calculados en espejo', () => {
    it('reabre los calculados con el mismo endMonth; los de otro fin quedan cerrados', async () => {
      const origin = makeRec({ deletedFrom: '2026-09' });
      const mirror = makeCalc({ deletedFrom: '2026-09' });
      const other = makeCalc({ id: 'calc-2', chainId: 'calc-chain-2', deletedFrom: '2026-07' });
      wire(origin, [mirror, other]);

      const res = await service.reopen(USER, 'rec-1', { currentMonth: '2026-11', reopenMonth: '2026-11', amountCents: 50 });

      const chains = mockRepo.applyReopen.mock.calls[0][0];
      expect(chains).toHaveLength(2);
      const m = chains[1];
      expect(m.closeRowId).toBe('calc-1');
      expect(m.closeDeletedFrom).toBe('2026-11');
      // su propio relleno anulado (mismas apariciones que el origen, sobre su fila)
      expect(m.skips).toEqual([
        { recurringId: 'calc-1', month: '2026-09' },
        { recurringId: 'calc-1', month: '2026-10' },
      ]);
      expect(m.newRow).toMatchObject({
        startMonth: '2026-11',
        deletedFrom: null,
        chainId: 'calc-chain-1',
        sourceChainId: 'chain-1',
        formulaOperator: 'PCT',
        formulaOperand: 1000,
        formulaSign: 1,
        amountCents: 0,
      });
      expect(res.reopenedCalculatedChainIds).toEqual(['calc-chain-1']);
    });

    it('espejo con categoría dada de baja: exige reemplazo en calculatedCategories', async () => {
      wire(makeRec(), [makeCalc({ categoryId: 'cat-dead' })]);
      mockRepo.findCategoryDeletedMap.mockResolvedValue(new Map([[CAT, false], ['cat-dead', true]]));

      await expect(service.reopen(USER, 'rec-1', BODY)).rejects.toThrow(/calculado calc-chain-1/);

      await service.reopen(USER, 'rec-1', {
        ...BODY,
        calculatedCategories: [{ chainId: 'calc-chain-1', categoryId: 'cat-new' }],
      });
      // valida la categoría del reemplazo sin chequeo de scope (tipo derivado)
      expect(mockCategoryValidator.validateCategory).toHaveBeenCalledWith(USER, 'cat-new', MovementType.EXPENSE, true);
      expect(mockRepo.applyReopen.mock.calls[0][0][1].newRow.category).toEqual({ connect: { id: 'cat-new' } });
    });

    it('400 si calculatedCategories trae un calculado que no se reabre / no lo necesita, o repetido', async () => {
      wire(makeRec(), [makeCalc()]);
      await expect(
        service.reopen(USER, 'rec-1', { ...BODY, calculatedCategories: [{ chainId: 'calc-chain-1', categoryId: 'c' }] }),
      ).rejects.toThrow(/no lleva reemplazo/);
      await expect(
        service.reopen(USER, 'rec-1', { ...BODY, calculatedCategories: [{ chainId: 'inexistente', categoryId: 'c' }] }),
      ).rejects.toThrow(/no lleva reemplazo/);
      mockRepo.findCategoryDeletedMap.mockResolvedValue(new Map([['cat-1', true]]));
      await expect(
        service.reopen(USER, 'rec-1', {
          ...BODY,
          categoryId: 'x',
          calculatedCategories: [
            { chainId: 'calc-chain-1', categoryId: 'a' },
            { chainId: 'calc-chain-1', categoryId: 'b' },
          ],
        }),
      ).rejects.toThrow(/repite/);
    });
  });

  describe('reemplazos obligatorios del fijo', () => {
    it('categoría de baja: obligatoria y validada con scope; sin ella 400', async () => {
      wire(makeRec());
      mockRepo.findCategoryDeletedMap.mockResolvedValue(new Map([[CAT, true]]));
      await expect(service.reopen(USER, 'rec-1', BODY)).rejects.toThrow(/categoría del fijo está eliminada/);
      expect(mockRepo.applyReopen).not.toHaveBeenCalled();

      await service.reopen(USER, 'rec-1', { ...BODY, categoryId: 'cat-new' });
      expect(mockCategoryValidator.validateCategory).toHaveBeenCalledWith(USER, 'cat-new', MovementType.EXPENSE);
      expect(mockRepo.applyReopen.mock.calls[0][0][0].newRow.category).toEqual({ connect: { id: 'cat-new' } });
    });

    it('categoría de reemplazo inválida -> el error del validador (400) corta la reapertura', async () => {
      wire(makeRec());
      mockRepo.findCategoryDeletedMap.mockResolvedValue(new Map([[CAT, true]]));
      mockCategoryValidator.validateCategory.mockRejectedValue(new BadRequestException('inválida'));
      await expect(service.reopen(USER, 'rec-1', { ...BODY, categoryId: 'x' })).rejects.toThrow('inválida');
      expect(mockRepo.applyReopen).not.toHaveBeenCalled();
    });

    it('categoría activa + categoryId en el body -> 400 (no se puede cambiar)', async () => {
      wire(makeRec());
      await expect(service.reopen(USER, 'rec-1', { ...BODY, categoryId: 'otra' })).rejects.toThrow(/no se puede cambiar/);
    });

    it('método de pago de baja: obligatorio, validado, y reemplaza al heredado', async () => {
      wire(makeRec({ paymentMethodId: 'pm-dead', paymentMethod: { id: 'pm-dead', name: 'Vieja', icon: 'x', type: 'CREDIT' } }));
      mockRepo.findPaymentMethodDeletedMap.mockResolvedValue(new Map([['pm-dead', true]]));
      await expect(service.reopen(USER, 'rec-1', BODY)).rejects.toThrow(/método de pago del fijo está eliminado/);

      await service.reopen(USER, 'rec-1', { ...BODY, paymentMethodId: 'pm-new' });
      expect(mockPmValidator.validatePaymentMethod).toHaveBeenCalledWith(USER, 'pm-new');
      expect(mockRepo.applyReopen.mock.calls[0][0][0].newRow.paymentMethod).toEqual({ connect: { id: 'pm-new' } });
    });

    it('método de pago de baja + paymentMethodId null ("sin método"): válido, sin validar, historial método -> null', async () => {
      wire(makeRec({ paymentMethodId: 'pm-dead', paymentMethod: { id: 'pm-dead', name: 'Vieja', icon: 'x', type: 'CREDIT' } }));
      mockRepo.findPaymentMethodDeletedMap.mockResolvedValue(new Map([['pm-dead', true]]));
      await service.reopen(USER, 'rec-1', { ...BODY, paymentMethodId: null });
      expect(mockPmValidator.validatePaymentMethod).not.toHaveBeenCalled();
      expect(mockPmValidator.resolveAutoDebit).toHaveBeenCalledWith(null, null);
      const newRow = mockRepo.applyReopen.mock.calls[0][0][0].newRow;
      expect(newRow.paymentMethod).toBeUndefined();
      expect(mockHistory.record.mock.calls[0][4]).toMatchObject({ next: { paymentMethodId: null } });
    });

    it('método activo + paymentMethodId null -> 400 (no se puede cambiar)', async () => {
      wire(makeRec({ paymentMethodId: 'pm-ok' }));
      mockRepo.findPaymentMethodDeletedMap.mockResolvedValue(new Map([['pm-ok', false]]));
      await expect(service.reopen(USER, 'rec-1', { ...BODY, paymentMethodId: null })).rejects.toThrow(
        /no se puede cambiar/,
      );
    });

    it('método activo (o sin método) + paymentMethodId en el body -> 400', async () => {
      wire(makeRec());
      await expect(service.reopen(USER, 'rec-1', { ...BODY, paymentMethodId: 'pm-x' })).rejects.toThrow(
        /no se puede cambiar/,
      );
    });
  });

  describe('historial', () => {
    it('registra UNA entrada REOPEN (targetId = chainId del origen) con skips, filas nuevas y espejos', async () => {
      wire(makeRec({ deletedFrom: '2026-10' }), [makeCalc({ deletedFrom: '2026-10' })]);
      await service.reopen(USER, 'rec-1', { currentMonth: '2026-11', reopenMonth: '2026-11', amountCents: 123 });

      expect(mockHistory.record).toHaveBeenCalledTimes(1);
      const [userId, kind, targetId, action, snap] = mockHistory.record.mock.calls[0];
      expect(userId).toBe(USER);
      expect(kind).toBe('FIJO');
      expect(targetId).toBe('chain-1');
      expect(action).toBe(HistoryAction.REOPEN);
      expect(snap).toMatchObject({
        kind: 'reopen',
        reopenMonth: '2026-11',
        newRowId: 'new-0',
        row: { id: 'rec-1', deletedFrom: '2026-10' },
        skips: [{ recurringId: 'rec-1', month: '2026-10' }],
        next: { amountCents: 123, categoryId: CAT, paymentMethodId: null },
        mirrors: [
          {
            newRowId: 'new-1',
            row: { id: 'calc-1', deletedFrom: '2026-10' },
            skips: [{ recurringId: 'calc-1', month: '2026-10' }],
          },
        ],
      });
    });
  });

  describe('getReopenPreview', () => {
    it('devuelve piso de X, último monto, y reemplazos requeridos (fijo y espejos)', async () => {
      wire(
        makeRec({ deletedFrom: '2027-03', amountCents: 4200 }),
        [makeCalc({ deletedFrom: '2027-03', categoryId: 'cat-dead' })],
      );
      mockRepo.findCategoryDeletedMap.mockResolvedValue(new Map([[CAT, false], ['cat-dead', true]]));

      const p = await service.getReopenPreview(USER, 'rec-1', '2026-11');
      expect(p).toMatchObject({
        chainId: 'chain-1',
        endMonth: '2027-03',
        minReopenMonth: '2027-03',
        amountCents: 4200,
        requiresCategory: false,
        requiresPaymentMethod: false,
        paymentMethod: null,
      });
      expect(p.mirrors).toEqual([
        expect.objectContaining({ chainId: 'calc-chain-1', requiresCategory: true }),
      ]);
    });

    it('minReopenMonth = mes en curso cuando el fin ya pasó', async () => {
      wire(makeRec({ deletedFrom: '2026-05' }));
      const p = await service.getReopenPreview(USER, 'rec-1', '2026-11');
      expect(p.minReopenMonth).toBe('2026-11');
    });

    it('400 si no es reabrible; 404 si no existe', async () => {
      wire(makeRec({ deletedFrom: null }));
      await expect(service.getReopenPreview(USER, 'rec-1', '2026-11')).rejects.toThrow(BadRequestException);
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.getReopenPreview(USER, 'rec-1', '2026-11')).rejects.toThrow(NotFoundException);
    });
  });
});
