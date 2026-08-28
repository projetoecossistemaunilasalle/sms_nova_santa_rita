/**
 * Audit action vocabulary for the access-link lifecycle.
 *
 * Audit rows carry application identifiers and controlled reasons — never
 * secrets. Keeping the action strings as named constants (instead of inline
 * literals) makes every write greppable and lets the type system prove that
 * each action is written under exactly one name.
 */

/** A new access link was created (raw token handed back exactly once). */
export const ACCESS_LINK_CREATED = "access_link.created";

/** A link was rotated: prior link revoked and replacement created atomically. */
export const ACCESS_LINK_ROTATED = "access_link.rotated";

/** A link was revoked (terminal state for that token). */
export const ACCESS_LINK_REVOKED = "access_link.revoked";

/**
 * A link was paused (temporary): the same token/URL stays valid and resumes
 * later, unlike revocation.
 */
export const ACCESS_LINK_PAUSED = "access_link.paused";

/** A paused link was resumed; the token/URL is unchanged. */
export const ACCESS_LINK_RESUMED = "access_link.resumed";

/** A link's expiry was set or cleared after creation. */
export const ACCESS_LINK_EXPIRY_CHANGED = "access_link.expiry_changed";

/** A link's label, audience or expiry was updated after creation. */
export const ACCESS_LINK_METADATA_CHANGED = "access_link.metadata_changed";

/**
 * Resolves to the first value that appears more than once in `T`, or `never`
 * when every entry is distinct. Recurses over the tuple head/tail, so a
 * duplicated literal anywhere makes the whole type non-`never`.
 */
type DuplicateValues<T extends readonly string[]> = T extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? Head extends Tail[number]
    ? Head
    : DuplicateValues<Tail>
  : never;

/**
 * The tuple itself when all values are unique, `never` otherwise. Used as the
 * declared type of {@link ACCESS_LINK_AUDIT_ACTIONS}: introducing two
 * constants with the same value makes the assignment fail to compile.
 */
type UniqueStrings<T extends readonly string[]> = [DuplicateValues<T>] extends [
  never,
]
  ? T
  : never;

/**
 * Every access-link audit action, in lifecycle order. The declared type is
 * {@link UniqueStrings}, so a duplicated action value is a compile-time error.
 */
export const ACCESS_LINK_AUDIT_ACTIONS: UniqueStrings<
  [
    typeof ACCESS_LINK_CREATED,
    typeof ACCESS_LINK_ROTATED,
    typeof ACCESS_LINK_REVOKED,
    typeof ACCESS_LINK_PAUSED,
    typeof ACCESS_LINK_RESUMED,
    typeof ACCESS_LINK_EXPIRY_CHANGED,
    typeof ACCESS_LINK_METADATA_CHANGED,
  ]
> = [
  ACCESS_LINK_CREATED,
  ACCESS_LINK_ROTATED,
  ACCESS_LINK_REVOKED,
  ACCESS_LINK_PAUSED,
  ACCESS_LINK_RESUMED,
  ACCESS_LINK_EXPIRY_CHANGED,
  ACCESS_LINK_METADATA_CHANGED,
];

/** Union of all access-link audit action values. */
export type AccessLinkAuditAction = (typeof ACCESS_LINK_AUDIT_ACTIONS)[number];

/**
 * Identity record keyed by every action. `Record` with the union as keys
 * forces exhaustiveness: adding a constant to the union (or removing one)
 * without updating this record fails to compile. Iterate with
 * `Object.entries` when every known action must be processed.
 */
export const ACCESS_LINK_AUDIT_ACTION_RECORD: Record<
  AccessLinkAuditAction,
  AccessLinkAuditAction
> = {
  [ACCESS_LINK_CREATED]: ACCESS_LINK_CREATED,
  [ACCESS_LINK_ROTATED]: ACCESS_LINK_ROTATED,
  [ACCESS_LINK_REVOKED]: ACCESS_LINK_REVOKED,
  [ACCESS_LINK_PAUSED]: ACCESS_LINK_PAUSED,
  [ACCESS_LINK_RESUMED]: ACCESS_LINK_RESUMED,
  [ACCESS_LINK_EXPIRY_CHANGED]: ACCESS_LINK_EXPIRY_CHANGED,
  [ACCESS_LINK_METADATA_CHANGED]: ACCESS_LINK_METADATA_CHANGED,
};
