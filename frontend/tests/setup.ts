/**
 * Setup global de Vitest.
 * Se ejecuta antes de cada archivo de test.
 */

import "@testing-library/jest-dom";

// Configurar el entorno de testing de React 19 para que los act() warnings
// se muestren correctamente. IS_REACT_ACT_ENVIRONMENT indica a React que
// está en un entorno de testing y habilita los warnings de act().
// @ts-expect-error - variable global de React Testing
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom no implementa window.matchMedia — requerido por el hook useReducedMotion
// del widget de gráfico anual (y potencialmente otros hooks que lean media queries).
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom no implementa ResizeObserver — requerido por ChartLegend (scrollable)
// para detectar overflow de la región de chips. El stub no-op es suficiente para
// los tests que no necesitan medir layout real; los tests que necesitan el callback
// inyectan su propio mock por test (globalThis.ResizeObserver = class {...}).
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
