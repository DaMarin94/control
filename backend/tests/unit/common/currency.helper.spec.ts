/**
 * Tests unitarios de currency.helper.ts (Fase 1.2.4)
 *
 * Cubre:
 * - convertToDefaultCurrency: todos los pares posibles de las 4 monedas
 * - back-compat (comportamiento 1.2.3 preservado para ARS/USD)
 * - deriveExchangeRate: derivación vía pivote USD
 * - buildPivotRates: mapeo de filas de ReferenceRate
 * - resolveNearestYearMonth: clamp al rango disponible (Fase 1.2.4 fix)
 * - fallback endurecido: currency===anchor sin rates → devuelve amountCents (no infla)
 * - casos borde: misma moneda, sin datos de pivote, exchangeRate 0
 */

import { Currency } from '@prisma/client';
import {
  convertToDefaultCurrency,
  convertToDisplayCurrency,
  convertToDisplayCurrencyByMonth,
  deriveExchangeRate,
  buildPivotRates,
  resolveNearestYearMonth,
  PivotRates,
} from '../../../src/common/currency.helper';

// ---------------------------------------------------------------------------
// Helpers de testing
// ---------------------------------------------------------------------------

/** Pivot rates de referencia para tests (ARS/USD=1432, BRL/USD=5.11, EUR/USD=0.865) */
const SAMPLE_PIVOT: PivotRates = {
  ARS: 1432,
  BRL: 5.11,
  EUR: 0.865,
};

// ---------------------------------------------------------------------------
// convertToDisplayCurrency (Fase 1.2.4 — función principal con anchorCurrency)
// ---------------------------------------------------------------------------

