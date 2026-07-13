/**
 * Tests unitarios de MovementsController — validación de los query params
 * del ancla editable de la escala de color (P3): anchorAmountCents/anchorCurrency
 * en GET /movements/reports/annual-unicos.
 *
 * Cubre:
 * - Ausencia de ambos params → delega al service con undefined/undefined (comportamiento actual).
 * - Presencia de ambos con moneda USD → passthrough al service tal cual.
 * - Presencia de ambos con otra moneda → se pasan al service tal cual (la conversión vive ahí).
 * - Solo uno de los dos presente → 400.
 * - anchorCurrency inválido → 400.
 * - anchorAmountCents no numérico / no positivo → 400.
 */
import { BadRequestException } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { MovementsController } from '../../../src/movements/movements.controller';

const mockMovementsService = {
  getAnnualUnicosReport: jest.fn(),
};

describe('MovementsController — GET /movements/reports/annual-unicos (ancla editable)', () => {
  let controller: MovementsController;
  const req = { user: { userId: 'user-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMovementsService.getAnnualUnicosReport.mockResolvedValue({ ok: true });
    controller = new MovementsController(mockMovementsService as any);
  });

  it('sin anchorAmountCents ni anchorCurrency → los pasa como undefined al service', () => {
    controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, undefined, undefined);

    expect(mockMovementsService.getAnnualUnicosReport).toHaveBeenCalledWith(
      'user-1', 2026, null, undefined, undefined, undefined, undefined,
    );
  });

  it('anchorAmountCents=2000 y anchorCurrency=USD → se pasan al service tal cual', () => {
    controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, '2000', 'USD');

    expect(mockMovementsService.getAnnualUnicosReport).toHaveBeenCalledWith(
      'user-1', 2026, null, undefined, undefined, 2000, Currency.USD,
    );
  });

  it('anchorAmountCents=120000 y anchorCurrency=ARS → se pasan al service tal cual', () => {
    controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, '120000', 'ARS');

    expect(mockMovementsService.getAnnualUnicosReport).toHaveBeenCalledWith(
      'user-1', 2026, null, undefined, undefined, 120000, Currency.ARS,
    );
  });

  it('solo anchorAmountCents presente (sin anchorCurrency) → 400', () => {
    expect(() =>
      controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, '2000', undefined),
    ).toThrow(BadRequestException);
  });

  it('solo anchorCurrency presente (sin anchorAmountCents) → 400', () => {
    expect(() =>
      controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, undefined, 'USD'),
    ).toThrow(BadRequestException);
  });

  it('anchorCurrency inválido (no ARS|USD|EUR|BRL) → 400', () => {
    expect(() =>
      controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, '2000', 'GBP'),
    ).toThrow(BadRequestException);
  });

  it('anchorAmountCents no numérico → 400', () => {
    expect(() =>
      controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, 'abc', 'USD'),
    ).toThrow(BadRequestException);
  });

  it('anchorAmountCents = 0 → 400 (debe ser positivo)', () => {
    expect(() =>
      controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, '0', 'USD'),
    ).toThrow(BadRequestException);
  });

  it('anchorAmountCents negativo → 400', () => {
    expect(() =>
      controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, '-100', 'USD'),
    ).toThrow(BadRequestException);
  });

  it('anchorAmountCents decimal → 400 (debe ser entero)', () => {
    expect(() =>
      controller.getAnnualUnicosReport(req, '2026', undefined, undefined, undefined, '15.5', 'USD'),
    ).toThrow(BadRequestException);
  });
});
