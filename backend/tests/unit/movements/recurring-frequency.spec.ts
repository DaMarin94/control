/**
 * Tests unitarios para la lógica de frecuencia de fijos y skips — P1 (entero 1..12).
 *
 * Cubre:
 * - isOnFrequency: condición de aparición por frecuencia, anclada al startMonth
 *   - frequency=1 (mensual): aparece todos los meses (diff%1===0 siempre)
 *   - frequency=2 (bimestral): cada 2 meses
 *   - frequency=3 (trimestral): cada 3 meses
 *   - frequency=4 (cuatrimestral): cada 4 meses (no existía en el enum viejo)
 *   - frequency=6 (semestral): cada 6 meses
 *   - frequency=12 (anual): cada 12 meses
 * - Rollover de año en la condición de frecuencia
 * - Back-compat: fijo sin frequency = 1 (mensual) → aparece en todos los meses
 * - addMonths / monthDiff helpers (ya testeados, solo back-compat del helper)
 */

import {
  isOnFrequency,
  addMonths,
  monthDiff,
} from '../../../src/movements/movements.repository';

describe('isOnFrequency', () => {
  // -------------------------------------------------------------------------
  // frequency=1 (mensual, back-compat)
  // -------------------------------------------------------------------------

  describe('frequency=1 (mensual, back-compat)', () => {
    it('startMonth === month → true (el mes de inicio siempre aparece)', () => {
      expect(isOnFrequency('2026-06', 1, '2026-06')).toBe(true);
    });

    it('mes siguiente → true', () => {
      expect(isOnFrequency('2026-06', 1, '2026-07')).toBe(true);
    });

    it('cualquier mes con diff entero → true (diff%1=0 siempre)', () => {
      expect(isOnFrequency('2026-01', 1, '2026-12')).toBe(true);
    });

    it('rollover de año → true', () => {
      expect(isOnFrequency('2026-11', 1, '2027-03')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // frequency=2 (bimestral, cada 2 meses, anclado al startMonth)
  // -------------------------------------------------------------------------

  describe('frequency=2 (bimestral)', () => {
    it('startMonth=marzo, month=marzo → true (diff=0, 0%2=0)', () => {
      expect(isOnFrequency('2026-03', 2, '2026-03')).toBe(true);
    });

    it('startMonth=marzo, month=mayo → true (diff=2, 2%2=0)', () => {
      expect(isOnFrequency('2026-03', 2, '2026-05')).toBe(true);
    });

    it('startMonth=marzo, month=julio → true (diff=4, 4%2=0)', () => {
      expect(isOnFrequency('2026-03', 2, '2026-07')).toBe(true);
    });

    it('startMonth=marzo, month=abril → false (diff=1, 1%2=1)', () => {
      expect(isOnFrequency('2026-03', 2, '2026-04')).toBe(false);
    });

    it('startMonth=marzo, month=junio → false (diff=3, 3%2=1)', () => {
      expect(isOnFrequency('2026-03', 2, '2026-06')).toBe(false);
    });

    it('rollover de año: startMonth=nov-2026, month=ene-2027 → true (diff=2, 2%2=0)', () => {
      expect(isOnFrequency('2026-11', 2, '2027-01')).toBe(true);
    });

    it('rollover de año: startMonth=nov-2026, month=dic-2026 → false (diff=1, 1%2=1)', () => {
      expect(isOnFrequency('2026-11', 2, '2026-12')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // frequency=3 (trimestral, cada 3 meses)
  // -------------------------------------------------------------------------

  describe('frequency=3 (trimestral)', () => {
    it('startMonth=enero, month=enero → true (diff=0)', () => {
      expect(isOnFrequency('2026-01', 3, '2026-01')).toBe(true);
    });

    it('startMonth=enero, month=abril → true (diff=3, 3%3=0)', () => {
      expect(isOnFrequency('2026-01', 3, '2026-04')).toBe(true);
    });

    it('startMonth=enero, month=julio → true (diff=6, 6%3=0)', () => {
      expect(isOnFrequency('2026-01', 3, '2026-07')).toBe(true);
    });

    it('startMonth=enero, month=octubre → true (diff=9, 9%3=0)', () => {
      expect(isOnFrequency('2026-01', 3, '2026-10')).toBe(true);
    });

    it('startMonth=enero, month=febrero → false (diff=1, 1%3=1)', () => {
      expect(isOnFrequency('2026-01', 3, '2026-02')).toBe(false);
    });

    it('startMonth=enero, month=marzo → false (diff=2, 2%3=2)', () => {
      expect(isOnFrequency('2026-01', 3, '2026-03')).toBe(false);
    });

    it('rollover de año: startMonth=nov-2026, month=feb-2027 → true (diff=3)', () => {
      expect(isOnFrequency('2026-11', 3, '2027-02')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // frequency=4 (cuatrimestral) — el agujero del enum viejo (P1: ya no existe)
  // -------------------------------------------------------------------------

  describe('frequency=4 (cuatrimestral)', () => {
    it('startMonth=enero, month=enero → true (diff=0)', () => {
      expect(isOnFrequency('2026-01', 4, '2026-01')).toBe(true);
    });

    it('startMonth=enero, month=mayo → true (diff=4, 4%4=0)', () => {
      expect(isOnFrequency('2026-01', 4, '2026-05')).toBe(true);
    });

    it('startMonth=enero, month=marzo → false (diff=2, 2%4=2)', () => {
      expect(isOnFrequency('2026-01', 4, '2026-03')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // frequency=6 (semestral, cada 6 meses)
  // -------------------------------------------------------------------------

  describe('frequency=6 (semestral)', () => {
    it('startMonth=enero, month=enero → true (diff=0)', () => {
      expect(isOnFrequency('2026-01', 6, '2026-01')).toBe(true);
    });

    it('startMonth=enero, month=julio → true (diff=6, 6%6=0)', () => {
      expect(isOnFrequency('2026-01', 6, '2026-07')).toBe(true);
    });

    it('startMonth=enero, month=enero-siguiente → true (diff=12, 12%6=0)', () => {
      expect(isOnFrequency('2026-01', 6, '2027-01')).toBe(true);
    });

    it('startMonth=enero, month=marzo → false (diff=2, 2%6=2)', () => {
      expect(isOnFrequency('2026-01', 6, '2026-03')).toBe(false);
    });

    it('startMonth=enero, month=junio → false (diff=5, 5%6=5)', () => {
      expect(isOnFrequency('2026-01', 6, '2026-06')).toBe(false);
    });

    it('rollover: startMonth=sep-2026, month=mar-2027 → true (diff=6)', () => {
      expect(isOnFrequency('2026-09', 6, '2027-03')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // frequency=12 (anual, cada 12 meses)
  // -------------------------------------------------------------------------

  describe('frequency=12 (anual)', () => {
    it('startMonth=enero-2026, month=enero-2026 → true (diff=0)', () => {
      expect(isOnFrequency('2026-01', 12, '2026-01')).toBe(true);
    });

    it('startMonth=enero-2026, month=enero-2027 → true (diff=12, 12%12=0)', () => {
      expect(isOnFrequency('2026-01', 12, '2027-01')).toBe(true);
    });

    it('startMonth=enero-2026, month=enero-2028 → true (diff=24, 24%12=0)', () => {
      expect(isOnFrequency('2026-01', 12, '2028-01')).toBe(true);
    });

    it('startMonth=enero-2026, month=julio-2026 → false (diff=6, 6%12=6)', () => {
      expect(isOnFrequency('2026-01', 12, '2026-07')).toBe(false);
    });

    it('startMonth=enero-2026, month=enero-2026+1 (febrero) → false (diff=1)', () => {
      expect(isOnFrequency('2026-01', 12, '2026-02')).toBe(false);
    });

    it('startMonth=junio-2026, month=junio-2027 → true (diff=12)', () => {
      expect(isOnFrequency('2026-06', 12, '2027-06')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// addMonths y monthDiff (back-compat — estos ya estaban testeados en v1.0,
// se incluyen aquí para asegurar que los helpers no se rompieron con la refactor)
// ---------------------------------------------------------------------------

describe('addMonths (back-compat)', () => {
  it('suma meses dentro del mismo año', () => {
    expect(addMonths('2026-06', 3)).toBe('2026-09');
  });

  it('suma con rollover de año', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
  });

  it('suma 0 meses → mismo mes', () => {
    expect(addMonths('2026-06', 0)).toBe('2026-06');
  });

  it('suma 12 meses → mismo mes del año siguiente', () => {
    expect(addMonths('2026-06', 12)).toBe('2027-06');
  });
});

describe('monthDiff (back-compat)', () => {
  it('mismo mes → 0', () => {
    expect(monthDiff('2026-06', '2026-06')).toBe(0);
  });

  it('2 meses de diferencia', () => {
    expect(monthDiff('2026-06', '2026-08')).toBe(2);
  });

  it('con rollover de año', () => {
    expect(monthDiff('2026-11', '2027-02')).toBe(3);
  });

  it('diferencia de un año completo', () => {
    expect(monthDiff('2026-01', '2027-01')).toBe(12);
  });
});
