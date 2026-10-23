import "server-only";

import {
  Prisma,
  type PrismaClient,
  type GameContentManifest,
} from "@/generated/prisma/client";
import type {
  GameContentStore,
  GameContentTransaction,
  NewGameContentManifest,
  StoredGameContentManifest,
} from "@/application/game-content/ports";
import { validateManifest } from "@/application/game-content/manifest";

import { getPrisma } from "./client";

function manifestDto(row: GameContentManifest): StoredGameContentManifest {
  return { ...row, payload: validateManifest(row.payload) };
}

class PrismaGameContentTransaction implements GameContentTransaction {
  constructor(protected readonly db: Prisma.TransactionClient) {}

  async getActor(profileId: string) {
    const profile = await this.db.professionalProfile.findUnique({
      where: { id: profileId },
      select: { id: true, displayName: true, status: true, platformRole: true },
    });
    return profile
      ? {
          profileId: profile.id,
          displayName: profile.displayName,
          profileStatus: profile.status,
          platformRole: profile.platformRole,
          memberships: [],
        }
      : null;
  }

  async findByBuildId(buildId: string) {
    const row = await this.db.gameContentManifest.findUnique({
      where: { buildId },
    });
    return row ? manifestDto(row) : null;
  }

  async current() {
    const row = await this.db.gameContentManifest.findFirst({
      where: { isCurrent: true },
    });
    return row ? manifestDto(row) : null;
  }

  async list() {
    const rows = await this.db.gameContentManifest.findMany({
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
    });
    return rows.map(manifestDto);
  }

  async importManifest(input: NewGameContentManifest) {
    // ON CONFLICT DO NOTHING avoids aborting the transaction on a build race.
    await this.db.gameContentManifest.createMany({
      data: [{ ...input, payload: input.payload as Prisma.InputJsonValue }],
      skipDuplicates: true,
    });
    const row = await this.db.gameContentManifest.findUniqueOrThrow({
      where: { buildId: input.buildId },
    });
    return manifestDto(row);
  }

  async setCurrent(manifestId: string) {
    // Serialize the switch even when no row is current yet. The partial unique
    // index is the final invariant; both updates commit atomically.
    await this.db.$queryRaw(
      Prisma.sql`SELECT true AS locked FROM pg_advisory_xact_lock(72601, 1)`,
    );
    const target = await this.db.gameContentManifest.findUnique({
      where: { id: manifestId },
    });
    if (!target) return null;
    await this.db.gameContentManifest.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });
    return manifestDto(
      await this.db.gameContentManifest.update({
        where: { id: manifestId },
        data: { isCurrent: true },
      }),
    );
  }
}

export class PrismaGameContentStore
  extends PrismaGameContentTransaction
  implements GameContentStore
{
  constructor(private readonly prisma: PrismaClient = getPrisma()) {
    super(prisma);
  }

  transaction<T>(
    work: (transaction: GameContentTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((transaction) =>
      work(new PrismaGameContentTransaction(transaction)),
    );
  }
}
