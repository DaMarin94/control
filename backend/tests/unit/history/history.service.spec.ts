/**
 * Tests unitarios de HistoryService (Módulo 3.14 — RF-HIST-001..006).
 *
 * Cubre:
 * - record(): inserta la entrada y aplica el tope de retención (5 por movimiento,
 *   RF-HIST-005) — al superarlo, descarta la más antigua de ESE movimiento.
 * - record(): descartar una entrada de eliminación reapea físicamente el
 *   registro subyacente si sigue soft-deleted (reaper — RF-HIST-005/RF-HIST-006).
 * - findAllForUser(): purga lazy de entradas vencidas (> 31 días) antes de listar.
 * - undo(): LIFO — deshacer una entrada bloqueada deshace también las posteriores
 *   del mismo movimiento, de la más reciente a la más antigua, en una sola
 *   transacción (RF-HIST-003/004).
 */
import { HistoryAction, HistoryTargetKind } from '@prisma/client';
import { HistoryService } from '../../../src/history/history.service';
import { HistoryRepository, HistoryEntryRow, MAX_ENTRIES_PER_MOVEMENT } from '../../../src/history/history.repository';
import {
  CuotaSnapshot,
  FijoDeleteSnapshot,
  FijoEditSnapshot,
  RecurringRowSnapshot,
  UnicoSnapshot,
} from '../../../src/history/history.types';

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

function makeRepoMock(): jest.Mocked<HistoryRepository> {
  return {
    create: jest.fn(),
    findAllForUserAsc: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findChainAsc: jest.fn().mockResolvedValue([]),
    findExpiredForUser: jest.fn().mockResolvedValue([]),
    findOverflowIds: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteMany: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<HistoryRepository>;
}

function makeTxMock() {
  const historyEntryDelete = jest.fn().mockResolvedValue(undefined);
  const tx = {
    transaction: { update: jest.fn().mockResolvedValue(undefined) },
    recurring: { update: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) },
    installmentGroup: { update: jest.fn().mockResolvedValue(undefined) },
    historyEntry: { delete: historyEntryDelete },
  };
  return tx;
}

