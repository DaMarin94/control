/**
 * Tests unitarios de los helpers de ventana/tramo de la simulación de
 * categoría (RN-028/RN-029) — casos de borde explícitos: tramo de 6 meses en
 * julio (extendido) vs. junio (natural, sin extender), arranque efectivo
 * (clamp de mes pasado) y rango contiguo de meses.
 */
import {
  axisPositionFor,
  buildMonthRange,
  buildWindowMonths,
  computeHorizonEndMonth,
  effectiveStartMonth,
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

describe('computeHorizonEndMonth — el tramo de una simulación nunca baja de 6 meses (RN-028/RN-029)', () => {
  it('julio: tramo natural ago..dic = 5 meses (< 6) → extendido a base+6 = enero del año siguiente', () => {
    expect(computeHorizonEndMonth('2026-07')).toBe('2027-01');
  });

  it('junio: tramo natural jul..dic = 6 meses (no < 6) → NO extiende, tramo termina en diciembre', () => {
    expect(computeHorizonEndMonth('2026-06')).toBe('2026-12');
  });

  it('diciembre: tramo natural = 0 meses → extendido a base+6 = junio del año siguiente', () => {
    expect(computeHorizonEndMonth('2026-12')).toBe('2027-06');
  });

  it('enero: tramo natural feb..dic = 11 meses (no < 6) → NO extiende, termina en diciembre del mismo año', () => {
    expect(computeHorizonEndMonth('2026-01')).toBe('2026-12');
  });

  it('octubre: extendido a base+6 (ejemplo de control del orquestador)', () => {
    expect(computeHorizonEndMonth('2026-10')).toBe('2027-04');
  });
});

describe('effectiveStartMonth — arranque efectivo de un tramo (RN-028/RN-029)', () => {
  it('startMonth futuro respecto del mes en curso: prevalece el startMonth', () => {
    expect(effectiveStartMonth('2026-10', '2026-07')).toBe('2026-10');
  });

  it('startMonth igual al mes en curso: se mantiene', () => {
    expect(effectiveStartMonth('2026-07', '2026-07')).toBe('2026-07');
  });

  it('startMonth quedó atrás (el mes en curso ya lo pasó): el arranque efectivo es el mes en curso, no revive el pasado', () => {
    expect(effectiveStartMonth('2026-01', '2026-07')).toBe('2026-07');
  });
});

describe('buildMonthRange — rango contiguo de meses [from..to] (inclusive)', () => {
  it('rango dentro del mismo año', () => {
    expect(buildMonthRange('2026-08', '2026-10')).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('rango de un solo mes (from === to)', () => {
    expect(buildMonthRange('2026-08', '2026-08')).toEqual(['2026-08']);
  });

  it('rango que cruza el límite de año', () => {
    expect(buildMonthRange('2026-11', '2027-02')).toEqual([
      '2026-11', '2026-12', '2027-01', '2027-02',
    ]);
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
