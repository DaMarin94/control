/**
 * Tests unitarios de la regresión lineal de RF-SIM-002/RN-028
 * (common/projection.helper.ts — fitCategoryRegression / evaluateRegressionAt).
 */
import { fitCategoryRegression, evaluateRegressionAt } from '../../../src/common/projection.helper';

describe('fitCategoryRegression / evaluateRegressionAt (RN-028)', () => {
  it('recta perfecta y = 2x (12 puntos, posiciones 1..12): ajusta slope=2, intercept=0', () => {
    const monthlyTotals = Array.from({ length: 12 }, (_, i) => 2 * (i + 1));
    const fit = fitCategoryRegression(monthlyTotals);

    expect(fit.slope).toBeCloseTo(2, 6);
    expect(fit.intercept).toBeCloseTo(0, 6);
  });

  it('serie constante (sin tendencia): slope=0, intercept=el valor constante', () => {
    const monthlyTotals = Array(12).fill(500);
    const fit = fitCategoryRegression(monthlyTotals);

    expect(fit.slope).toBeCloseTo(0, 6);
    expect(fit.intercept).toBeCloseTo(500, 6);
  });

  it('evalúa (extrapola) en la posición del mes en curso (13) y en meses futuros (14, 15, ...)', () => {
    // y = 2x exactos en 1..12 → extrapolado: x=13 → 26, x=14 → 28.
    const monthlyTotals = Array.from({ length: 12 }, (_, i) => 2 * (i + 1));
    const fit = fitCategoryRegression(monthlyTotals);

    expect(evaluateRegressionAt(fit, 13)).toBeCloseTo(26, 6);
    expect(evaluateRegressionAt(fit, 14)).toBeCloseTo(28, 6);
  });

  it('meses SIN únicos valen 0 y entran igual al ajuste (RN-028: la ausencia es dato)', () => {
    // 3 meses con dato ($300 cada uno, posiciones 10,11,12), 9 en 0 (posiciones 1..9).
    const monthlyTotals = [0, 0, 0, 0, 0, 0, 0, 0, 0, 300, 300, 300];
    const fit = fitCategoryRegression(monthlyTotals);

    // Tendencia positiva (los últimos meses concentran el gasto): slope > 0.
    expect(fit.slope).toBeGreaterThan(0);
  });

  it('signo del valor evaluado define la dirección (RN-028): negativo → gasto, positivo → ingreso', () => {
    // Serie de gastos (signo negativo, RN-028: "ingresos +, gastos −") con tendencia estable.
    const gastoTotals = Array(12).fill(-1000);
    const fitGasto = fitCategoryRegression(gastoTotals);
    expect(evaluateRegressionAt(fitGasto, 14)).toBeLessThan(0);

    const ingresoTotals = Array(12).fill(1000);
    const fitIngreso = fitCategoryRegression(ingresoTotals);
    expect(evaluateRegressionAt(fitIngreso, 14)).toBeGreaterThan(0);
  });

  it('serie degenerada de un solo punto no nulo no rompe (n=12 siempre, denom != 0 salvo x constante)', () => {
    const monthlyTotals = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1200];
    const fit = fitCategoryRegression(monthlyTotals);
    expect(Number.isFinite(fit.slope)).toBe(true);
    expect(Number.isFinite(fit.intercept)).toBe(true);
  });
});
