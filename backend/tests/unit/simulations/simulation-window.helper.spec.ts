/**
 * Tests unitarios de los helpers de ventana/horizonte de la simulación de
 * categoría (RN-028) — casos de borde explícitos pedidos por el orquestador:
 * horizonte de 6 meses en julio (extendido) vs. junio (natural, sin extender).
 */
import {
  axisPositionFor,
  buildWindowMonths,
  computeHorizonEndMonth,
  resolveTodayMonthKey,
  MIN_MONTHS_WITH_DATA,
} from '../../../src/simulations/simulation-window.helper';

describe('resolveTodayMonthKey', () => {
  it('resuelve "YYYY-MM" desde un today YYYY-MM-DD explícito', () => {
    expect(resolveTodayMonthKey('2026-07-15')).toBe('2026-07');
  });

  it('sin today, cae a la fecha UTC del sistema', () => {
    const now = new Date();
    const expected = `${String(now.getUTCFullYear()).padStart(4, '0')}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(resolveTodayMonthKey(undefined)).toBe(expected);
  });
});

describe('buildWindowMonths — ventana histórica [A-12..A-1] (RN-028)', () => {
  it('12 meses ascendentes, A-12 primero y A-1 último', () => {
    const months = buildWindowMonths('2026-07');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-07'); // A-12
    expect(months[11]).toBe('2026-06'); // A-1
  });

  it('cruza el límite de año correctamente', () => {
    const months = buildWindowMonths('2026-02');
    expect(months[0]).toBe('2025-02');
    expect(months[11]).toBe('2026-01');
  });
});

describe('computeHorizonEndMonth — el tramo simulado nunca baja de 6 meses (RN-028)', () => {
  it('julio: tramo natural ago..dic = 5 meses (< 6) → extendido a A+6 = enero del año siguiente', () => {
    expect(computeHorizonEndMonth('2026-07')).toBe('2027-01');
  });

  it('junio: tramo natural jul..dic = 6 meses (no < 6) → NO extiende, horizonte termina en diciembre', () => {
    expect(computeHorizonEndMonth('2026-06')).toBe('2026-12');
  });

  it('diciembre: tramo natural = 0 meses → extendido a A+6 = junio del año siguiente', () => {
    expect(computeHorizonEndMonth('2026-12')).toBe('2027-06');
  });

  it('enero: tramo natural feb..dic = 11 meses (no < 6) → NO extiende, termina en diciembre del mismo año', () => {
    expect(computeHorizonEndMonth('2026-01')).toBe('2026-12');
  });
});

describe('axisPositionFor — posición en el eje de la regresión (RN-028)', () => {
  it('el mes en curso ocupa la posición 13', () => {
    expect(axisPositionFor('2026-07', '2026-07')).toBe(13);
  });

  it('A+1 ocupa la posición 14, A+2 la 15, ...', () => {
    expect(axisPositionFor('2026-07', '2026-08')).toBe(14);
    expect(axisPositionFor('2026-07', '2026-09')).toBe(15);
  });
});

describe('MIN_MONTHS_WITH_DATA', () => {
  it('el mínimo de meses con datos es 3 (RF-SIM-002)', () => {
    expect(MIN_MONTHS_WITH_DATA).toBe(3);
  });
});
