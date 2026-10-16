import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: vi.fn(() => ({ DATABASE_URL: "postgresql://unused/unused" })),
  clients: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config/env", () => ({ getServerRuntimeEnv: mocks.env }));
vi.mock("@prisma/adapter-neon", () => ({ PrismaNeon: class {} }));
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class {
    constructor() {
      mocks.clients();
    }
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
  delete (globalThis as { prisma?: unknown }).prisma;
});

describe("Prisma client lifecycle", () => {
  it("does not initialize the database merely by importing demo dependencies", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "demo");
    await import("@/server/db/client");
    expect(mocks.env).not.toHaveBeenCalled();
    expect(mocks.clients).not.toHaveBeenCalled();
  });
  it("reuses one lazily created client in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getPrisma } = await import("@/server/db/client");
    expect(getPrisma()).toBe(getPrisma());
    expect(mocks.clients).toHaveBeenCalledTimes(1);
  });
  it("keeps the development client through module reloads", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const first = (await import("@/server/db/client")).getPrisma();
    vi.resetModules();
    expect((await import("@/server/db/client")).getPrisma()).toBe(first);
    expect(mocks.clients).toHaveBeenCalledTimes(1);
  });
});
