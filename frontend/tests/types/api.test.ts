/**
 * Tests del tipo ApiError y su comportamiento.
 */

import { describe, it, expect } from "vitest";
import { ApiError } from "@/types/api";

describe("ApiError", () => {
  it("es instancia de Error", () => {
    const err = new ApiError("algo falló", 400);
    expect(err).toBeInstanceOf(Error);
  });

  it("tiene name ApiError", () => {
    const err = new ApiError("algo falló", 400);
    expect(err.name).toBe("ApiError");
  });

  it("guarda el statusCode", () => {
    const err = new ApiError("no autorizado", 401);
    expect(err.statusCode).toBe(401);
  });

  it("guarda path y timestamp opcionales", () => {
    const err = new ApiError("not found", 404, {
      path: "/movements/999",
      timestamp: "2026-06-06T12:00:00Z",
    });
    expect(err.path).toBe("/movements/999");
    expect(err.timestamp).toBe("2026-06-06T12:00:00Z");
  });

  it("isClientError es true para 4xx", () => {
    expect(new ApiError("bad request", 400).isClientError()).toBe(true);
    expect(new ApiError("not found", 404).isClientError()).toBe(true);
    expect(new ApiError("unprocessable", 422).isClientError()).toBe(true);
  });

  it("isClientError es false para 5xx", () => {
    expect(new ApiError("server error", 500).isClientError()).toBe(false);
  });

  it("isServerError es true para 5xx", () => {
    expect(new ApiError("internal error", 500).isServerError()).toBe(true);
    expect(new ApiError("service unavailable", 503).isServerError()).toBe(true);
  });

  it("isServerError es false para 4xx", () => {
    expect(new ApiError("bad request", 400).isServerError()).toBe(false);
  });
});
