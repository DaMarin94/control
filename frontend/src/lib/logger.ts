/**
 * Wrapper de logging estructurado para el frontend.
 * Emite a consola con la misma forma que el backend:
 *   { timestamp, level, context, message, ...datos }
 *
 * En producción se silencian debug e info; solo quedan warn y error.
 * NUNCA loggear el JWT, tokens ni el header Authorization completo.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function createEntry(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...(data ?? {}),
  };
}

function emit(level: LogLevel, entry: LogEntry): void {
  // En producción, silenciar debug e info
  if (IS_PRODUCTION && (level === "debug" || level === "info")) {
    return;
  }

  switch (level) {
    case "debug":
      console.debug(entry);
      break;
    case "info":
      console.info(entry);
      break;
    case "warn":
      console.warn(entry);
      break;
    case "error":
      console.error(entry);
      break;
  }
}

/**
 * Crea un logger con un contexto fijo (nombre del módulo/componente).
 * Uso: const logger = createLogger("ApiClient");
 */
export function createLogger(context: string) {
  return {
    debug(message: string, data?: Record<string, unknown>): void {
      const entry = createEntry("debug", context, message, data);
      emit("debug", entry);
    },

    info(message: string, data?: Record<string, unknown>): void {
      const entry = createEntry("info", context, message, data);
      emit("info", entry);
    },

    warn(message: string, data?: Record<string, unknown>): void {
      const entry = createEntry("warn", context, message, data);
      emit("warn", entry);
    },

    error(message: string, data?: Record<string, unknown>): void {
      const entry = createEntry("error", context, message, data);
      emit("error", entry);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
