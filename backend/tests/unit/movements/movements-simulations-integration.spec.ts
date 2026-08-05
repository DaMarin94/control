/**
 * Tests de integración de MovementsService ↔ SimulationsService (RF-SIM-003).
 *
 * Cubre:
 * - Los movimientos simulados se embeben en la sección "unicos" de GET /movements
 *   para un mes futuro dentro del horizonte, mezclados con los reales.
 * - Suman a los totales del mes (RF-VM-002, RN-019).
 * - Participan del filtro de categorías de GET /movements igual que un único real.
 * - SimulationsService es una dependencia obligatoria del constructor.
 */
import { CategoryScope, Currency, MovementType } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { MovementsService } from '../../../src/movements/movements.service';
import { MovementsRepository, MovementItem } from '../../../src/movements/movements.repository';
import { SettingsService } from '../../../src/settings/settings.service';
import { SimulationsService } from '../../../src/simulations/simulations.service';

const mockRepo = {
  findUnicosByMonth: jest.fn(),
  findFijosByMonth: jest.fn(),
  findCuotasByMonth: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

const mockSettingsService = {
  getSettings: jest.fn().mockResolvedValue({ defaultCurrency: Currency.ARS, lastExchangeRate: null }),
};

const mockSimulationsService = {
  getSimulatedItemsForMonth: jest.fn(),
};

const USER_ID = 'user-movements-sim-1';
const CAT_REAL = 'cat-real';
const CAT_SIM = 'cat-simulada';

function makeRealUnico(overrides: Partial<MovementItem> = {}): MovementItem {
  return {
    id: 'tx-real-1',
    origin: 'unico',
    type: MovementType.EXPENSE,
    amountCents: 5000,
    convertedAmountCents: 5000,
    currency: Currency.ARS,
    exchangeRate: 1,
    description: 'Compra real',
    occurredAt: new Date('2026-08-05T12:00:00Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    category: { id: CAT_REAL, name: 'Real', color: '#111111', scope: CategoryScope.EXPENSE },
    paymentMethod: null,
    autoDebit: null,
    installment: null,
    frequency: null,
    startMonth: null,
    endMonth: null,
    skipped: false,
    calculated: null,
    hasCalculated: false,
    calculatedChildren: [],
    simulated: false,
    ...overrides,
  };
}

function makeSimulatedUnico(overrides: Partial<MovementItem> = {}): MovementItem {
  return {
    id: 'simulated:sim-1:2026-08',
    origin: 'unico',
    type: MovementType.EXPENSE,
    amountCents: 8000,
    convertedAmountCents: 8000,
    currency: Currency.ARS,
    exchangeRate: 1,
    description: null,
    occurredAt: null,
    timezone: null,
    category: { id: CAT_SIM, name: 'Simulada', color: '#222222', scope: CategoryScope.BOTH },
    paymentMethod: null,
    autoDebit: null,
    installment: null,
    frequency: null,
    startMonth: null,
    endMonth: null,
    skipped: false,
    calculated: null,
    hasCalculated: false,
    calculatedChildren: [],
    simulated: true,
    ...overrides,
  };
}

describe('MovementsService ↔ SimulationsService — embebido de movimientos simulados (RF-SIM-003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findFijosByMonth.mockResolvedValue([]);
    mockRepo.findCuotasByMonth.mockResolvedValue([]);
  });

  it('embebe el movimiento simulado en "unicos" y suma a los totales del mes', async () => {
    mockRepo.findUnicosByMonth.mockResolvedValue([makeRealUnico()]);
    mockSimulationsService.getSimulatedItemsForMonth.mockResolvedValue([makeSimulatedUnico()]);

    const service = new MovementsService(
      mockRepo as unknown as MovementsRepository,
      mockLogger as unknown as Logger,
      mockSettingsService as unknown as SettingsService,
      mockSimulationsService as unknown as SimulationsService,
    );

    const result = await service.getMonthMovements(USER_ID, '2026-08');

    expect(result.movements.unicos).toHaveLength(2);
    expect(result.movements.unicos.some((u) => u.simulated)).toBe(true);
    // Totales = real (5000) + simulado (8000)
    expect(result.totals.expenseCents).toBe(13000);
    expect(mockSimulationsService.getSimulatedItemsForMonth).toHaveBeenCalledWith(USER_ID, '2026-08', undefined);
  });

  it('pasa el param "today" al SimulationsService', async () => {
    mockRepo.findUnicosByMonth.mockResolvedValue([]);
    mockSimulationsService.getSimulatedItemsForMonth.mockResolvedValue([]);

    const service = new MovementsService(
      mockRepo as unknown as MovementsRepository,
      mockLogger as unknown as Logger,
      mockSettingsService as unknown as SettingsService,
      mockSimulationsService as unknown as SimulationsService,
    );

    await service.getMonthMovements(USER_ID, '2026-08', null, '2026-07-15');

    expect(mockSimulationsService.getSimulatedItemsForMonth).toHaveBeenCalledWith(
      USER_ID,
      '2026-08',
      '2026-07-15',
    );
  });

  it('el filtro de categorías alcanza al simulado igual que a un único real', async () => {
    mockRepo.findUnicosByMonth.mockResolvedValue([makeRealUnico()]);
    mockSimulationsService.getSimulatedItemsForMonth.mockResolvedValue([makeSimulatedUnico()]);

    const service = new MovementsService(
      mockRepo as unknown as MovementsRepository,
      mockLogger as unknown as Logger,
      mockSettingsService as unknown as SettingsService,
      mockSimulationsService as unknown as SimulationsService,
    );

    // Filtro que deja pasar SOLO la categoría real: el simulado queda afuera.
    const result = await service.getMonthMovements(USER_ID, '2026-08', [CAT_REAL]);

    expect(result.movements.unicos).toHaveLength(1);
    expect(result.movements.unicos[0].simulated).toBe(false);
    expect(result.totals.expenseCents).toBe(5000);
  });

  it('filtro "ninguna" ([]) también excluye a los simulados, sin llegar a pedirlos', async () => {
    const service = new MovementsService(
      mockRepo as unknown as MovementsRepository,
      mockLogger as unknown as Logger,
      mockSettingsService as unknown as SettingsService,
      mockSimulationsService as unknown as SimulationsService,
    );

    const result = await service.getMonthMovements(USER_ID, '2026-08', []);

    expect(result.movements.unicos).toEqual([]);
    expect(result.totals).toEqual({ expenseCents: 0, incomeCents: 0, balanceCents: 0 });
    expect(mockSimulationsService.getSimulatedItemsForMonth).not.toHaveBeenCalled();
  });

  it('mes sin movimientos simulados (fuera de horizonte): unicos queda igual que solo con reales', async () => {
    mockRepo.findUnicosByMonth.mockResolvedValue([makeRealUnico()]);
    mockSimulationsService.getSimulatedItemsForMonth.mockResolvedValue([]);

    const service = new MovementsService(
      mockRepo as unknown as MovementsRepository,
      mockLogger as unknown as Logger,
      mockSettingsService as unknown as SettingsService,
      mockSimulationsService as unknown as SimulationsService,
    );

    const result = await service.getMonthMovements(USER_ID, '2026-08');

    expect(result.movements.unicos).toEqual([makeRealUnico()]);
    expect(result.totals.expenseCents).toBe(5000);
  });
});