describe('convertToDisplayCurrency', () => {
  // ── Caso 1: misma moneda → sin conversión ────────────────────────────────

  it('currency === displayCurrency: sin cambio (ARS→ARS)', () => {
    expect(convertToDisplayCurrency(150000, Currency.ARS, 1, Currency.ARS, Currency.ARS, SAMPLE_PIVOT)).toBe(150000);
  });

  it('currency === displayCurrency: sin cambio (EUR→EUR)', () => {
    expect(convertToDisplayCurrency(5000, Currency.EUR, 1432, Currency.ARS, Currency.EUR, SAMPLE_PIVOT)).toBe(5000);
  });

  // ── Caso 2: anchor === display → usa exchangeRate directamente ────────────

  it('[back-compat] USD movimiento, anchor=ARS, display=ARS: amount × exchangeRate', () => {
    // Movimiento guardado cuando default=ARS, exchangeRate=1432 (ARS por 1 USD)
    // Display sigue siendo ARS → sin cambio de anchor → simple multiplicación
    const result = convertToDisplayCurrency(1000, Currency.USD, 1432, Currency.ARS, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBe(1_432_000); // 1000 centavos USD × 1432 = 1_432_000 centavos ARS
  });

  it('[back-compat] ARS movimiento, anchor=ARS, display=ARS: sin conversión', () => {
    const result = convertToDisplayCurrency(100000, Currency.ARS, 1, Currency.ARS, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBe(100000);
  });

  it('[back-compat] EUR movimiento, anchor=ARS, display=ARS: amount × exchangeRate', () => {
    // exchangeRate = 1432/0.865 ≈ 1655.49
    const rate = SAMPLE_PIVOT.ARS / SAMPLE_PIVOT.EUR;
    const result = convertToDisplayCurrency(1000, Currency.EUR, rate, Currency.ARS, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBe(Math.round(1000 * rate));
  });

  it('[back-compat] USD movimiento, anchor=USD, display=USD: sin conversión', () => {
    const result = convertToDisplayCurrency(1000, Currency.USD, 1, Currency.USD, Currency.USD, SAMPLE_PIVOT);
    expect(result).toBe(1000);
  });

  // ── Caso 3: anchor ≠ display, con pivotRates → re-ruteo ─────────────────

  it('[BUG-FIX] USD movimiento, anchor=ARS, display=USD: re-rutea vía pivot', () => {
    // Movimiento: 10 USD (1000 centavos USD) guardado con anchor=ARS, exchangeRate=1432
    // Usuario ahora tiene default=USD
    // Esperado: 1000 centavos USD (sin cambio, currency === displayCurrency? NO — currency=USD, display=USD → handled by case 1)
    // WAIT: currency=USD, displayCurrency=USD → case 1 retorna sin conversión
    const result = convertToDisplayCurrency(1000, Currency.USD, 1432, Currency.ARS, Currency.USD, SAMPLE_PIVOT);
    // currency === displayCurrency (USD === USD) → retorna amountCents
    expect(result).toBe(1000);
  });

  it('[BUG-FIX] ARS movimiento, anchor=ARS, display=USD: re-rutea vía pivot', () => {
    // Movimiento: 1432 ARS (143200 centavos ARS) guardado con anchor=ARS, exchangeRate=1
    // Usuario ahora tiene default=USD
    // Fórmula: 143200 × 1 × (rate_USD / rate_ARS) = 143200 × (1 / 1432) = 100 centavos USD
    const result = convertToDisplayCurrency(143200, Currency.ARS, 1, Currency.ARS, Currency.USD, SAMPLE_PIVOT);
    expect(result).toBe(Math.round(143200 * 1 * (1 / 1432)));
    expect(result).toBe(100); // 1 USD exacto
  });

  it('[BUG-FIX] ARS movimiento, anchor=ARS, display=EUR: re-rutea vía pivot', () => {
    // 143200 centavos ARS, anchor=ARS, exchangeRate=1, display=EUR
    // Fórmula: 143200 × 1 × (rate_EUR / rate_ARS) = 143200 × (0.865 / 1432) ≈ 86.5 → 87
    const result = convertToDisplayCurrency(143200, Currency.ARS, 1, Currency.ARS, Currency.EUR, SAMPLE_PIVOT);
    expect(result).toBe(Math.round(143200 * 1 * (0.865 / 1432)));
  });

  it('[BUG-FIX] USD movimiento, anchor=USD, display=ARS: re-rutea vía pivot', () => {
    // Movimiento: 10 USD (1000 centavos) guardado cuando default=USD, exchangeRate=1
    // Usuario ahora tiene default=ARS
    // Fórmula: 1000 × 1 × (rate_ARS / rate_USD) = 1000 × (1432 / 1) = 1_432_000
    const result = convertToDisplayCurrency(1000, Currency.USD, 1, Currency.USD, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBe(Math.round(1000 * 1 * (1432 / 1)));
    expect(result).toBe(1_432_000);
  });

  it('[BUG-FIX] EUR movimiento, anchor=EUR, display=ARS: re-rutea vía pivot', () => {
    // Movimiento: 10 EUR (1000 centavos) guardado cuando default=EUR, exchangeRate=1
    // Usuario ahora tiene default=ARS
    // Fórmula: 1000 × 1 × (rate_ARS / rate_EUR) = 1000 × (1432 / 0.865) ≈ 1655.49 → round
    const result = convertToDisplayCurrency(1000, Currency.EUR, 1, Currency.EUR, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBe(Math.round(1000 * 1 * (1432 / 0.865)));
  });

  it('[BUG-FIX] BRL movimiento, anchor=BRL, display=USD: re-rutea vía pivot', () => {
    // 1000 centavos BRL, anchor=BRL, exchangeRate=1, display=USD
    // Fórmula: 1000 × 1 × (rate_USD / rate_BRL) = 1000 × (1 / 5.11) ≈ 195.7 → 196
    const result = convertToDisplayCurrency(1000, Currency.BRL, 1, Currency.BRL, Currency.USD, SAMPLE_PIVOT);
    expect(result).toBe(Math.round(1000 * (1 / 5.11)));
  });

  it('[BUG-FIX] cross EUR→BRL, anchor=ARS cambió a BRL: re-rutea', () => {
    // Movimiento: 1000 centavos EUR, guardado con anchor=ARS (exchangeRate = ARS/EUR = 1432/0.865)
    // Display: BRL
    // Fórmula: 1000 × (1432/0.865) × (rate_BRL / rate_ARS) = 1000 × (1432/0.865) × (5.11/1432)
    //        = 1000 × 5.11/0.865 ≈ 5907.5 → round
    const exchangeRate = SAMPLE_PIVOT.ARS / SAMPLE_PIVOT.EUR;
    const result = convertToDisplayCurrency(1000, Currency.EUR, exchangeRate, Currency.ARS, Currency.BRL, SAMPLE_PIVOT);
    const expected = Math.round(1000 * exchangeRate * (SAMPLE_PIVOT.BRL / SAMPLE_PIVOT.ARS));
    expect(result).toBe(expected);
  });

  // ── Caso 4: fallback (sin pivotRates) → usa exchangeRate directamente ────

  it('fallback: sin pivotRates, anchor ≠ display → usa exchangeRate directamente', () => {
    // Comportamiento idéntico a Fase 1.2.3 (antes de 1.2.4)
    const result = convertToDisplayCurrency(1000, Currency.USD, 1432, Currency.ARS, Currency.EUR, null);
    // Fallback: Math.round(1000 * 1432)
    expect(result).toBe(Math.round(1000 * 1432));
  });

  it('fallback: pivotRates vacío parcial, falta moneda display → usa exchangeRate', () => {
    // Solo tiene ARS pero falta EUR (display)
    const partialPivot = { ARS: 1432 };
    const result = convertToDisplayCurrency(1000, Currency.USD, 1432, Currency.ARS, Currency.EUR, partialPivot);
    expect(result).toBe(Math.round(1000 * 1432));
  });

  // ── Caso borde: exchangeRate 0 ────────────────────────────────────────────

  it('exchangeRate 0: devuelve 0 (guard defensivo)', () => {
    const result = convertToDisplayCurrency(1000, Currency.USD, 0, Currency.ARS, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBe(0);
  });

  // ── Redondeo ──────────────────────────────────────────────────────────────

  it('redondea a centavos enteros', () => {
    // 3 centavos EUR × (1432/0.865) ≈ 4.966 → 5
    const result = convertToDisplayCurrency(3, Currency.EUR, SAMPLE_PIVOT.ARS / SAMPLE_PIVOT.EUR, Currency.ARS, Currency.ARS, SAMPLE_PIVOT);
    expect(Number.isInteger(result)).toBe(true);
  });

  // ── BUG 1 FIX: currency === anchorCurrency con exchangeRate basura ────────
  //
  // Invariante: cuando currency === anchorCurrency, el resultado NO depende del
  // exchangeRate (el monto ya está en el anchor; exchangeRate es irrelevante).

  it('[BUG1] ARS→USD: currency===anchor, exchangeRate basura 1450 NO afecta resultado', () => {
    // Repro exacto del bug: ARS con anchor ARS, exchangeRate=1450 (basura de backfill),
    // display=USD, pivot ARS=1432.
    // Correcto: 8441697 × (1/1432) ≈ 5895 (US$58.95)
    // Incorrecto anterior: 8441697 × 1450 × (1/1432) ≈ 8_547_800 (US$85478)
    const result = convertToDisplayCurrency(8441697, Currency.ARS, 1450, Currency.ARS, Currency.USD, SAMPLE_PIVOT);
    const expected = Math.round(8441697 * (1 / SAMPLE_PIVOT.ARS));
    expect(result).toBe(expected);
    // El mismo resultado sin importar el exchangeRate
    const resultWithRate1 = convertToDisplayCurrency(8441697, Currency.ARS, 1, Currency.ARS, Currency.USD, SAMPLE_PIVOT);
    expect(result).toBe(resultWithRate1);
  });

  it('[BUG1] ARS (anchor ARS, rate basura 9999) → display EUR: resultado NO depende del exchangeRate', () => {
    const r1 = convertToDisplayCurrency(100000, Currency.ARS, 9999, Currency.ARS, Currency.EUR, SAMPLE_PIVOT);
    const r2 = convertToDisplayCurrency(100000, Currency.ARS, 1,    Currency.ARS, Currency.EUR, SAMPLE_PIVOT);
    const expected = Math.round(100000 * (SAMPLE_PIVOT.EUR / SAMPLE_PIVOT.ARS));
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
  });

  it('[BUG1] ARS (anchor ARS, rate basura) → display BRL: resultado NO depende del exchangeRate', () => {
    const r1 = convertToDisplayCurrency(50000, Currency.ARS, 777, Currency.ARS, Currency.BRL, SAMPLE_PIVOT);
    const r2 = convertToDisplayCurrency(50000, Currency.ARS, 1,   Currency.ARS, Currency.BRL, SAMPLE_PIVOT);
    const expected = Math.round(50000 * (SAMPLE_PIVOT.BRL / SAMPLE_PIVOT.ARS));
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
  });

  it('[BUG1] USD (anchor USD, rate basura 500) → display ARS: resultado NO depende del exchangeRate', () => {
    // Movimiento en USD, anchor=USD (usuario tenía default=USD), display=ARS
    // El monto ya está en USD (anchor); se convierte directamente a ARS via pivot.
    // valueInAnchor = amountCents (currency===anchor)
    // result = amountCents × (rate_ARS / rate_USD) = 1000 × (1432 / 1) = 1_432_000
    const r1 = convertToDisplayCurrency(1000, Currency.USD, 500, Currency.USD, Currency.ARS, SAMPLE_PIVOT);
    const r2 = convertToDisplayCurrency(1000, Currency.USD, 1,   Currency.USD, Currency.ARS, SAMPLE_PIVOT);
    const expected = Math.round(1000 * (SAMPLE_PIVOT.ARS / 1)); // rate_USD implícito = 1
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
    expect(r1).toBe(1_432_000);
  });

  it('[BUG1] USD (anchor USD, rate basura) → display EUR: resultado NO depende del exchangeRate', () => {
    const r1 = convertToDisplayCurrency(1000, Currency.USD, 9999, Currency.USD, Currency.EUR, SAMPLE_PIVOT);
    const r2 = convertToDisplayCurrency(1000, Currency.USD, 1,    Currency.USD, Currency.EUR, SAMPLE_PIVOT);
    const expected = Math.round(1000 * (SAMPLE_PIVOT.EUR / 1));
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
  });

  it('[BUG1] EUR (anchor EUR, rate basura) → display ARS: resultado NO depende del exchangeRate', () => {
    const r1 = convertToDisplayCurrency(1000, Currency.EUR, 9999, Currency.EUR, Currency.ARS, SAMPLE_PIVOT);
    const r2 = convertToDisplayCurrency(1000, Currency.EUR, 1,    Currency.EUR, Currency.ARS, SAMPLE_PIVOT);
    const expected = Math.round(1000 * (SAMPLE_PIVOT.ARS / SAMPLE_PIVOT.EUR));
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
  });

  it('[BUG1] BRL (anchor BRL, rate basura) → display USD: resultado NO depende del exchangeRate', () => {
    const r1 = convertToDisplayCurrency(1000, Currency.BRL, 9999, Currency.BRL, Currency.USD, SAMPLE_PIVOT);
    const r2 = convertToDisplayCurrency(1000, Currency.BRL, 1,    Currency.BRL, Currency.USD, SAMPLE_PIVOT);
    const expected = Math.round(1000 * (1 / SAMPLE_PIVOT.BRL));
    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
  });

  it('[BUG1] casos donde currency≠anchor SÍ usan exchangeRate (ramas no afectadas)', () => {
    // USD con anchor ARS: el exchangeRate SÍ debe multiplicar (currency≠anchor)
    const r = convertToDisplayCurrency(1000, Currency.USD, 1450, Currency.ARS, Currency.EUR, SAMPLE_PIVOT);
    // valueInAnchor = 1000 × 1450 = 1_450_000 ARS
    // result = 1_450_000 × (EUR_rate / ARS_rate) = 1_450_000 × (0.865/1432)
    const expected = Math.round(1000 * 1450 * (SAMPLE_PIVOT.EUR / SAMPLE_PIVOT.ARS));
    expect(r).toBe(expected);
  });

  // ── Matrices de todas las combinaciones de 4 monedas ─────────────────────

  const CURRENCIES = [Currency.ARS, Currency.USD, Currency.EUR, Currency.BRL];

  it.each(CURRENCIES.flatMap(c => CURRENCIES.map(d => [c, d])))(
    'currency=%s, display=%s, anchor=ARS (back-compat): no lanza',
    (currency, displayCurrency) => {
      // El movimiento fue guardado con anchor=ARS (todos los existentes)
      // Verificar que la función no lanza para ninguna combinación
      const exchangeRate = currency === Currency.ARS ? 1 : 1432; // mock simple
      expect(() => {
        convertToDisplayCurrency(1000, currency, exchangeRate, Currency.ARS, displayCurrency, SAMPLE_PIVOT);
      }).not.toThrow();
    }
  );
});

// ---------------------------------------------------------------------------
// convertToDefaultCurrency
// ---------------------------------------------------------------------------

describe('convertToDefaultCurrency', () => {
  // ── Back-compat Fase 1.2.3: par ARS/USD ──────────────────────────────────

  it('[back-compat] currency === defaultCurrency (ARS→ARS): sin cambio', () => {
    expect(convertToDefaultCurrency(150000, Currency.ARS, 1432, Currency.ARS)).toBe(150000);
  });

  it('[back-compat] currency === defaultCurrency (USD→USD): sin cambio', () => {
    expect(convertToDefaultCurrency(1000, Currency.USD, 1, Currency.USD)).toBe(1000);
  });

  it('[back-compat] USD→ARS: amountCents * exchangeRate', () => {
    // 10 USD (1000 centavos) * 1432 ARS/USD = 1_432_000 centavos ARS
    expect(convertToDefaultCurrency(1000, Currency.USD, 1432, Currency.ARS)).toBe(1_432_000);
  });

  it('[back-compat] ARS→USD: amountCents * exchangeRate (rate pequeño)', () => {
    // 1432 ARS (143200 centavos) * (1/1432) USD/ARS
    // Con exchangeRate = 1/1432 ≈ 0.000698...
    const rate = 1 / 1432;
    const result = convertToDefaultCurrency(143200, Currency.ARS, rate, Currency.USD);
    // Esperado: 143200 * (1/1432) ≈ 100 centavos USD (1 USD)
    expect(result).toBe(100);
  });

  // ── Fase 1.2.4: monedas EUR y BRL ────────────────────────────────────────

  it('EUR→ARS: multiply by exchangeRate (EUR/ARS cross)', () => {
    // 1 EUR = 1432/0.865 ≈ 1655.49 ARS; exchangeRate ≈ 1655.49
    const rate = SAMPLE_PIVOT.ARS / SAMPLE_PIVOT.EUR; // ≈ 1655.49
    // 10 EUR = 1000 centavos EUR
    const result = convertToDefaultCurrency(1000, Currency.EUR, rate, Currency.ARS);
    // 1000 * 1655.49 ≈ 1_655_491 → round
    expect(result).toBe(Math.round(1000 * rate));
  });

  it('BRL→ARS: multiply by exchangeRate', () => {
    // 1 BRL = 1432/5.11 ≈ 280.23 ARS
    const rate = SAMPLE_PIVOT.ARS / SAMPLE_PIVOT.BRL; // ≈ 280.23
    const result = convertToDefaultCurrency(1000, Currency.BRL, rate, Currency.ARS);
    expect(result).toBe(Math.round(1000 * rate));
  });

  it('EUR→USD: multiply by exchangeRate', () => {
    // 1 EUR = 1/0.865 ≈ 1.156 USD
    const rate = 1 / SAMPLE_PIVOT.EUR; // ≈ 1.156
    const result = convertToDefaultCurrency(1000, Currency.EUR, rate, Currency.USD);
    expect(result).toBe(Math.round(1000 * rate));
  });

  it('USD→EUR: multiply by exchangeRate (rate < 1)', () => {
    // 1 USD = 0.865 EUR
    const rate = SAMPLE_PIVOT.EUR; // 0.865
    const result = convertToDefaultCurrency(1000, Currency.USD, rate, Currency.EUR);
    expect(result).toBe(Math.round(1000 * 0.865)); // 865
  });

  it('BRL→USD: multiply by exchangeRate', () => {
    // 1 BRL = 1/5.11 ≈ 0.1957 USD
    const rate = 1 / SAMPLE_PIVOT.BRL;
    const result = convertToDefaultCurrency(1000, Currency.BRL, rate, Currency.USD);
    expect(result).toBe(Math.round(1000 / 5.11));
  });

  it('EUR→BRL: cross via pivote', () => {
    // 1 EUR = (BRL_rate / EUR_rate) = 5.11 / 0.865 ≈ 5.907 BRL
    const rate = SAMPLE_PIVOT.BRL / SAMPLE_PIVOT.EUR;
    const result = convertToDefaultCurrency(1000, Currency.EUR, rate, Currency.BRL);
    expect(result).toBe(Math.round(1000 * rate));
  });

  it('currency === defaultCurrency (EUR→EUR): sin cambio', () => {
    expect(convertToDefaultCurrency(5000, Currency.EUR, 1, Currency.EUR)).toBe(5000);
  });

  it('currency === defaultCurrency (BRL→BRL): sin cambio', () => {
    expect(convertToDefaultCurrency(3000, Currency.BRL, 1, Currency.BRL)).toBe(3000);
  });

  it('exchangeRate 0: devuelve 0 (guard defensivo)', () => {
    expect(convertToDefaultCurrency(1000, Currency.USD, 0, Currency.ARS)).toBe(0);
  });

  it('redondea a centavos enteros (no deja fracciones)', () => {
    // 1 EUR = 1432/0.865 = 1655.4913...
    const rate = SAMPLE_PIVOT.ARS / SAMPLE_PIVOT.EUR;
    const result = convertToDefaultCurrency(3, Currency.EUR, rate, Currency.ARS);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deriveExchangeRate
// ---------------------------------------------------------------------------

describe('deriveExchangeRate', () => {
  it('currency === defaultCurrency: siempre 1', () => {
    expect(deriveExchangeRate(Currency.ARS, Currency.ARS, SAMPLE_PIVOT)).toBe(1);
    expect(deriveExchangeRate(Currency.USD, Currency.USD, SAMPLE_PIVOT)).toBe(1);
    expect(deriveExchangeRate(Currency.EUR, Currency.EUR, SAMPLE_PIVOT)).toBe(1);
    expect(deriveExchangeRate(Currency.BRL, Currency.BRL, SAMPLE_PIVOT)).toBe(1);
  });

  it('USD→ARS: rate_ARS / rate_USD = 1432 / 1 = 1432', () => {
    const result = deriveExchangeRate(Currency.USD, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(1432, 4);
  });

  it('ARS→USD: rate_USD / rate_ARS = 1 / 1432 ≈ 0.000698', () => {
    const result = deriveExchangeRate(Currency.ARS, Currency.USD, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(1 / 1432, 8);
  });

  it('USD→EUR: rate_EUR / rate_USD = 0.865 / 1 = 0.865', () => {
    const result = deriveExchangeRate(Currency.USD, Currency.EUR, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(0.865, 4);
  });

  it('EUR→USD: rate_USD / rate_EUR = 1 / 0.865 ≈ 1.156', () => {
    const result = deriveExchangeRate(Currency.EUR, Currency.USD, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(1 / 0.865, 4);
  });

  it('EUR→ARS: rate_ARS / rate_EUR = 1432 / 0.865 ≈ 1655.49', () => {
    const result = deriveExchangeRate(Currency.EUR, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(1432 / 0.865, 4);
  });

  it('ARS→EUR: rate_EUR / rate_ARS = 0.865 / 1432 ≈ 0.000604', () => {
    const result = deriveExchangeRate(Currency.ARS, Currency.EUR, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(0.865 / 1432, 8);
  });

  it('BRL→ARS: rate_ARS / rate_BRL = 1432 / 5.11 ≈ 280.23', () => {
    const result = deriveExchangeRate(Currency.BRL, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(1432 / 5.11, 4);
  });

  it('EUR→BRL: rate_BRL / rate_EUR = 5.11 / 0.865 ≈ 5.907', () => {
    const result = deriveExchangeRate(Currency.EUR, Currency.BRL, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(5.11 / 0.865, 4);
  });

  it('sin datos de pivote: devuelve null', () => {
    const result = deriveExchangeRate(Currency.USD, Currency.ARS, null);
    expect(result).toBeNull();
  });

  it('moneda no disponible en el pivote parcial: devuelve null', () => {
    const partial: Partial<PivotRates> = { ARS: 1432 }; // falta EUR
    const result = deriveExchangeRate(Currency.EUR, Currency.ARS, partial);
    expect(result).toBeNull();
  });

  it('USD como currency con pivote disponible (USD implícito=1): OK', () => {
    const result = deriveExchangeRate(Currency.USD, Currency.ARS, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(1432, 4);
  });

  it('USD como defaultCurrency con pivote disponible: OK', () => {
    const result = deriveExchangeRate(Currency.BRL, Currency.USD, SAMPLE_PIVOT);
    expect(result).toBeCloseTo(1 / 5.11, 6);
  });

  it('pivote vacío (sin monedas): devuelve null para cruce no-USD', () => {
    const result = deriveExchangeRate(Currency.EUR, Currency.ARS, {});
    expect(result).toBeNull();
  });

  it('back-compat Fase 1.2.3: USD→ARS con pivot solo ARS disponible = 1432', () => {
    // Escenario donde solo tenemos la cotización ARS en el pivote
    const partial: Partial<PivotRates> = { ARS: 1432 };
    const result = deriveExchangeRate(Currency.USD, Currency.ARS, partial);
    // USD es implícito (rate=1), ARS=1432 → 1432/1 = 1432
    expect(result).toBeCloseTo(1432, 4);
  });
});

// ---------------------------------------------------------------------------
// Fallback endurecido: currency === anchorCurrency sin pivotRates → no infla
// ---------------------------------------------------------------------------
//
// Escenario del bug: ARS con anchor=ARS y exchangeRate=1450 (basura de backfill),
// visto en USD sin rates disponibles. El fallback viejo hacía amount×1450 → inflación.
// El nuevo fallback devuelve amountCents cuando currency===anchorCurrency.

describe('convertToDisplayCurrency — fallback sin pivotRates (tabla vacía)', () => {
  it('[CLAMP-FIX] ARS (anchor ARS, exchangeRate basura 1450) → USD sin rates: devuelve amountCents', () => {
    // Bug original: 8_441_697 × 1450 ≈ 12_240_460_650 (12 mil millones). INCORRECTO.
    // Corrección: cuando currency===anchorCurrency, el monto ya está en el anchor.
    // Sin rates no podemos convertir a USD, pero devolvemos amountCents en vez de inflar.
    const result = convertToDisplayCurrency(
      8_441_697,
      Currency.ARS,
      1450,          // exchangeRate basura
      Currency.ARS,  // anchorCurrency
      Currency.USD,  // displayCurrency diferente
      null,          // sin pivotRates (tabla vacía)
    );
    // No miles de millones — el resultado es el amountCents original
    expect(result).toBe(8_441_697);
    expect(result).toBeLessThan(100_000_000); // sanity check: < 1M USD
  });

  it('[CLAMP-FIX] ARS (anchor ARS, exchangeRate=1) → EUR sin rates: devuelve amountCents', () => {
    const result = convertToDisplayCurrency(100_000, Currency.ARS, 1, Currency.ARS, Currency.EUR, null);
    expect(result).toBe(100_000);
  });

  it('[CLAMP-FIX] USD (anchor USD, exchangeRate basura 500) → ARS sin rates: devuelve amountCents', () => {
    // currency===anchor=USD, display=ARS. Sin rates, devuelve amountCents (degradado, no infla).
    const result = convertToDisplayCurrency(1000, Currency.USD, 500, Currency.USD, Currency.ARS, null);
    expect(result).toBe(1000);
  });

  it('[CLAMP-FIX] EUR (anchor EUR, exchangeRate basura 9999) → BRL sin rates: devuelve amountCents', () => {
    const result = convertToDisplayCurrency(5000, Currency.EUR, 9999, Currency.EUR, Currency.BRL, null);
    expect(result).toBe(5000);
  });

  it('currency ≠ anchorCurrency sin rates: mantiene amount×exchangeRate (correcto si anchor=display)', () => {
    // USD con anchor ARS sin rates: el exchangeRate sí importa
    // (correcto cuando anchorCurrency===displayCurrency, que es el único caso donde esto se llama
    // sin que el clamp haya actuado)
    const result = convertToDisplayCurrency(1000, Currency.USD, 1432, Currency.ARS, Currency.ARS, null);
    // anchorCurrency === displayCurrency → caso 2, NO llega al fallback
    expect(result).toBe(Math.round(1000 * 1432));
  });

  it('[CLAMP-FIX] ARS en mes futuro 2026-09 (rates de 2026-06): resultado sensato con rates del clamp', () => {
    // Simula lo que pasa DESPUÉS del clamp: llegan las pivot rates de 2026-06
    // (el mes más cercano disponible cuando se pide 2026-09).
    // ARS 8.4M con anchor ARS, display=USD, usando rates 2026-06.
    const ratesJun2026: PivotRates = { ARS: 1450, BRL: 5.15, EUR: 0.87 };
    const result = convertToDisplayCurrency(
      8_441_697,
      Currency.ARS,
      1,             // exchangeRate correcto para ARS→ARS
      Currency.ARS,
      Currency.USD,
      ratesJun2026,
    );
    // Esperado: 8_441_697 × (1 / 1450) ≈ 5822 centavos USD (≈ USD 58.22)
    const expected = Math.round(8_441_697 * (1 / 1450));
    expect(result).toBe(expected);
    expect(result).toBeLessThan(100_000); // < USD 1000, claramente sensato
  });

  it('[CLAMP-FIX] ARS en mes futuro → BRL: resultado sensato con rates del clamp', () => {
    const ratesJun2026: PivotRates = { ARS: 1450, BRL: 5.15, EUR: 0.87 };
    const result = convertToDisplayCurrency(
      8_441_697,
      Currency.ARS,
      1450,          // exchangeRate basura
      Currency.ARS,
      Currency.BRL,
      ratesJun2026,
    );
    // currency===anchor → valueInAnchor = amountCents = 8_441_697 ARS
    // result = 8_441_697 × (5.15 / 1450) ≈ 29_940
    const expected = Math.round(8_441_697 * (5.15 / 1450));
    expect(result).toBe(expected);
    expect(result).toBeLessThan(1_000_000); // sanity
  });
});

// ---------------------------------------------------------------------------
// resolveNearestYearMonth
// ---------------------------------------------------------------------------

describe('resolveNearestYearMonth', () => {
  // Simula el rango del seed: 2025-01 a 2026-06
  const AVAILABLE_MONTHS: string[] = [];
  for (let y = 2025; y <= 2026; y++) {
    const maxM = y === 2026 ? 6 : 12;
    for (let m = 1; m <= maxM; m++) {
      AVAILABLE_MONTHS.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  // AVAILABLE_MONTHS: ['2025-01', ..., '2025-12', '2026-01', ..., '2026-06'] = 18 meses

  it('mes exactamente disponible: se devuelve tal cual', () => {
    expect(resolveNearestYearMonth('2026-06', AVAILABLE_MONTHS)).toBe('2026-06');
    expect(resolveNearestYearMonth('2025-01', AVAILABLE_MONTHS)).toBe('2025-01');
    expect(resolveNearestYearMonth('2025-06', AVAILABLE_MONTHS)).toBe('2025-06');
  });

  it('mes futuro (posterior al máximo): usa el máximo disponible (2026-06)', () => {
    expect(resolveNearestYearMonth('2026-07', AVAILABLE_MONTHS)).toBe('2026-06');
    expect(resolveNearestYearMonth('2026-09', AVAILABLE_MONTHS)).toBe('2026-06');
    expect(resolveNearestYearMonth('2026-12', AVAILABLE_MONTHS)).toBe('2026-06');
    expect(resolveNearestYearMonth('2027-01', AVAILABLE_MONTHS)).toBe('2026-06');
    expect(resolveNearestYearMonth('2030-12', AVAILABLE_MONTHS)).toBe('2026-06');
  });

  it('mes pasado (anterior al mínimo): usa el mínimo disponible (2025-01)', () => {
    expect(resolveNearestYearMonth('2024-12', AVAILABLE_MONTHS)).toBe('2025-01');
    expect(resolveNearestYearMonth('2024-06', AVAILABLE_MONTHS)).toBe('2025-01');
    expect(resolveNearestYearMonth('2023-01', AVAILABLE_MONTHS)).toBe('2025-01');
    expect(resolveNearestYearMonth('2020-01', AVAILABLE_MONTHS)).toBe('2025-01');
  });

  it('lista con un solo mes: siempre devuelve ese mes', () => {
    expect(resolveNearestYearMonth('2024-01', ['2025-06'])).toBe('2025-06');
    expect(resolveNearestYearMonth('2027-12', ['2025-06'])).toBe('2025-06');
    expect(resolveNearestYearMonth('2025-06', ['2025-06'])).toBe('2025-06');
  });

  it('lista vacía: devuelve null', () => {
    expect(resolveNearestYearMonth('2026-09', [])).toBeNull();
  });

  it('hueco intermedio: resuelve al más cercano', () => {
    // Lista con hueco en 2025-06
    const withGap = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05',
                     '2025-07', '2025-08'];
    // 2025-06 cae entre 2025-05 y 2025-07, equidistante → el primero (sort)
    const result = resolveNearestYearMonth('2025-06', withGap);
    // dist a 2025-05 = 1, dist a 2025-07 = 1 → empate → primero al ordenar ('2025-05')
    expect(result).toBe('2025-05');
  });

  it('hueco: el más cercano es el posterior si está más cerca', () => {
    // Lista sin 2025-06 pero 2025-07 está más cerca de 2025-06 que 2025-03
    const sparse = ['2025-03', '2025-07'];
    // 2025-06: dist a 2025-03 = 3 meses, dist a 2025-07 = 1 mes → 2025-07
    expect(resolveNearestYearMonth('2025-06', sparse)).toBe('2025-07');
  });

  it('no modifica el array original (usa copia para ordenar)', () => {
    const arr = ['2026-06', '2025-01', '2025-06'];
    resolveNearestYearMonth('2026-09', arr);
    // El array original no debe estar ordenado por la función
    expect(arr[0]).toBe('2026-06');
  });
});

// ---------------------------------------------------------------------------
// buildPivotRates
// ---------------------------------------------------------------------------

describe('buildPivotRates', () => {
  it('construye el objeto desde filas completas', () => {
    const rows = [
      { currency: Currency.ARS, rate: 1432 },
      { currency: Currency.BRL, rate: 5.11 },
      { currency: Currency.EUR, rate: 0.865 },
    ];
    const result = buildPivotRates(rows);
    expect(result).toEqual({ ARS: 1432, BRL: 5.11, EUR: 0.865 });
  });

  it('ignora filas USD (no tiene fila en ReferenceRate)', () => {
    const rows = [
      { currency: Currency.ARS, rate: 1432 },
      { currency: Currency.USD, rate: 1 }, // nunca debería llegar, pero no falla
    ];
    const result = buildPivotRates(rows);
    expect(result).toEqual({ ARS: 1432 }); // USD no entra
  });

  it('set parcial (solo ARS): devuelve solo ARS', () => {
    const rows = [{ currency: Currency.ARS, rate: 1390 }];
    const result = buildPivotRates(rows);
    expect(result).toEqual({ ARS: 1390 });
  });

  it('filas vacías: devuelve objeto vacío', () => {
    expect(buildPivotRates([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Consistencia entre convertToDefaultCurrency y deriveExchangeRate
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// convertToDisplayCurrencyByMonth (Ola 1 / P3 — TC por mes para fijos/cuotas)
// ---------------------------------------------------------------------------
//
// La función ignora el exchangeRate/anchorCurrency guardados y deriva la
// cotización al vuelo desde los pivotRates del mes. Esto garantiza que cada
// instancia mensual de un fijo/cuota se convierte con el TC oficial del mes,
// no con el TC congelado al momento de la carga.

describe('convertToDisplayCurrencyByMonth', () => {
  // ── Caso 1: misma moneda → sin conversión ──────────────────────────────

  it('currency === displayCurrency (ARS→ARS): devuelve amountCents sin cambio', () => {
    // El exchangeRate guardado es irrelevante cuando la moneda ya es la del display.
    const result = convertToDisplayCurrencyByMonth(
      150000, Currency.ARS, Currency.ARS,
      SAMPLE_PIVOT, 9999, Currency.USD, // fallback con basura — no debe usarse
    );
    expect(result).toBe(150000);
  });

  it('currency === displayCurrency (USD→USD): devuelve amountCents sin cambio', () => {
    const result = convertToDisplayCurrencyByMonth(
      1000, Currency.USD, Currency.USD,
      SAMPLE_PIVOT, 1432, Currency.ARS,
    );
    expect(result).toBe(1000);
  });

  // ── Caso clave P3: TC del mes ignora el exchangeRate guardado ───────────
  //
  // Un fijo en USD cargado hace 6 meses con TC=1000 ARS/USD, pero hoy el
  // TC oficial del mes es 1432 ARS/USD. La función debe usar 1432, no 1000.

  it('[P3] USD fijo, TC mes=1432, TC guardado=1000: usa el TC del mes (1432)', () => {
    const pivotDelMes: PivotRates = { ARS: 1432, BRL: 5.11, EUR: 0.865 };
    const result = convertToDisplayCurrencyByMonth(
      1000,            // 10 USD
      Currency.USD,
      Currency.ARS,
      pivotDelMes,
      1000,            // TC guardado VIEJO — no debe usarse
      Currency.ARS,
    );
    // Debe derivar: rate_ARS / rate_USD = 1432 / 1 = 1432
    // 1000 centavos USD × 1432 = 1_432_000 centavos ARS
    expect(result).toBe(1_432_000);
  });

  it('[P3] USD cuota, TC mes=1600, TC guardado=1200: usa el TC del mes (1600)', () => {
    const pivotDelMes: PivotRates = { ARS: 1600, BRL: 5.20, EUR: 0.90 };
    const result = convertToDisplayCurrencyByMonth(
      500,             // 5 USD
      Currency.USD,
      Currency.ARS,
      pivotDelMes,
      1200,            // TC guardado VIEJO
      Currency.ARS,
    );
    // 500 × (1600/1) = 800_000
    expect(result).toBe(800_000);
  });

  it('[P3] EUR fijo: TC mes distinto del guardado, usa el del mes', () => {
    // TC actual del mes: EUR/USD=0.90, ARS/USD=1500
    // TC guardado: 1432/0.865 ≈ 1655 ARS/EUR (viejo)
    const pivotDelMes: PivotRates = { ARS: 1500, BRL: 5.20, EUR: 0.90 };
    const guardadoExchangeRate = 1432 / 0.865; // ~1655 (viejo)
    const result = convertToDisplayCurrencyByMonth(
      1000,            // 10 EUR
      Currency.EUR,
      Currency.ARS,
      pivotDelMes,
      guardadoExchangeRate,
      Currency.ARS,
    );
    // Debe usar TC del mes: ARS/EUR = 1500 / 0.90 = 1666.67 → round
    expect(result).toBe(Math.round(1000 * (1500 / 0.90)));
    // NO debe usar el guardado (1655)
    expect(result).not.toBe(Math.round(1000 * guardadoExchangeRate));
  });

  it('[P3] ARS fijo, display=USD: usa TC del mes, ignora el guardado', () => {
    const pivotDelMes: PivotRates = { ARS: 1432, BRL: 5.11, EUR: 0.865 };
    const result = convertToDisplayCurrencyByMonth(
      143200,          // 1432 ARS
      Currency.ARS,
      Currency.USD,
      pivotDelMes,
      1,               // exchangeRate guardado (ARS/ARS = 1)
      Currency.ARS,
    );
    // ARS → USD: rate_USD / rate_ARS = 1 / 1432 → 143200 × (1/1432) = 100
    expect(result).toBe(100); // 1 USD exacto
  });

  // ── El exchangeRate guardado no afecta el resultado con pivotRates ──────

  it('el resultado es idéntico independientemente del exchangeRate guardado', () => {
    const pivot: PivotRates = { ARS: 1432, BRL: 5.11, EUR: 0.865 };
    // Con TC guardado 1000 (viejo)
    const r1 = convertToDisplayCurrencyByMonth(1000, Currency.USD, Currency.ARS, pivot, 1000, Currency.ARS);
    // Con TC guardado 1500 (también viejo, distinto)
    const r2 = convertToDisplayCurrencyByMonth(1000, Currency.USD, Currency.ARS, pivot, 1500, Currency.ARS);
    // Con anchorCurrency distinto
    const r3 = convertToDisplayCurrencyByMonth(1000, Currency.USD, Currency.ARS, pivot, 1000, Currency.USD);
    // Todos deben dar el mismo resultado: 1000 × (1432/1) = 1_432_000
    expect(r1).toBe(1_432_000);
    expect(r2).toBe(1_432_000);
    expect(r3).toBe(1_432_000);
  });

  // ── Fallback cuando pivotRates es null (tabla vacía) ────────────────────

  it('fallback (pivotRates null, currency≠anchor): delega a convertToDisplayCurrency con guardado', () => {
    // Sin rates, delega al comportamiento anterior
    // currency=USD, anchor=ARS, exchangeRate=1432, display=ARS → amount × 1432
    const result = convertToDisplayCurrencyByMonth(
      1000, Currency.USD, Currency.ARS,
      null,    // tabla vacía
      1432,    // fallback exchangeRate
      Currency.ARS,  // fallback anchor
    );
    expect(result).toBe(Math.round(1000 * 1432));
  });

  it('fallback (pivotRates null, currency===anchor): devuelve amountCents sin inflar', () => {
    // ARS con anchor ARS sin rates → el monto ya está en ARS
    const result = convertToDisplayCurrencyByMonth(
      8_441_697, Currency.ARS, Currency.USD,
      null,      // tabla vacía
      1450,      // exchangeRate basura
      Currency.ARS,
    );
    // No debe inflar: el fallback de convertToDisplayCurrency detecta currency===anchor
    expect(result).toBe(8_441_697);
  });

  // ── Fallback cuando pivotRates parcial (falta la moneda) ────────────────

  it('fallback (pivotRates sin la moneda display): delega al comportamiento guardado', () => {
    // pivotRates tiene solo ARS, falta EUR (display)
    const partialPivot: Partial<PivotRates> = { ARS: 1432 }; // sin EUR
    // USD → EUR: deriveExchangeRate no puede completar el cruce → fallback
    const result = convertToDisplayCurrencyByMonth(
      1000, Currency.USD, Currency.EUR,
      partialPivot,
      1432,           // fallback exchangeRate (USD→ARS guardado)
      Currency.ARS,   // fallback anchor
    );
    // Fallback: convertToDisplayCurrency(1000, USD, 1432, ARS, EUR, null)
    // → currency≠anchor, sin pivotRates → Math.round(1000 × 1432) (comportamiento viejo)
    expect(result).toBe(Math.round(1000 * 1432));
  });

  // ── Redondeo ─────────────────────────────────────────────────────────────

  it('redondea a centavos enteros', () => {
    const pivot: PivotRates = { ARS: 1432, BRL: 5.11, EUR: 0.865 };
    const result = convertToDisplayCurrencyByMonth(3, Currency.EUR, Currency.ARS, pivot, 1, Currency.ARS);
    // 3 × (1432/0.865) no es entero → debe redondear
    expect(Number.isInteger(result)).toBe(true);
  });

  // ── Cruce no trivial (EUR → BRL) por mes ─────────────────────────────────

  it('[P3] EUR cuota, display=BRL: cruza vía pivote USD usando TC del mes', () => {
    const pivotDelMes: PivotRates = { ARS: 1432, BRL: 5.11, EUR: 0.865 };
    const result = convertToDisplayCurrencyByMonth(
      1000, Currency.EUR, Currency.BRL,
      pivotDelMes,
      9999,  // TC guardado basura
      Currency.ARS,
    );
    // EUR → BRL: rate_BRL / rate_EUR = 5.11 / 0.865 ≈ 5.907
    expect(result).toBe(Math.round(1000 * (5.11 / 0.865)));
  });
});

describe('consistencia: deriveExchangeRate + convertToDefaultCurrency', () => {
  it('10 USD → ARS con rate de referencia', () => {
    const exchangeRate = deriveExchangeRate(Currency.USD, Currency.ARS, SAMPLE_PIVOT)!;
    const result = convertToDefaultCurrency(1000, Currency.USD, exchangeRate, Currency.ARS);
    // 1000 centavos USD × 1432 ≈ 1_432_000 centavos ARS
    expect(result).toBe(Math.round(1000 * 1432));
  });

  it('10 EUR → ARS con rate de referencia', () => {
    const exchangeRate = deriveExchangeRate(Currency.EUR, Currency.ARS, SAMPLE_PIVOT)!;
    const result = convertToDefaultCurrency(1000, Currency.EUR, exchangeRate, Currency.ARS);
    expect(result).toBe(Math.round(1000 * (1432 / 0.865)));
  });

  it('10 BRL → USD con rate de referencia', () => {
    const exchangeRate = deriveExchangeRate(Currency.BRL, Currency.USD, SAMPLE_PIVOT)!;
    const result = convertToDefaultCurrency(1000, Currency.BRL, exchangeRate, Currency.USD);
    expect(result).toBe(Math.round(1000 / 5.11));
  });

  it('misma moneda: exchangeRate=1, monto sin cambio', () => {
    const exchangeRate = deriveExchangeRate(Currency.EUR, Currency.EUR, SAMPLE_PIVOT)!;
    expect(exchangeRate).toBe(1);
    const result = convertToDefaultCurrency(5000, Currency.EUR, exchangeRate, Currency.EUR);
    expect(result).toBe(5000);
  });
});
