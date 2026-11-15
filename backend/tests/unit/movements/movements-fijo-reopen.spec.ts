/**
 * Tests de integración (repo + datos en memoria) del estado de la cadena que deja una
 * reapertura de fijo (RF-MF-008): fila vieja V cerrada en X (cubre el relleno, con sus
 * anulaciones) + fila nueva N desde X, sin fin, con la cadencia re-anclada en X.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma/client';
import { MovementsRepository } from '../../../src/movements/movements.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const USER = 'user-reopen';
const CAT = { id: 'cat-1', name: 'Servicios', color: '#4F86C6', scope: 'EXPENSE' };

const base = {
  chainId: 'chain-1',
  sourceChainId: null,
  frequency: 3,
  type: MovementType.EXPENSE,
  currency: 'ARS',
  exchangeRate: 1,
  anchorCurrency: 'ARS',
  description: 'Gimnasio',
  category: CAT,
  paymentMethod: null,
};

// Fijo cada 3 meses desde 2026-01 (ene/abr/jul/oct), terminaba en 2026-07 (exclusivo).
// Reabierto en X = 2026-11 (no alineado con la cadencia vieja): relleno = [2026-07, 2026-11)
// -> apariciones viejas: 2026-07 y 2026-10, ambas anuladas sobre V.
const V = { ...base, id: 'V', startMonth: '2026-01', deletedFrom: '2026-11', amountCents: 5000, skipMonths: ['2026-07', '2026-10'] };
const N = { ...base, id: 'N', startMonth: '2026-11', deletedFrom: null, amountCents: 9000, skipMonths: [] as string[] };

const mockPrisma = {
  recurring: { findMany: jest.fn() },
  transaction: { findMany: jest.fn() },
  installmentGroup: { findMany: jest.fn() },
  referenceRate: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
};

describe('MovementsRepository — cadena de un fijo reabierto (RF-MF-008)', () => {
  let repo: MovementsRepository;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.referenceRate.findMany.mockResolvedValue([]);
    mockPrisma.installmentGroup.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.recurring.findMany.mockImplementation((args: any) => {
      if (args?.select?.chainId === true && args?.select?.deletedFrom === true) {
        return Promise.resolve([V, N]); // loadChainBounds: toda la cadena
      }
      const month: string = args.where.startMonth.lte;
      const rows = [V, N]
        .filter((r) => r.startMonth <= month && (r.deletedFrom === null || r.deletedFrom > month))
        .map((r) => ({ ...r, skips: r.skipMonths.includes(month) ? [{ month }] : [] }));
      return Promise.resolve(rows);
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [MovementsRepository, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    repo = module.get(MovementsRepository);
  });

  const list = (m: string) => repo.findFijosByMonth(USER, m);

  it('meses de relleno: aparición vieja anulada, con el monto viejo; sin aparición no hay ítem', async () => {
    const jul = await list('2026-07');
    expect(jul).toHaveLength(1);
    expect(jul[0]).toMatchObject({ id: 'V', amountCents: 5000, skipped: true });

    expect(await list('2026-08')).toEqual([]); // no es aparición según el ancla vieja
    expect(await list('2026-09')).toEqual([]);

    const oct = await list('2026-10');
    expect(oct[0]).toMatchObject({ id: 'V', amountCents: 5000, skipped: true });
  });

  it('desde X: aparece en X y cada 3 meses desde X (cadencia re-anclada), con el monto nuevo y sin fin', async () => {
    const nov = await list('2026-11');
    expect(nov[0]).toMatchObject({ id: 'N', amountCents: 9000, skipped: false, endMonth: null, startMonth: '2026-01' });

    expect(await list('2026-12')).toEqual([]);
    expect(await list('2027-01')).toEqual([]); // ancla vieja (ene) ya no rige
    expect((await list('2027-02'))[0]).toMatchObject({ id: 'N', skipped: false });
    expect((await list('2027-05'))[0]).toMatchObject({ id: 'N' });
  });

  it('el pasado previo al fin original queda intacto', async () => {
    expect((await list('2026-04'))[0]).toMatchObject({ id: 'V', amountCents: 5000, skipped: false });
  });
});
