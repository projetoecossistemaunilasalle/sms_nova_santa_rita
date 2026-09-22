import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-correlation-id": "test" })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("@/server/auth/gateway", () => ({
  getAuthGateway: vi.fn(() => ({
    getSession: vi.fn(async () => ({
      actor: {
        profileId: "00000000-0000-4000-8000-000000000001",
        authUserId: "dev-bypass-local",
        displayName: "Adriana Martins",
        email: "dev@localhost",
      },
      expiresAt: new Date("2099-12-31T23:59:59.000Z"),
    })),
  })),
}));
vi.mock("@/server/services/service-container", () => ({
  getAccessLinkService: vi.fn(() => {
    throw new Error("Prisma-backed access-link service should not be called");
  }),
  getAuthorizationService: vi.fn(() => {
    throw new Error("Prisma-backed authorization service should not be called");
  }),
}));

import {
  createAccessLinkAction,
  pauseAccessLinkAction,
  resumeAccessLinkAction,
  revokeAccessLinkAction,
  rotateAccessLinkAction,
  updateAccessLinkAction,
} from "@/app/(professional)/portal/atividades/actions";

const originalBypass = process.env.AUTH_DEV_BYPASS;
const originalRuntimeMode = process.env.APP_RUNTIME_MODE;

afterEach(() => {
  if (originalBypass === undefined) {
    delete process.env.AUTH_DEV_BYPASS;
  } else {
    process.env.AUTH_DEV_BYPASS = originalBypass;
  }
  if (originalRuntimeMode === undefined) {
    delete process.env.APP_RUNTIME_MODE;
  } else {
    process.env.APP_RUNTIME_MODE = originalRuntimeMode;
  }
});

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("portal activity actions in development bypass mode", () => {
  it("handles create and lifecycle actions without the Prisma-backed services", async () => {
    process.env.APP_RUNTIME_MODE = "server";
    process.env.AUTH_DEV_BYPASS = "true";

    const created = await createAccessLinkAction(
      { status: "idle" },
      form({ label: "Turma de teste", audience: "Turma 5B" }),
    );
    expect(created).toMatchObject({
      status: "success",
      linkId: "turma-5b",
      label: "Turma de teste",
      audience: "Turma 5B",
    });
    expect(created.status === "success" ? created.token : "").toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );

    await expect(
      revokeAccessLinkAction(form({ linkId: "turma-5b" })),
    ).resolves.toEqual({ status: "success" });
    await expect(
      pauseAccessLinkAction(form({ linkId: "turma-5b" })),
    ).resolves.toEqual({ status: "success" });
    await expect(
      resumeAccessLinkAction(form({ linkId: "turma-5b" })),
    ).resolves.toEqual({ status: "success" });

    const rotated = await rotateAccessLinkAction(form({ linkId: "turma-5b" }));
    expect(rotated).toMatchObject({ status: "success", linkId: "turma-5b" });
    expect(rotated.status === "success" ? rotated.token : "").toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });

  it("redirects edit submissions to the fixture detail route", async () => {
    process.env.APP_RUNTIME_MODE = "server";
    process.env.AUTH_DEV_BYPASS = "true";

    await expect(
      updateAccessLinkAction(
        { status: "idle" },
        form({
          linkId: "turma-5b",
          label: "Turma 5B",
          audience: "Turma 5B",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/portal/atividades/turma-5b");
  });
});