function makePrismaMock() {
  const tx = makeTxMock();
  return {
    __tx: tx,
    $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb(tx);
    }),
    // Moneda default VIGENTE del usuario (getUserDefaultCurrency) — ARS por
    // default en los tests; se sobreescribe puntualmente donde el caso lo pide.
    user: {
      findUnique: jest.fn().mockResolvedValue({ defaultCurrency: 'ARS' }),
    },
    transaction: {
      findUnique: jest.fn().mockResolvedValue(null),
      // Usado por loadOriginCurrencyMaps (resolución de moneda de origen de un
      // calculado-de-único) — default vacío: un id no encontrado en el mock
      // simula un origen irresoluble (chain/movimiento purgado físicamente).
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
    recurring: {
      findUnique: jest.fn().mockResolvedValue(null),
      // Usado por loadOriginCurrencyMaps (resolución de moneda de origen de un
      // calculado-de-fijo, vía sourceChainId).
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
    installmentGroup: {
      findUnique: jest.fn().mockResolvedValue(null),
      // Usado por loadOriginCurrencyMaps (resolución de moneda de origen de un
      // calculado-de-cuota, vía sourceInstallmentGroupId).
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
    category: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    paymentMethod: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

const USER_ID = 'user-hist-1';
const TX_ID = 'tx-hist-1';

function makeUnicoSnapshot(overrides: Partial<UnicoSnapshot> = {}): UnicoSnapshot {
  return {
    type: 'EXPENSE' as never,
    amountCents: 1000,
    categoryId: 'cat-1',
    description: null,
    occurredAt: new Date('2026-05-01T12:00:00Z').toISOString(),
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS' as never,
    exchangeRate: 1,
    anchorCurrency: 'ARS' as never,
    paymentMethodId: null,
    autoDebit: null,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<HistoryEntryRow> = {}): HistoryEntryRow {
  return {
    id: 'hist-1',
    userId: USER_ID,
    targetKind: HistoryTargetKind.UNICO,
    targetId: TX_ID,
    action: HistoryAction.EDIT,
    snapshot: makeUnicoSnapshot(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('HistoryService', () => {
  let repo: jest.Mocked<HistoryRepository>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: HistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepoMock();
    prisma = makePrismaMock();
    service = new HistoryService(repo, prisma as never, mockLogger as never);
  });

  // -------------------------------------------------------------------------
  // record() — tope de retención por cantidad (RF-HIST-005)
  // -------------------------------------------------------------------------

  describe('record — tope de 5 por movimiento', () => {
    it('inserta la entrada nueva', async () => {
      repo.findOverflowIds.mockResolvedValue([]);

      await service.record(USER_ID, HistoryTargetKind.UNICO, TX_ID, HistoryAction.EDIT, makeUnicoSnapshot());

      expect(repo.create).toHaveBeenCalledWith(
        USER_ID,
        HistoryTargetKind.UNICO,
        TX_ID,
        HistoryAction.EDIT,
        expect.any(Object),
      );
      expect(repo.findOverflowIds).toHaveBeenCalledWith(USER_ID, HistoryTargetKind.UNICO, TX_ID, MAX_ENTRIES_PER_MOVEMENT);
    });

    it('al superar el tope, descarta la entrada más antigua de ESE movimiento (EDIT: sin reap físico)', async () => {
      const oldest = makeEntry({ id: 'hist-oldest', action: HistoryAction.EDIT });
      repo.findOverflowIds.mockResolvedValue(['hist-oldest']);
      repo.findById.mockResolvedValue(oldest);

      await service.record(USER_ID, HistoryTargetKind.UNICO, TX_ID, HistoryAction.EDIT, makeUnicoSnapshot());

      expect(repo.findById).toHaveBeenCalledWith('hist-oldest');
      expect(repo.delete).toHaveBeenCalledWith('hist-oldest');
      // Una entrada de EDIT descartada nunca reapea nada (nunca deja filas soft-deleted).
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
    });

    it('al superar el tope con una entrada de DELETE vigente, reapea físicamente el registro (RF-HIST-005)', async () => {
      const oldestDelete = makeEntry({
        id: 'hist-oldest-del',
        action: HistoryAction.DELETE,
        snapshot: makeUnicoSnapshot(),
      });
      repo.findOverflowIds.mockResolvedValue(['hist-oldest-del']);
      repo.findById.mockResolvedValue(oldestDelete);
      prisma.transaction.findUnique.mockResolvedValue({ deletedAt: new Date() });

      await service.record(USER_ID, HistoryTargetKind.UNICO, TX_ID, HistoryAction.EDIT, makeUnicoSnapshot());

      expect(prisma.transaction.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TX_ID } }),
      );
      expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: TX_ID } });
      expect(repo.delete).toHaveBeenCalledWith('hist-oldest-del');
    });

    it('NO reapea si el registro ya no está soft-deleted (defensivo)', async () => {
      const oldestDelete = makeEntry({ id: 'hist-oldest-del', action: HistoryAction.DELETE });
      repo.findOverflowIds.mockResolvedValue(['hist-oldest-del']);
      repo.findById.mockResolvedValue(oldestDelete);
      prisma.transaction.findUnique.mockResolvedValue({ deletedAt: null });

      await service.record(USER_ID, HistoryTargetKind.UNICO, TX_ID, HistoryAction.EDIT, makeUnicoSnapshot());

      expect(prisma.transaction.delete).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith('hist-oldest-del');
    });
  });

  // -------------------------------------------------------------------------
  // findAllForUser() — purga lazy de vencidas (RF-HIST-005)
  // -------------------------------------------------------------------------

  describe('findAllForUser — purga lazy de entradas vencidas', () => {
    it('descarta entradas vencidas antes de listar (EDIT: sin reap)', async () => {
      const expired = makeEntry({ id: 'hist-expired', action: HistoryAction.EDIT });
      repo.findExpiredForUser.mockResolvedValue([expired]);
      repo.findAllForUserAsc.mockResolvedValue([]);

      const result = await service.findAllForUser(USER_ID);

      expect(repo.delete).toHaveBeenCalledWith('hist-expired');
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('al vencer una entrada de eliminación, reapea físicamente el registro subyacente', async () => {
      const expiredDelete = makeEntry({ id: 'hist-expired-del', action: HistoryAction.DELETE });
      repo.findExpiredForUser.mockResolvedValue([expiredDelete]);
      repo.findAllForUserAsc.mockResolvedValue([]);
      prisma.transaction.findUnique.mockResolvedValue({ deletedAt: new Date() });

      await service.findAllForUser(USER_ID);

      expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: TX_ID } });
      expect(repo.delete).toHaveBeenCalledWith('hist-expired-del');
    });
  });

  // -------------------------------------------------------------------------
  // undo() — LIFO por movimiento, atómico (RF-HIST-003/004)
  // -------------------------------------------------------------------------

  describe('undo — LIFO por movimiento', () => {
    it('deshace la entrada más reciente sola (N=0 posteriores)', async () => {
      const e1 = makeEntry({ id: 'e1', createdAt: new Date('2026-01-01T00:00:00Z') });
      repo.findById.mockResolvedValue(e1);
      repo.findChainAsc.mockResolvedValue([e1]);

      await service.undo(USER_ID, 'e1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.__tx.transaction.update).toHaveBeenCalledTimes(1);
      expect(prisma.__tx.historyEntry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    it('deshacer una entrada bloqueada deshace también las posteriores, de la más reciente a la más antigua, en una sola transacción', async () => {
      const e1 = makeEntry({ id: 'e1', createdAt: new Date('2026-01-01T00:00:00Z') });
      const e2 = makeEntry({ id: 'e2', createdAt: new Date('2026-01-02T00:00:00Z') });
      const e3 = makeEntry({ id: 'e3', createdAt: new Date('2026-01-03T00:00:00Z') });
      repo.findById.mockResolvedValue(e1); // se pide deshacer la más antigua (bloqueada)
      repo.findChainAsc.mockResolvedValue([e1, e2, e3]);

      const callOrder: string[] = [];
      prisma.__tx.historyEntry.delete.mockImplementation(async (args: { where: { id: string } }) => {
        callOrder.push(args.where.id);
      });

      await service.undo(USER_ID, 'e1');

      // Atómico: una sola transacción de DB para las 3 restauraciones.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Orden: de la más reciente (e3) a la más antigua (e1) — RF-HIST-004.
      expect(callOrder).toEqual(['e3', 'e2', 'e1']);
      // Las 3 entradas se restauran (3 updates sobre el único) y se borran del historial.
      expect(prisma.__tx.transaction.update).toHaveBeenCalledTimes(3);
      expect(prisma.__tx.historyEntry.delete).toHaveBeenCalledTimes(3);
    });

    it('404 si la entrada no existe o no es del usuario', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.undo(USER_ID, 'no-existe')).rejects.toThrow();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('404 si la entrada pertenece a otro usuario (RN-003)', async () => {
      repo.findById.mockResolvedValue(makeEntry({ userId: 'otro-user' }));

      await expect(service.undo(USER_ID, 'hist-1')).rejects.toThrow();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('un undo no genera ninguna entrada de historial nueva', async () => {
      const e1 = makeEntry({ id: 'e1' });
      repo.findById.mockResolvedValue(e1);
      repo.findChainAsc.mockResolvedValue([e1]);

      await service.undo(USER_ID, 'e1');

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findAllForUser() — contrato de campos del bloque "Qué cambió"
  // (docs/design.md, Historial de cambios, §3 — set cerrado de 12 campos).
  // -------------------------------------------------------------------------

  describe('findAllForUser — contrato de campos (§3)', () => {
    function makeCuotaSnapshot(overrides: Partial<CuotaSnapshot> = {}): CuotaSnapshot {
      return {
        type: 'EXPENSE' as never,
        amountCents: 4000,
        categoryId: 'cat-cuota',
        description: 'Compra en cuotas',
        startMonth: '2026-01',
        totalInstallments: 6,
        currency: 'ARS' as never,
        exchangeRate: 1,
        anchorCurrency: 'ARS' as never,
        paymentMethodId: null,
        autoDebit: null,
        ...overrides,
      };
    }

    function makeRecurringRow(overrides: Partial<RecurringRowSnapshot> = {}): RecurringRowSnapshot {
      return {
        id: 'rec-1',
        chainId: 'chain-1',
        startMonth: '2026-01',
        deletedFrom: null,
        deletedAt: null,
        type: 'EXPENSE' as never,
        amountCents: 10000,
        categoryId: 'cat-fijo',
        description: 'Alquiler',
        frequency: 1,
        currency: 'ARS' as never,
        exchangeRate: 1,
        anchorCurrency: 'ARS' as never,
        paymentMethodId: null,
        autoDebit: null,
        sourceChainId: null,
        sourceMovementId: null,
        sourceInstallmentGroupId: null,
        formulaOperator: null,
        formulaOperand: null,
        formulaSign: null,
        ...overrides,
      };
    }

    it('EDIT de único: si cambió `type` sin cambiar el monto, `amount` se incluye igual (§3.2.e)', async () => {
      const entry = makeEntry({
        id: 'e1',
        action: HistoryAction.EDIT,
        snapshot: makeUnicoSnapshot({ type: 'EXPENSE' as never, amountCents: 5000, currency: 'ARS' as never }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID,
        type: 'INCOME',
        amountCents: 5000, // misma magnitud, solo cambió el tipo
        categoryId: 'cat-1',
        description: null,
        currency: 'ARS',
        exchangeRate: 1,
        anchorCurrency: 'ARS',
        paymentMethodId: null,
        autoDebit: null,
        occurredAt: new Date('2026-05-01T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });

      const [item] = await service.findAllForUser(USER_ID);

      const typeChange = item.changes.find((c) => c.field === 'type');
      const amountChange = item.changes.find((c) => c.field === 'amount');
      expect(typeChange).toEqual({ field: 'type', previous: 'EXPENSE', next: 'INCOME' });
      expect(amountChange).toEqual({
        field: 'amount',
        previous: { amountCents: 5000, currency: 'ARS', type: 'EXPENSE' },
        next: { amountCents: 5000, currency: 'ARS', type: 'INCOME' },
      });
    });

    // -----------------------------------------------------------------------
    // Regla de emisión de `Moneda` y `Cotización` en el DIFF de edición
    // (docs/design.md §3.1, ajuste QA visual) — la omisión la decide el
    // backend, no el frontend.
    // -----------------------------------------------------------------------

    it('EDIT de único ARS→ARS donde el form normaliza la cotización (1.450,00 → 1,00): NO emite `Cotización` (ruido reportado en QA)', async () => {
      const entry = makeEntry({
        id: 'e1',
        action: HistoryAction.EDIT,
        snapshot: makeUnicoSnapshot({
          amountCents: 5000,
          description: 'Antes',
          currency: 'ARS' as never,
          anchorCurrency: 'ARS' as never,
          exchangeRate: 1450,
        }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID,
        type: 'EXPENSE',
        amountCents: 6000, // el usuario sí cambió el monto...
        categoryId: 'cat-1',
        description: 'Después', // ...y la descripción
        currency: 'ARS',
        exchangeRate: 1, // ...pero la cotización solo la normalizó el form
        anchorCurrency: 'ARS',
        paymentMethodId: null,
        autoDebit: null,
        occurredAt: new Date('2026-05-01T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });

      const [item] = await service.findAllForUser(USER_ID);

      const fields = item.changes.map((c) => c.field);
      expect(fields).not.toContain('exchangeRate');
      expect(fields).not.toContain('currency');
      expect(fields).toEqual(expect.arrayContaining(['amount', 'description']));
    });

    it('EDIT de único que cambia de moneda (ARS → USD) con cotización numéricamente idéntica en los dos lados: SÍ emite `Cotización` (borde del spec)', async () => {
      const entry = makeEntry({
        id: 'e1',
        action: HistoryAction.EDIT,
        snapshot: makeUnicoSnapshot({
          currency: 'ARS' as never,
          anchorCurrency: 'ARS' as never,
          exchangeRate: 1, // sin conversión real del lado ARS
        }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID,
        type: 'EXPENSE',
        amountCents: 1000,
        categoryId: 'cat-1',
        description: null,
        currency: 'USD',
        exchangeRate: 1, // MISMO número que el lado ARS, pero acá SÍ hay conversión real
        anchorCurrency: 'ARS',
        paymentMethodId: null,
        autoDebit: null,
        occurredAt: new Date('2026-05-01T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });

      const [item] = await service.findAllForUser(USER_ID);

      const currencyChange = item.changes.find((c) => c.field === 'currency');
      const rateChange = item.changes.find((c) => c.field === 'exchangeRate');
      expect(currencyChange).toEqual({ field: 'currency', previous: 'ARS', next: 'USD' });
      expect(rateChange).toEqual({ field: 'exchangeRate', previous: 1, next: 1 });
    });

    it('EDIT de único en USD (conversión real en los dos lados) donde SOLO cambió la cotización: emite `Cotización` y NO `Moneda`', async () => {
      const entry = makeEntry({
        id: 'e1',
        action: HistoryAction.EDIT,
        snapshot: makeUnicoSnapshot({
          currency: 'USD' as never,
          anchorCurrency: 'ARS' as never,
          exchangeRate: 1180.5,
        }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.transaction.findUnique.mockResolvedValue({
        id: TX_ID,
        type: 'EXPENSE',
        amountCents: 1000,
        categoryId: 'cat-1',
        description: null,
        currency: 'USD',
        exchangeRate: 1245,
        anchorCurrency: 'ARS',
        paymentMethodId: null,
        autoDebit: null,
        occurredAt: new Date('2026-05-01T12:00:00Z'),
        timezone: 'America/Argentina/Buenos_Aires',
      });

      const [item] = await service.findAllForUser(USER_ID);

      const fields = item.changes.map((c) => c.field);
      expect(fields).toContain('exchangeRate');
      expect(fields).not.toContain('currency');
      const rateChange = item.changes.find((c) => c.field === 'exchangeRate');
      expect(rateChange).toEqual({ field: 'exchangeRate', previous: 1180.5, next: 1245 });
    });

    it('DELETE de único con moneda default: omite `currency`+`exchangeRate` (sin conversión real y moneda == default vigente), `paymentMethod` (sin método) y `autoDebit` (desactivado) — QA visual', async () => {
      const entry = makeEntry({
        id: 'e1',
        action: HistoryAction.DELETE,
        snapshot: makeUnicoSnapshot({
          amountCents: 3000,
          currency: 'ARS' as never,
          anchorCurrency: 'ARS' as never,
          paymentMethodId: null,
          autoDebit: null,
          description: 'Supermercado',
        }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Consumibles', color: '#4F86C6', scope: 'EXPENSE' },
      ]);
      prisma.user.findUnique.mockResolvedValue({ defaultCurrency: 'ARS' });

      const [item] = await service.findAllForUser(USER_ID);

      expect(item.action).toBe('DELETE');
      const fields = item.changes.map((c) => c.field);
      expect(fields).toEqual(['amount', 'category', 'description', 'date']);
      // Modo "valor único" (§3.3): ninguna fila lleva `next`.
      for (const c of item.changes) {
        expect('next' in c).toBe(false);
      }
      const amountRow = item.changes.find((c) => c.field === 'amount');
      expect(amountRow?.previous).toEqual({ amountCents: 3000, currency: 'ARS', type: 'EXPENSE' });
    });

    it('DELETE de único en moneda no-default del usuario (ARS ancla == ARS movimiento, pero el usuario opera hoy en USD): SÍ incluye `currency`', async () => {
      // Borde documentado en docs/design.md §3.1: "un movimiento en USD borrado
      // por alguien que hoy opera en ARS SÍ tiene que decir `Moneda USD`" — acá
      // el espejo: movimiento ARS (== su propia anchorCurrency) borrado por un
      // usuario cuyo default VIGENTE hoy es USD (cambió después de guardar).
      const entry = makeEntry({
        id: 'e1',
        action: HistoryAction.DELETE,
        snapshot: makeUnicoSnapshot({
          currency: 'ARS' as never,
          anchorCurrency: 'ARS' as never,
        }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.user.findUnique.mockResolvedValue({ defaultCurrency: 'USD' });

      const [item] = await service.findAllForUser(USER_ID);

      const currencyRow = item.changes.find((c) => c.field === 'currency');
      expect(currencyRow).toEqual({ field: 'currency', previous: 'ARS' });
    });

    it('DELETE de único con moneda distinta de la default: SÍ incluye `exchangeRate` y `currency` (solo `previous`)', async () => {
      const entry = makeEntry({
        id: 'e1',
        action: HistoryAction.DELETE,
        snapshot: makeUnicoSnapshot({
          currency: 'USD' as never,
          anchorCurrency: 'ARS' as never,
          exchangeRate: 1200,
        }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);

      const [item] = await service.findAllForUser(USER_ID);

      const rateRow = item.changes.find((c) => c.field === 'exchangeRate');
      expect(rateRow).toEqual({ field: 'exchangeRate', previous: 1200 });
      const currencyRow = item.changes.find((c) => c.field === 'currency');
      expect(currencyRow).toEqual({ field: 'currency', previous: 'USD' });
    });

    it('DELETE de cuota: incluye `startMonth`, `installments` y resuelve `paymentMethod` embebido', async () => {
      const entry = makeEntry({
        id: 'e1',
        targetKind: HistoryTargetKind.CUOTA,
        targetId: 'cuota-1',
        action: HistoryAction.DELETE,
        snapshot: makeCuotaSnapshot({ paymentMethodId: 'pm-1', autoDebit: true }),
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.paymentMethod.findMany.mockResolvedValue([{ id: 'pm-1', name: 'Tarjeta Visa' }]);

      const [item] = await service.findAllForUser(USER_ID);

      expect(item.changes).toEqual(
        expect.arrayContaining([
          { field: 'startMonth', previous: '2026-01' },
          { field: 'installments', previous: 6 },
          { field: 'paymentMethod', previous: { id: 'pm-1', name: 'Tarjeta Visa' } },
          { field: 'autoDebit', previous: true },
        ]),
      );
    });

    // -----------------------------------------------------------------------
    // `formula.currency` (corrección post-QA visual): la fila Recurring de un
    // calculado NUNCA tiene su propia currency real — `currency`/`amountCents`/
    // `exchangeRate`/`anchorCurrency` ahí son PLACEHOLDERS (el default del
    // usuario al crear, 0, 1) sin significado; el monto y la moneda reales
    // siempre se derivan del ORIGEN (sourceChainId/sourceMovementId/
    // sourceInstallmentGroupId) en tiempo de lectura. Por eso TODOS los
    // fixtures de calculado de acá abajo dejan `currency: 'ARS'` (el
    // placeholder que la base realmente persiste) y el ORIGEN mockeado en una
    // moneda DISTINTA — así el assert `formula.currency === <moneda del
    // origen>` prueba que el campo no sale de la fila propia.
    // -----------------------------------------------------------------------

    it('FIJO calculado: `isCalculated` true, `amount` top-level null, y el diff usa `formula` con la moneda del ORIGEN (no `amount`)', async () => {
      const row = makeRecurringRow({
        id: 'calc-1',
        sourceMovementId: 'tx-origen',
        formulaOperator: 'PCT' as never,
        formulaOperand: 1000,
        formulaSign: 1,
      });
      const snapshot: FijoEditSnapshot = { kind: 'edit', row, newRowId: null };
      const entry = makeEntry({
        id: 'e1',
        targetKind: HistoryTargetKind.FIJO,
        targetId: row.chainId,
        action: HistoryAction.EDIT,
        snapshot: snapshot as never,
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.recurring.findUnique.mockResolvedValue({
        ...row,
        formulaOperand: 1500, // cambió el operando
      });
      // Origen (único) en USD — distinto del placeholder 'ARS' de la fila del calculado.
      prisma.transaction.findMany.mockResolvedValue([{ id: 'tx-origen', currency: 'USD' }]);

      const [item] = await service.findAllForUser(USER_ID);

      expect(item.isCalculated).toBe(true);
      expect(item.amount).toBeNull();
      const formulaChange = item.changes.find((c) => c.field === 'formula');
      expect(formulaChange).toEqual({
        field: 'formula',
        previous: { operator: 'PCT', operand: 1000, sign: 1, currency: 'USD' },
        next: { operator: 'PCT', operand: 1500, sign: 1, currency: 'USD' },
      });
      expect(item.changes.some((c) => c.field === 'amount')).toBe(false);
      // Un solo round-trip: previous y next comparten origen, se resuelve UNA vez (no N+1).
      expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
      // Sin filtro de deletedAt (RF-HIST-002: el historial muestra movimientos eliminados).
      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, id: { in: ['tx-origen'] } },
        select: { id: true, currency: true },
      });
    });

    it('FIJO calculado-de-ÚNICO eliminado: `formula` lleva la moneda del ORIGEN (Transaction), no el placeholder de la fila', async () => {
      const row = makeRecurringRow({
        id: 'calc-usd',
        sourceMovementId: 'tx-origen',
        // Placeholder real que persiste la base para un calculado: ARS (el
        // default del usuario al crearlo), NUNCA la moneda verdadera.
        currency: 'ARS' as never,
        formulaOperator: 'ADD' as never,
        formulaOperand: 20000,
        formulaSign: 1,
      });
      const snapshot: FijoDeleteSnapshot = { kind: 'delete', chains: [{ chainId: row.chainId, rows: [row] }] };
      const entry = makeEntry({
        id: 'e1',
        targetKind: HistoryTargetKind.FIJO,
        targetId: row.chainId,
        action: HistoryAction.DELETE,
        snapshot: snapshot as never,
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-fijo', name: 'Vivienda', color: '#123456', scope: 'EXPENSE' },
      ]);
      // El origen (único) SÍ está en USD.
      prisma.transaction.findMany.mockResolvedValue([{ id: 'tx-origen', currency: 'USD' }]);

      const [item] = await service.findAllForUser(USER_ID);

      const formulaChange = item.changes.find((c) => c.field === 'formula');
      expect(formulaChange).toEqual({
        field: 'formula',
        previous: { operator: 'ADD', operand: 20000, sign: 1, currency: 'USD' },
      });
    });

    it('FIJO calculado-de-FIJO: `formula` lleva la moneda de la fila VIGENTE (mayor startMonth) de la cadena de origen', async () => {
      const row = makeRecurringRow({
        id: 'calc-2',
        sourceChainId: 'chain-origen',
        formulaOperator: 'ADD' as never,
        formulaOperand: 50000,
        formulaSign: -1,
      });
      const snapshot: FijoDeleteSnapshot = { kind: 'delete', chains: [{ chainId: row.chainId, rows: [row] }] };
      const entry = makeEntry({
        id: 'e1',
        targetKind: HistoryTargetKind.FIJO,
        targetId: row.chainId,
        action: HistoryAction.DELETE,
        snapshot: snapshot as never,
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-fijo', name: 'Vivienda', color: '#123456', scope: 'EXPENSE' },
      ]);
      // Cadena de origen con 2 splits: la fila vigente (mayor startMonth) está en
      // EUR; una fila vieja de la misma cadena, en ARS — debe ganar la vigente.
      prisma.recurring.findMany.mockResolvedValue([
        { chainId: 'chain-origen', startMonth: '2025-01', currency: 'ARS' },
        { chainId: 'chain-origen', startMonth: '2026-01', currency: 'EUR' },
      ]);

      const [item] = await service.findAllForUser(USER_ID);

      expect(item.isCalculated).toBe(true);
      expect(item.amount).toBeNull();
      const fields = item.changes.map((c) => c.field);
      expect(fields).toEqual(['formula', 'category', 'description', 'startMonth']);
      const formulaChange = item.changes.find((c) => c.field === 'formula');
      expect(formulaChange).toEqual({
        field: 'formula',
        previous: { operator: 'ADD', operand: 50000, sign: -1, currency: 'EUR' },
      });
      expect(prisma.recurring.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, chainId: { in: ['chain-origen'] } },
        select: { chainId: true, startMonth: true, currency: true },
      });
    });

    it('FIJO calculado-de-CUOTA: `formula` lleva la moneda del ORIGEN (InstallmentGroup)', async () => {
      const row = makeRecurringRow({
        id: 'calc-cuota',
        sourceInstallmentGroupId: 'grupo-origen',
        formulaOperator: 'MUL' as never,
        formulaOperand: 1500000,
        formulaSign: 1,
      });
      const snapshot: FijoDeleteSnapshot = { kind: 'delete', chains: [{ chainId: row.chainId, rows: [row] }] };
      const entry = makeEntry({
        id: 'e1',
        targetKind: HistoryTargetKind.FIJO,
        targetId: row.chainId,
        action: HistoryAction.DELETE,
        snapshot: snapshot as never,
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-fijo', name: 'Vivienda', color: '#123456', scope: 'EXPENSE' },
      ]);
      prisma.installmentGroup.findMany.mockResolvedValue([{ id: 'grupo-origen', currency: 'BRL' }]);

      const [item] = await service.findAllForUser(USER_ID);

      const formulaChange = item.changes.find((c) => c.field === 'formula');
      expect(formulaChange).toEqual({
        field: 'formula',
        previous: { operator: 'MUL', operand: 1500000, sign: 1, currency: 'BRL' },
      });
      expect(prisma.installmentGroup.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, id: { in: ['grupo-origen'] } },
        select: { id: true, currency: true },
      });
    });

    it('FIJO calculado cuyo origen NO se puede resolver (borrado físicamente): omite el campo `formula` entero, sin default de moneda', async () => {
      const row = makeRecurringRow({
        id: 'calc-huerfano',
        sourceMovementId: 'tx-que-ya-no-existe',
        formulaOperator: 'ADD' as never,
        formulaOperand: 10000,
        formulaSign: 1,
      });
      const snapshot: FijoDeleteSnapshot = { kind: 'delete', chains: [{ chainId: row.chainId, rows: [row] }] };
      const entry = makeEntry({
        id: 'e1',
        targetKind: HistoryTargetKind.FIJO,
        targetId: row.chainId,
        action: HistoryAction.DELETE,
        snapshot: snapshot as never,
      });
      repo.findAllForUserAsc.mockResolvedValue([entry]);
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-fijo', name: 'Vivienda', color: '#123456', scope: 'EXPENSE' },
      ]);
      // transaction.findMany por default devuelve [] (ver makePrismaMock): el
      // origen no aparece — simula un Transaction purgado físicamente.

      const [item] = await service.findAllForUser(USER_ID);

      const fields = item.changes.map((c) => c.field);
      expect(fields).not.toContain('formula');
      // El resto de los campos del calculado (category/description/startMonth) sigue presente.
      expect(fields).toEqual(expect.arrayContaining(['category', 'description', 'startMonth']));
    });
  });
});
