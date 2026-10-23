import { createHash, randomBytes } from "node:crypto";

import type { AdultPortalTransaction } from "@/application/adult-portal/ports";
import type { PlayerAccessTransaction } from "@/application/player-access/ports";
import { SecurePlayerCredentialCipher } from "@/server/security/player-credential-cipher";
import { DemoGameContentStore } from "./game-content-store";
import {
  DemoAdultPortalStore,
  DemoPlayerAccessStore,
  demoAdultPortalSeed,
  type DemoAdultPortalState,
} from "@/server/mock/seed-store";

export const MOCK_SESSION_COOKIE = "portal-mock-session";
export const MOCK_SESSION_TTL_SECONDS = 8 * 60 * 60;

// A workspace is private to one browser session. Transactions across all
// adapters share a queue and publish only committed snapshots.
export class MockDatabase {
  readonly credentialCipher = new SecurePlayerCredentialCipher(
    randomBytes(32).toString("base64url"),
  );
  readonly state: DemoAdultPortalState = structuredClone(demoAdultPortalSeed);
  readonly gameContentStore = new DemoGameContentStore(
    this.state,
    undefined,
    (work) => this.transaction(work),
  );
  resetVersion = 0;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(
    readonly expiresAt = Date.now() + MOCK_SESSION_TTL_SECONDS * 1000,
  ) {
    this.refreshCredentials(this.state);
  }

  private refreshCredentials(state: DemoAdultPortalState): void {
    for (const credential of state.playerCredentials) {
      const token = randomBytes(32).toString("base64url");
      credential.tokenHash = createHash("sha256").update(token).digest("hex");
      credential.encryptedToken = this.credentialCipher.encrypt(
        token,
        credential.tokenHash,
      );
    }
  }

  transaction<T>(
    work: (state: DemoAdultPortalState) => Promise<T>,
  ): Promise<T> {
    const operation = this.pending.then(async () => {
      const draft = structuredClone(this.state);
      const result = await work(draft);
      Object.assign(this.state, draft);
      return result;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async reset(): Promise<void> {
    await this.transaction(async (draft) => {
      Object.assign(draft, structuredClone(demoAdultPortalSeed));
      this.refreshCredentials(draft);
    });
    this.resetVersion += 1;
    await this.gameContentStore.reset();
  }
}

export class MockAdultPortalStore extends DemoAdultPortalStore {
  constructor(private readonly database: MockDatabase) {
    super(database.state);
  }

  override transaction<T>(
    work: (transaction: AdultPortalTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction((draft) =>
      work(new DemoAdultPortalStore(draft)),
    );
  }
}

export class MockPlayerAccessStore extends DemoPlayerAccessStore {
  constructor(private readonly database: MockDatabase) {
    super(database.state);
  }

  override transaction<T>(
    work: (transaction: PlayerAccessTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction((draft) =>
      work(new DemoPlayerAccessStore(draft)),
    );
  }
}

export class MockSessionRegistry {
  private readonly sessions = new Map<
    string,
    { database: MockDatabase; expiresAt: number }
  >();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly capacity = 128,
  ) {}

  create(): string {
    this.prune();
    if (this.sessions.size >= this.capacity) {
      throw new Error("Mock session capacity reached. Try again later.");
    }
    const id = randomBytes(32).toString("base64url");
    const expiresAt = this.now() + MOCK_SESSION_TTL_SECONDS * 1000;
    this.sessions.set(id, {
      database: new MockDatabase(expiresAt),
      expiresAt,
    });
    return id;
  }

  get(id: string | undefined): MockDatabase | null {
    this.prune();
    return id ? (this.sessions.get(id)?.database ?? null) : null;
  }

  delete(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }

  private prune(): void {
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= this.now()) this.sessions.delete(id);
    }
  }
}
