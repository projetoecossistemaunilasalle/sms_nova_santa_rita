import "server-only";

import { z } from "zod";
import { AdultPortalError } from "@/application/adult-portal/errors";
import type { AccountIdentityProvider } from "@/application/adult-portal/ports";
import { getServerRuntimeEnv } from "@/server/config/env";

type ProvisioningConfig = {
  NEON_AUTH_BASE_URL: string;
  NEON_AUTH_ADMIN_EMAIL?: string;
  NEON_AUTH_ADMIN_PASSWORD?: string;
  ALLOWED_ORIGINS: string[];
};

const createdUserSchema = z.object({
  user: z.object({ id: z.string().min(1) }),
});

export class NeonAccountIdentityProvider implements AccountIdentityProvider {
  constructor(
    private readonly config: () => ProvisioningConfig = getServerRuntimeEnv,
    private readonly request: typeof fetch = fetch,
  ) {}

  private async withAdmin<T>(
    work: (
      post: (path: string, body: unknown) => Promise<Response>,
    ) => Promise<T>,
  ): Promise<T> {
    const env = this.config();
    if (!env.NEON_AUTH_ADMIN_EMAIL || !env.NEON_AUTH_ADMIN_PASSWORD) {
      throw new AdultPortalError(
        "A criação de contas não está configurada. Contate o administrador da plataforma.",
        "VALIDATION",
      );
    }
    const baseUrl = env.NEON_AUTH_BASE_URL.replace(/\/$/, "");
    // This isolated cookie jar must never read or write the operator's browser session.
    let cookie = "";
    const post = (path: string, body: unknown) =>
      this.request(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: env.ALLOWED_ORIGINS[0]!,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    const login = await post("/sign-in/email", {
      email: env.NEON_AUTH_ADMIN_EMAIL,
      password: env.NEON_AUTH_ADMIN_PASSWORD,
    });
    cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    if (!login.ok || !cookie) {
      throw new AdultPortalError(
        "Não foi possível autenticar o serviço de criação de contas. Contate o administrador da plataforma.",
        "VALIDATION",
      );
    }
    try {
      return await work(post);
    } finally {
      // Session cleanup must not turn a successfully created account into a failed request.
      await post("/sign-out", {}).catch(() => undefined);
    }
  }

  async create(input: {
    displayName: string;
    email: string;
    password: string;
  }) {
    const authUserId = await this.withAdmin(async (post) => {
      let response: Response;
      try {
        response = await post("/admin/create-user", {
          name: input.displayName,
          email: input.email,
          password: input.password,
          // Provider privileges are never derived from a portal role or form field.
          role: "user",
        });
      } catch {
        throw new AdultPortalError(
          "O provedor não confirmou a criação. Peça ao administrador para verificar o e-mail no Neon Auth antes de tentar novamente.",
          "CONFLICT",
        );
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = z.object({ code: z.string() }).safeParse(payload);
        if (
          response.status === 409 ||
          (code.success &&
            [
              "USER_ALREADY_EXISTS",
              "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
            ].includes(code.data.code))
        ) {
          throw new AdultPortalError(
            "Já existe uma conta com este e-mail. Vincule o perfil existente ou contate o administrador.",
            "CONFLICT",
          );
        }
        throw new AdultPortalError(
          "O Neon Auth recusou a criação. Verifique a configuração e as permissões da conta de serviço.",
          "VALIDATION",
        );
      }
      const result = createdUserSchema.safeParse(payload);
      if (!result.success) {
        throw new AdultPortalError(
          "O provedor retornou uma resposta inesperada. Peça ao administrador para verificar o cadastro antes de tentar novamente.",
          "CONFLICT",
        );
      }
      return result.data.user.id;
    });
    return {
      authUserId,
      rollback: () =>
        this.withAdmin(async (post) => {
          const response = await post("/admin/remove-user", {
            userId: authUserId,
          });
          if (!response.ok) throw new Error("Identity rollback failed");
        }),
    };
  }
}

export class DemoAccountIdentityProvider implements AccountIdentityProvider {
  async create() {
    return { authUserId: crypto.randomUUID(), rollback: async () => undefined };
  }
}
