/**
 * Tests del wrapper de logging estructurado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "@/lib/logger";

describe("createLogger", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("emite un log con la forma estructurada correcta", () => {
    const logger = createLogger("TestContext");
    logger.warn("algo pasó", { userId: "123" });

    expect(console.warn).toHaveBeenCalledOnce();

    const entry = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry).toMatchObject({
      level: "warn",
      context: "TestContext",
      message: "algo pasó",
      userId: "123",
    });
    expect(typeof entry.timestamp).toBe("string");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("emite debug en desarrollo", () => {
    process.env.NODE_ENV = "development";
    const logger = createLogger("Ctx");
    logger.debug("mensaje debug");

    expect(console.debug).toHaveBeenCalledOnce();
  });

  it("emite info en desarrollo", () => {
    process.env.NODE_ENV = "development";
    const logger = createLogger("Ctx");
    logger.info("mensaje info");

    expect(console.info).toHaveBeenCalledOnce();
  });

  it("siempre emite error independientemente del entorno", () => {
    process.env.NODE_ENV = "production";
    const logger = createLogger("Ctx");
    logger.error("error crítico");

    expect(console.error).toHaveBeenCalledOnce();
  });

  it("siempre emite warn independientemente del entorno", () => {
    process.env.NODE_ENV = "production";
    const logger = createLogger("Ctx");
    logger.warn("advertencia");

    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("incluye datos extra en el entry", () => {
    const logger = createLogger("ApiClient");
    logger.error("request fallido", { statusCode: 500, path: "/movements" });

    const entry = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.statusCode).toBe(500);
    expect(entry.path).toBe("/movements");
  });

  it("el contexto queda fijo en el logger creado", () => {
    const logger = createLogger("MiModulo");
    logger.info("test");

    const entry = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.context).toBe("MiModulo");
  });
});
