/**
 * Tests de la sonda y la señal del gate de arranque del backend
 * (src/lib/backend-gate.ts, docs/design.md §"Gate de arranque del backend").
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notifyBackendUnreachable,
  prefersReducedMotion,
  probeBackendHealth,
  subscribeBackendUnreachable,
} from "@/lib/backend-gate";

describe("probeBackendHealth", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
  });

  it("pega a GET /health de la base URL del backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 } as Response);
    global.fetch = fetchMock;

    await probeBackendHealth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:3001/health");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("cualquier respuesta HTTP cuenta como backend vivo (incluso un 500)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 500 } as Response);
    await expect(probeBackendHealth()).resolves.toBe(true);
  });

  it("un fallo de red cuenta como backend todavía durmiendo", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(probeBackendHealth()).resolves.toBe(false);
  });

  it("sin NEXT_PUBLIC_API_URL no sondea y asume vivo (no pinta un gate eterno por config)", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(probeBackendHealth()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("señal backend inalcanzable", () => {
  it("notifica a todos los suscriptores y deja de hacerlo al desuscribirse", () => {
    const a = vi.fn();
    const b = vi.fn();

    const unsubA = subscribeBackendUnreachable(a);
    const unsubB = subscribeBackendUnreachable(b);

    notifyBackendUnreachable();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    notifyBackendUnreachable();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);

    unsubB();
    notifyBackendUnreachable();
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe("prefersReducedMotion", () => {
  it("refleja la media query del usuario", () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, "matchMedia", { writable: true, value: matchMediaMock });

    expect(prefersReducedMotion()).toBe(true);
    expect(matchMediaMock).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
