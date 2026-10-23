import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NeonAccountIdentityProvider } from "@/server/auth/account-identity-provider";

const config = {
  NEON_AUTH_BASE_URL: "https://auth.example.org/auth",
  NEON_AUTH_ADMIN_EMAIL: "service@example.org",
  NEON_AUTH_ADMIN_PASSWORD: "service-secret",
  ALLOWED_ORIGINS: ["https://portal.example.org"],
};
const input = {
  displayName: "PSE Professional",
  email: "pse@example.org",
  password: "test-password-123",
};
const login = () =>
  Response.json(
    { token: "private-token" },
    {
      headers: {
        "Set-Cookie":
          "better-auth.session_token=private-token; HttpOnly; Secure; Path=/",
      },
    },
  );

describe("Neon account provisioning", () => {
  it("uses an isolated service session, creates only provider users, and supports compensation", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(Response.json({ user: { id: "created-user" } }))
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(Response.json({ success: true }));
    const identity = await new NeonAccountIdentityProvider(
      () => config,
      request,
    ).create(input);
    expect(identity.authUserId).toBe("created-user");
    const [url, options] = request.mock.calls[1]!;
    expect(url).toBe(`${config.NEON_AUTH_BASE_URL}/admin/create-user`);
    expect(JSON.parse(options!.body as string)).toEqual({
      name: input.displayName,
      email: input.email,
      password: input.password,
      role: "user",
    });
    expect(options!.headers).toMatchObject({
      Cookie: "better-auth.session_token=private-token",
      Origin: config.ALLOWED_ORIGINS[0],
    });
    expect(request.mock.calls[0]![1]!.headers).not.toHaveProperty("Cookie");
    expect(identity).not.toHaveProperty("password");
    await identity.rollback();
    expect(request.mock.calls[4]![0]).toBe(
      `${config.NEON_AUTH_BASE_URL}/admin/remove-user`,
    );
    expect(JSON.parse(request.mock.calls[4]![1]!.body as string)).toEqual({
      userId: "created-user",
    });
  });

  it("fails closed when service credentials are missing", async () => {
    const request = vi.fn<typeof fetch>();
    const provider = new NeonAccountIdentityProvider(
      () => ({ ...config, NEON_AUTH_ADMIN_EMAIL: undefined }),
      request,
    );
    await expect(provider.create(input)).rejects.toThrow(
      "não está configurada",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])(
    "does not provision after service login fails with %s",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({}, { status }));
      await expect(
        new NeonAccountIdentityProvider(() => config, request).create(input),
      ).rejects.toThrow("autenticar");
      expect(request).toHaveBeenCalledOnce();
    },
  );

  it("does not attach or reset an existing account and closes its session", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        Response.json({ code: "USER_ALREADY_EXISTS" }, { status: 400 }),
      )
      .mockResolvedValueOnce(Response.json({}));
    await expect(
      new NeonAccountIdentityProvider(() => config, request).create(input),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[2]![0]).toMatch(/\/sign-out$/);
  });

  it("does not retry an uncertain creation or expose provider errors", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(new Error("sensitive upstream detail"))
      .mockResolvedValueOnce(Response.json({}));
    await expect(
      new NeonAccountIdentityProvider(() => config, request).create(input),
    ).rejects.toThrow("não confirmou");
    expect(request).toHaveBeenCalledTimes(3);
  });
});
