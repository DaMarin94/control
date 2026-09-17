/**
 * Gate de arranque del backend — sonda y señal de "backend inalcanzable".
 * (docs/design.md §"Gate de arranque del backend").
 *
 * Por qué existe: el backend vive en el plan free de Render, que suspende el
 * servicio tras ~15 min de inactividad. El primer request después de eso tarda
 * ~50s en levantar el contenedor; sin esta superficie la app se lee como
 * colgada.
 *
 * Este módulo NO renderiza nada: expone (a) la sonda contra `GET /health`
 * —endpoint `@Public()` del backend, sin auth— y (b) un pub/sub a nivel de
 * módulo para que el manejo centralizado de errores de React Query
 * (`src/lib/react-query.tsx`) pueda levantar el gate "en caliente" cuando una
 * llamada normal de la app falla por red (ApiError 503, emitido por el bloque
 * `catch (networkError)` de `src/lib/api.ts`). Mismo patrón que `emitToast`:
 * un único punto de enganche, sin repetir el chequeo en cada hook.
 */

/** Sin respuesta en este tiempo → recién ahí se pinta el gate (cero-impacto con el backend despierto). */
export const GATE_APPEAR_DELAY_MS = 800;

/** Una vez visible, el gate no se va antes de esto (anti-titileo). */
export const GATE_MIN_VISIBLE_MS = 1000;

/** Sin respuesta durante este tiempo → estado de error con "Reintentar". */
export const GATE_ERROR_TIMEOUT_MS = 3 * 60 * 1000;

/** Fade de salida de la superficie (docs/design.md §3). */
export const GATE_EXIT_MS = 220;
export const GATE_EXIT_REDUCED_MS = 100;

/** Cruce de contenido entre `despertando` y `error` (docs/design.md §4). */
export const GATE_CONTENT_FADE_OUT_MS = 120;

/**
 * Backoff entre intentos de sonda. Con Render dormido el fetch QUEDA COLGADO
 * hasta que el contenedor levanta (un único request pendiente alcanza y no
 * hace falta reintentar). El backoff existe para el otro caso: cuando el
 * request falla rápido (backend apagado en local → ECONNREFUSED, o sin red),
 * donde un loop sin espera martillaría al backend. El último valor se repite
 * indefinidamente.
 */
export const GATE_PROBE_BACKOFF_MS = [1000, 2000, 4000, 8000, 10000] as const;

/**
 * Sonda: ¿el backend está vivo?
 *
 * Cualquier RESPUESTA HTTP cuenta como "vivo" (incluso un 500): lo que el gate
 * espera es que el contenedor esté levantado, no que el endpoint sea correcto.
 * Solo un fallo de red (fetch rechazado) cuenta como "todavía durmiendo".
 *
 * Deliberadamente NO lleva timeout propio: abortar a mitad del cold start
 * tiraría el request que justamente está esperando a que Render levante.
 * El `signal` lo controla el llamador (desmontaje / reintento).
 */
export async function probeBackendHealth(signal?: AbortSignal): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  // Sin base URL no hay sonda posible: se asume vivo para no pintar un gate
  // eterno por un problema de configuración (que ya avisa `lib/env.ts`).
  if (!baseUrl) return true;

  try {
    await fetch(`${baseUrl}/health`, { method: "GET", cache: "no-store", signal });
    return true;
  } catch {
    return false;
  }
}

/**
 * ¿El usuario pidió menos movimiento? Se lee en el momento de cada transición
 * (no como estado suscripto): el gate vive segundos, y un listener de
 * matchMedia no aportaría nada sobre una lectura puntual.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── Señal "backend inalcanzable" ─────────────────────────────────────────────

type UnreachableListener = () => void;

const listeners = new Set<UnreachableListener>();

/**
 * Lo llama el manejo centralizado de errores de React Query ante un ApiError
 * 503 (fallo de red). Levanta el gate "en caliente": pestaña abierta, backend
 * dormido a los 15 min, el usuario vuelve y hace click.
 */
export function notifyBackendUnreachable(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeBackendUnreachable(listener: UnreachableListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── Señal "backend recuperado" ───────────────────────────────────────────────

type RecoveredListener = () => void;

const recoveredListeners = new Set<RecoveredListener>();

/**
 * Contracara de `notifyBackendUnreachable`: lo emite el gate cuando la sonda
 * confirma que el backend volvió a responder (un único disparo por ciclo de
 * espera, ANTES de la salida de la superficie).
 *
 * Por qué existe: mientras el gate tapaba la pantalla, las queries de la app
 * que estaban en vuelo fallaron por red y quedaron en estado `error`. Si nadie
 * las vuelve a pedir, al retirarse el gate el usuario se queda mirando el
 * cartel de "no se pudieron cargar… recargá la página" — la espera no habría
 * servido de nada. Quien escucha esta señal es `src/lib/react-query.tsx`, que
 * es donde vive el QueryClient (mismo patrón de punto único que el 401/503).
 */
export function notifyBackendRecovered(): void {
  recoveredListeners.forEach((listener) => listener());
}

export function subscribeBackendRecovered(listener: RecoveredListener): () => void {
  recoveredListeners.add(listener);
  return () => {
    recoveredListeners.delete(listener);
  };
}
