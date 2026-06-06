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
