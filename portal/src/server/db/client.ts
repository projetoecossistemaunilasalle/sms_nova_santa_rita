import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

import { getServerRuntimeEnv } from "@/server/config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let cachedClient: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: getServerRuntimeEnv().DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  const client = (cachedClient ??=
    globalForPrisma.prisma ?? createPrismaClient());

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}
