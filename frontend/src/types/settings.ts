/**
 * Tipos del dominio de configuración de usuario.
 * Reflejan el contrato de la API del backend (Fase 1.2.3).
 *
 * GET /settings  → data: UserSettings
 * PATCH /settings → body: UpdateSettingsRequest; data: UserSettings
 */

/** Código de moneda soportado en v1 (ampliado a 4 en Fase 1.2.4) */
export type CurrencyCode = "ARS" | "USD" | "EUR" | "BRL";

/**
 * Configuración de usuario tal como la devuelve el backend.
 */
export interface UserSettings {
  defaultCurrency: CurrencyCode;
  /**
   * Último tipo de cambio usado (ARS por 1 USD).
   * null si el usuario nunca cargó un movimiento en moneda no-default.
   */
  lastExchangeRate: number | null;
}

/** Body de PATCH /settings — todos los campos opcionales */
export interface UpdateSettingsRequest {
  defaultCurrency?: CurrencyCode;
  lastExchangeRate?: number;
}
