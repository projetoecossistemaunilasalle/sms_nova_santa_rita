# Phase 50 — gates, CI, demo and docs

> Historical evidence. Execute [P50](../IMPLEMENTATION-READY.md#p50-final-gates-security-hygiene-demo-and-documentation), not the superseded work orders, decisions, or gates below.

**Goal.** Make the other four phases trustworthy by turning the plan's §7 success criteria into assertions
that can actually go red, ordering them so no gate reads an artifact another build overwrote, settling the
three demo-behaviour questions in advance, and making the documentation state what the code does. This phase
owns **tool correctness**: every "check green" claim in Phases 1-4 is only meaningful after it.

**Depends on.** Phase 00 (`.prettierignore` fix, the order-dependent-test fix, **`ci.yml` itself**, branch
protection) — without item 0.1 this phase's own exit criterion is unreachable, because `package.json:24` runs
`format:check` **first** inside `npm run check`: `npx prettier --check .` → exactly one `[warn] REFACTOR_PLAN.md`,
exit 1, while `.prettierignore:6` is `docs` — so every file this phase edits is already outside the formatter's
reach and only `REFACTOR_PLAN.md` reddens G1. The `ci.yml` these gates live in is **created by Phase 00 §5 item
0.4** (`phases/00-prerequisites.md:101`); at `e5aaf1e` it does not exist — `ls .github/workflows` → `deploy.yml`,
and `test -f .github/workflows/ci.yml` → exit 1 — so every workflow command in this file is written against a file
this phase does not author. Phase 1 (`phases/10-purge-generation-a.md`; "Phase 1" in this file always means it)
supplies the post-purge page set the doc-count gate asserts **and owns the `104 → 26` edit inside `ci.yml`**
(step 2, *Handoff notes*). **Phase 1b (`phases/20-schema-and-migration.md`; "Phase 1b" always means it — the
one-character gap between the two labels is a known vocabulary hazard, so cite filenames) is depended on by four
items here and was missing from this list until the cross-phase audit** (the audit's tell: `grep -c "Phase 20"
this-file` → 0 against 7 occurrences of "Phase 1b"/"P1b"): G11's four dropped-table patterns can only go green once
`access_links` / `capability_assignments` / `rate_limit_buckets` / `audit_events` are actually `DROP`ped, R-15's
verdict *is* "`AuditEvent` is deleted", the `database-model.md` rewrite states its own edit as "all four dropped
with their models in Phase 1b" (*Documentation corrections*), and *Accepted breakage* books `RATE_LIMITED`'s
removal to that phase. Phase 2
(`phases/30-composition-seam.md`) removes the `@runtime/*` aliases G6 counts — **conditionally; G6 is
satisfiable in exactly one branch of a human decision this phase does not own, see G6's row** — and Phase 3
(`phases/40-decomposition.md`) is what the size ratchet and the selector oracle police.

**Graph as this file actually assumes it.** `00 → {10, 1b, 2, 3, 4}`, `10 → {1b, 2, 3, 4}`, `1b → {2, 4}`,
`2 → {3, 4}`, `3 → 4`, `4 → ∅`: **acyclic**, and with the Phase 1b edge declared it is the single serial chain
`00 → 10 → 20 → 30 → 40 → 50` — which is what this file assumes, because its Entry gate reads Phase 10's
*pre*-purge artifacts, its exit needs Phase 10's `ci.yml` edit, Phase 1b's `DROP TABLE`s, Phase 2's alias
removal and Phase 3's splits, and it blocks nothing (`**Blocks.**` below). `phases/10:7` and `phases/30:10` both
offer a shortcut — purge and seam are "file-disjoint … **parallelizable**". Disjointness measures true here
(`grep -oE '"\./src/[^"]+"' next.config.ts` → **17 distinct** alias targets, intersection with `phases/10`'s
46-path purge set → **0**), the parallelism does not: `phases/30`'s Entry gate demands
`ls src/server/services/service-container.ts src/server/security/tokens.ts` → *both* `No such file`
(`phases/30:18-20`), which is a Phase 10 exit condition. Disjoint files ≠ independent phases; the chain stays
serial.

**Blocks.** Nothing downstream in the repo. It blocks *release confidence*: plan §7.4 ("GitHub Actions
automatically tests, lints, typechecks and verifies builds on every PR") is 0-of-4 true until this lands, and
`docs/refactor-dossier/REFACTOR-DOSSIER.md` §11's "Automated?" column is calibrated on this phase's gates.

**Entry gate.**

- [ ] `git log --oneline -1` → `e5aaf1e …` or a descendant carrying the Phase 00 merge.
- [ ] `npm run check` → exit 0. **Verify the ordering claim yourself, do not inherit it:**
      `grep -n '"check"' package.json` → line 24, value
      `npm run format:check && npm run lint && npm run typecheck && npm test`. A red formatter therefore blocks
      lint, typecheck and test in one command — which is why Phase 00 item 0.1 is a hard dependency, not a
      courtesy.
- [ ] `git ls-files .github/workflows` → `deploy.yml` only (no `ci.yml`) **or** `ci.yml` + `deploy.yml` if
      Phase 00 merged. Both states are allowed at entry; only the second lets this phase's exit gate pass.
- [ ] Artifact state recorded before anything is cleaned `[state: `e5aaf1e`, pre-purge; see the label rule two
      bullets below]:
      `node -e 'const m=require("./.next/server/server-reference-manifest.json");const i=[...Object.keys(m.node||{}),...Object.keys(m.edge||{})];console.log("ids",i.length,"actions",i.filter(x=>(parseInt(x.slice(0,2),16)>>7&1)===0).length)'`
      → `ids 17 actions 17` (the on-disk `.next` is the **server** build's; re-run here, and note that every one
      of the 17 ids carries a high bit of 0, i.e. all 17 are `server-action`, none is `use-cache`).
      `node -e 'const fs=require("fs"),p=require("path");const w=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?w(p.join(d,e.name)):(e.name.endsWith(".html")?[1]:[]));console.log(w("out").length)'`
      → `104` `[pre-purge; G4 asserts 26 post-purge]`; `find out -type f | wc -l` → `554`
      `[pre-purge; a census of this export only, never re-derived post-purge]`. `out/` is a **local build
      artifact** — `git ls-files out | wc -l` → 0, `.gitignore:7` is `/out` — so "104 committed documents" is a
      wording error, the counts themselves are right (§Evidence, `COMPAT-POLICY.md` §4 edit 9 at `:77`).
- [ ] **`.next` staleness probe** `[state: `e5aaf1e`, pre-purge]`:
      `node -e 'const t=require("fs").readFileSync(".next/types/validator.ts","utf8");const r=[...t.matchAll(/typeof import\("([^"]+)"\)/g)].map(m=>m[1]);const k=["/portal/atividades/","/portal/materiais/","/portal/modulos/","/portal/admin/jogos/","/portal/admin/modulos/","/portal/admin/auditoria/","/atividade/[token]/"];console.log(r.length,r.filter(p=>k.some(x=>p.includes(x))).length)'`
      → `44 21`, and `for f in .next/types .next/dev/types .next-demo-dev/dev/types; do wc -l < $f/validator.ts; done` →
      `448` ×3. Three copies × 21 stale edges = **63** false `TS2307`s after §2.2, not the dossier's 60 (§Evidence).
      The 21st is `(public-play)/atividade/[token]/layout.js` — a **layout**, which is what a page-only sweep
      misses, and the per-tree split of the 21 (atividades 8, materiais 3, modulos 2, admin/jogos 1,
      admin/modulos 1, admin/auditoria 1, `atividade` 5) reproduces plan §2.2's seven trees exactly. All three
      numbers re-run here digit-for-digit, and `.next-demo-dev/types/` — globbed by `tsconfig.json:52` — **does
      not exist**; only `.next-demo-dev/dev/types/` does.
- [ ] **Read the entry probes as a census of a state, not as post-purge expectations.** Every artifact number in
      this section is the **pre-purge** world (`e5aaf1e`, dirty workstation), which is also the world this file's
      derivations were computed against. On a tree where Phase 10 has landed the same commands print:
      `find out -name '*.html' | wc -l` → **26**, `-type f` → its own post-purge number (**not** 554),
      `ids/actions` → 17 (`phases/30:25` records that none of the 17 ids comes from a purged file, so that is a
      measured expected value, not an assumed one), and the staleness probe → **0 stale edges in the regenerated
      copy**, because `build:server` rewrites `.next/types/validator.ts` from the current tree. **Zero of these
      entry bullets is a gate** — a probe that prints 26 after the purge is *correct*, and must not be read as a
      red. `phases/10:133` states the matching rule from its side ("gate on the regeneration, never on a count"),
      and the **63** above is a *workstation* exposure no clean runner can reach (step 3).

## Gate inventory

| Gate | Command (expected output) | What it catches | Can it actually fail? |
| :--- | :--- | :--- | :--- |
| G1 formatter blocks all | `npm run format:check` → `All matched files use Prettier code style!` / exit 0 | any unformatted tracked file | **Yes** — red today, on one file. It is the first clause of `check` (`package.json:24`), so it gates the rest of that command and every scored gate after it (G4-G12; G2 is retired, G3 is an `echo`) |
| G2 `out/` has no `api/` (plan Day 4, `REFACTOR_PLAN.md:236`) | `test ! -d out/api` → exit 0 | nothing, ever | **NO — vacuous.** Under `output: "export"` (`next.config.ts:28`) Next drops route handlers and `proxy.ts` by construction: `find out -type d -name api -o -type d -name health` → **0 lines** on the current 554-file export while 4 `route.ts` handlers exist in `src/app/api/v1/player/*` (`find src/app -name route.ts \| wc -l` → 4). **Replace** with G4+G5 — and note that G3, this row's original replacement, has been retired into this row's class (see its row and step 2) |
| G3 demo manifest action count | **Demoted to an informational `echo`, not a gate.** Expected: `0` server-action ids in `.next/server/server-reference-manifest.json` immediately after `build:demo`. The body lives in `ci.yml` (written by Phase 00 §5, edited per step 2), **not in this cell** — the copy this cell used to print was GFM-escaped, and pasted raw it is a `SyntaxError`, while the unescaped body runs; two incompatible copies of one command in one table was the defect (*Evidence*) | an action registered in the **demo** target's manifest — plan §7.2's first sentence (`REFACTOR_PLAN.md:251`, "Zero registered Server Action IDs … after `build:demo`") | **NO — unreachable by construction, and the same species as G2.** The wording this row first carried ("silent crash at hydration") was wrong the same way: Next 16.3.2 **hard-fails the export** — `node_modules/next/dist/export/index.js:375-385` throws `ExportError("Server Actions are not supported with static export.")`, `E625`, when any manifest id decodes as `server-action` under `output === 'export'` (`:360`), so `build:demo` cannot exit 0 with an action present and a step after it can only ever read 0. It is *born green*, the exact failure this phase exists to delete, and it is red-on-a-correct-tree if mis-ordered (*Evidence*). **Disposition:** keep the count as an `echo` that documents §7.2's sentence; the assertion that earns its place is **G5's `!==17` on the server target**, which nothing else enforces |
| G4 exported-document census | `node -e '…walk("out")…if(n!==26)exit(1)'` + the §11.1 path list | a route silently vanishing from the export, an accidental new prerendered page, a `generateStaticParams` regression | **Yes.** 26 is arithmetic that reproduces **and** survives the subtraction being wrong: 103 `index.html` + 1 `404.html` = 104 today, minus the 78 documents inside plan §2.2's seven deleted trees (`find out/portal/atividades out/portal/materiais out/portal/modulos out/portal/admin/{jogos,modulos,auditoria} out/atividade -name index.html \| wc -l` → **78**) = **26**; enumerated forward instead — `find out -name "*.html" \| grep -vE "^out/(portal/(atividades\|materiais\|modulos)/\|portal/admin/(jogos\|modulos\|auditoria)/\|atividade/)" \| wc -l` — it is also **26**, with `out/atividade` alone contributing the 52 seeded documents. `[state: pre-purge inputs, post-purge expected value]`, and the edit to `104 → 26` inside `ci.yml` is Phase 10's PR's, per step 2 |
| G5 server-target route registry | `node -e 'const r=require("./.next/app-path-routes-manifest.json");const w=["/api/v1/player/active-time/route","/api/v1/player/bootstrap/route","/api/v1/player/results/route","/api/v1/player/state/route"];const m=w.filter(k=>!(k in r));if(m.length)throw new Error(m)'` → exit 0; and the same action-count one-liner with `!==17` | a purge/seam edit orphaning a `route.ts` or stripping actions from the **server** target too (which would break `/entrar`) | **Yes** — run verbatim here → exit 0 against a 44-key manifest, and G3's body with `!==17` → exit 0 against `ids 17 actions 17`. This is the real replacement for G2 **and** the only action-count assertion in the pipeline that can actually fire: the handlers that must survive live here, not in `out/`, and the only target where actions exist is the server one. G3's demo-side count is compiler-enforced (G3's row), so the plan §7.2 enforcement load shifts entirely onto this `!==17` and onto `build:demo` exiting 0 |
| G6 alias removal | `grep -c '"@runtime/' next.config.ts tsconfig.json` → `0`, `0` (today `9`, `9`; aliases at `next.config.ts:44-79`, paths at `tsconfig.json:24-42`) | the seam being declared done while resolution is still config-driven; renaming one alias cannot satisfy it | **Yes, but only in one branch of a human decision this phase does not own — see *Accepted breakage* and the D-1 flag.** Under D-1 = (a) (plan §3.1, this file's assumption, and `phases/30`'s default) the 9+9 entries are deleted and G6 passes. Under D-1 = (b) the aliases **stay by design** — (b) *is* `tsconfig.demo.json` + `typecheck:demo` layered on top of the existing per-mode aliases (`phases/30:201-212`), and `phases/30:307` books "0 `@runtime/*` aliases" as a deliberate deviation — so G6 is unsatisfiable there, while `phases/30:235`'s own exit bullet (`tsc -p tsconfig.demo.json`, an artifact only (b) creates) is unsatisfiable under (a). **The two gates cannot both pass on any answer.** Owner must pick; this file does not |
| G7 selector-integrity oracle | `node scripts/check-css-selectors.mjs` → `violations 5 (baseline 5)` exit 0 at landing (the row first printed `violations 0 (baseline 0)`, the post-drain state, so an implementer copying the table expected the wrong day-1 number) … see Work order step 6 | a CSS-module **usage** whose class the imported file does not define → that token renders as the literal string `undefined` in the class attribute, so the element keeps its siblings' styling and loses its own. **One-directional:** it cannot see the inverse — a definition, or an `@media print` block, orphaned from its module — which is §11 R-01's mechanism and belongs to `phases/40`'s A2 tripwire (step 6's direction note) | **Yes — but it is RED TODAY with 5 violations**, contradicting §8.3's "green today". Ships with a named baseline (step 6). Reproduced by an independently written oracle: `module-imports 50 / usages 670 / violations 5`, same three names, same three `entryProblem` lines 143/162/181 |
| G8 size ratchet | `node scripts/check-size-budget.mjs --baseline .size-baseline.json` → `new FAILs 0 (baseline 13)` | a decomposition phase that splits 1,222 lines into two 611-line files | **Yes**, once the script exists; nothing computes it today (`eslint.config.mjs` is 17 lines with **0** hits for `max-lines`, and `ls scripts` → `next-target.mjs`, `start.mjs`). Its **classifier is part of the gate**, because the four plan §7.1 budgets (`REFACTOR_PLAN.md:246-250`) name categories, not globs — step 7 pins the rule; a census whose classifier is unstated is not reproducible by a second reader |
| G9 suite order-independence | `npx vitest run --no-isolate --fileParallelism=false` → the **same** file and case totals as `npx vitest run`, exit 0. `[state: pre-purge]` `33 files / 284 tests`; `[state: post-purge, i.e. from Phase 10's PR onward]` `27 / 182`; `[state: at this phase's exit]` `~33 files / 182 + Phase 2's seam test + Phase 3's ~5 files`, which is **not** 284. **The contract is equality of the two runs, never a number** (step 10) | a test mutating `process.env` for a shared worker: `tests/unit/auth.test.ts:161-165` deletes `APP_RUNTIME_MODE` **unconditionally** at `:163` that `vitest.config.mts:13-15` injects | **Yes** — red on today's tree: `phases/00:248` re-ran exactly this command pair at `e5aaf1e` → `1 failed \| 32 passed`, `282 passed`, exit 1 serial vs 33/284 parallel, so the serial leg only reaches `33/284` **after Phase 00's item 0.2 merges**. `[U]` the executed halves (284, 282) are executed-only figures — running vitest is outside this pass's read-only budget; the file count and the static case census are re-derived in *Evidence*. `--no-isolate` alone stays green (`phases/00:248`), so both flags are load-bearing; `--fileParallelism=false` is accepted by vitest 4.1.11 (`--fileParallelism` declares no `<arg>`, so cac treats it as boolean and mri casts `false` — `node_modules/vitest/dist/chunks/cac.uFydS1Z4.js:18,257`), though vitest's own help prefers `--no-file-parallelism` |
| G10 offline Prisma chain | `./node_modules/.bin/prisma validate` → `is valid 🚀` exit 0 with no `.env`; `grep -n postinstall package.json` → `:26: "postinstall": "prisma generate"` | a CI job that cannot install without a database | **Yes** (Phase 00 observed it; `prisma/schema.prisma:6-8` is `datasource db { provider = "postgresql" }` — no `url` key — and `prisma.config.ts` is **12 lines** attaching one only when `DIRECT_URL` is set: `:1` `import "dotenv/config"`, `:4` reads it, `:11` `...(directUrl ? { datasource: { url: directUrl } } : {})`, and **`shadowDatabaseUrl` appears nowhere**). **This row is now the pipeline's entire schema check** — see the paragraph after the table. Its `grep` is prose-proof for the simple reason that JSON admits no comments |
| G11 docs-truth gate | **As first written it could not be a CI step at all.** A `run:` step's exit code is its last command's, and "no matches" is grep's **1** (measured: `grep -qF "absent-token-xyz" README.md; echo $?` → `1`), so the gate's *success* state reddened the job; negation is the fix and it works both ways (`! grep -qF "Portal" README.md` → exit 1, `! grep -qF "zzabsentzz"` → exit 0). "No matches" and "no such file" are also the same shape when the file is absent, so the body in step 11 prints a **count** and prefights file existence. Full body: `grep -rnF` over the six retired terms against `README.md docs/current-architecture.md docs/schemas/database-model.md`, minus lines marked `<!-- compat-note -->` | the refactor shipping an architecture doc describing deleted routes and tables that never existed | **Yes, after the rewrite — and it needed two fixes, not one.** (1) The exit-code contract above. (2) It banned the *vocabulary the doc pass is required to introduce*: this file orders `database-model.md` "**Rewritten**" and `README.md` to gain a CI section, and any sentence explaining the four `DROP TABLE`s necessarily contains `access_links`, `capability_assignments`, `rate_limit_buckets` or `audit_events` — the gate as written forbade the docs from describing the refactor, and the `compat-note` marker is the smallest fix that keeps both true. Today it prints **19** stale lines: **17** with the dossier's three-table set (no `audit_events`) and **17** if `-F` is dropped, because `/atividade/[token]` is then a bracket expression matching one character and falls from 2 hits to **0**. Both terms are load-bearing — `-F` (*Evidence*) and `audit_events`, the fourth dropped table per `COMPAT-POLICY.md` §4 edit 7, adopted at §6 |
| G12 CI existence | **Rewritten: four structural assertions, in order.** (i) `test -f .github/workflows/ci.yml`; (ii) `grep -qE '^[[:space:]]*pull_request:' .github/workflows/ci.yml` — a YAML key at indentation, which a comment cannot fake; (iii) each of the four `check` legs appears on a `run:` line; (iv) the Pages permissions stay out: `! grep -qE '^[[:space:]]*(pages:\|id-token:)' …`. Bodies in step 8. The old clause `grep -n "pull_request" ci.yml` → "a hit" is satisfied by the *word* anywhere — a comment, a `name:` label, a job that runs nothing — while plan §7.4 stays 0-of-4 true | plan §7.4 being satisfied by `deploy.yml`, which runs none of lint/typecheck/test | **No, as written — vacuous in its positive clause** (the exact "matches prose" failure G2 was deleted for, reintroduced in the phase that polices it). It also "fails right now" for the wrong reason: `ls .github/workflows` → `deploy.yml` only, so the old command died with grep's *file-missing* error rather than asserting anything about triggers. After the rewrite it fails on today's tree for the right reason (clause (i)) and can additionally go red later on a real regression: a workflow that keeps `pull_request` but drops the `typecheck` leg, which is precisely the shape plan §7.4's 4-of-4 wording is about. The rewritten body was executed against four synthetic workflows (step 8, *Evidence*) |

**Grep discipline, applied across the whole table (the lesson `-F` taught once).** A gate whose pass condition is
a *word* is not a gate. Three failure modes, and every `grep`-shaped row above is now written against all three:
**(a) prose matches** — a positive `grep` is satisfied by comments, `name:` labels and prose (G12's old clause;
step 2's old `grep -c "server-reference-manifest" → 2`, which a `# we read the server-reference-manifest here`
comment satisfies and which `phases/00:124-143` already satisfies on its own); fixed by anchoring to YAML/bash
structure (`^[[:space:]]*run:`, `^[[:space:]]*pull_request:`). **(b) vacuity by error** — "no matches" and
"input file missing" are the same shape, and `ci.yml` does not exist at `e5aaf1e`; fixed by a `test -f` preflight
plus a printed count instead of empty output (G11, G12, exit gate). **(c) pattern semantics** — `-F` wherever a
pattern contains `[`, `{`, `.` or `|` (G11: 19 → 17, one pattern to zero). The negative gates (G6's `→ 0,0`, step 2's
`out/api` check, the exit gate's drift terms) fail the *other* way — prose inside a config makes them falsely red,
which is loud, not silent — so they stay as printed and gain only the preflight. `grep -c` counts **lines with a
match**, not matches, which is the right unit for every row here: `next.config.ts`'s 9 alias keys sit one per line
(`:44,48,52,56,60,64,68,72,76`) and `tsconfig.json`'s 9 likewise (`:24,25,28,29,32,35,38,41,42`) — a value wrapped
onto its own line still carries the `"@runtime/` token on the key line, so the count holds.

**Deliberately absent from the table: no gate compares `prisma/schema.prisma` to `prisma/migrations/**`.**
`REFACTOR-DOSSIER.md:511`'s `ci.yml` order used to carry `prisma validate` → `migrate diff --exit-code` against a
throwaway Postgres; `COMPAT-POLICY.md` §4 edit 3 removes that leg and §6 adopts it. Edit 2's DB-free substitute —
`diff <(prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script)
prisma/migrations/0_init/migration.sql` — went with it: §6 **rejected** edit 1, so the six migration directories
stay sequential (`COMPAT-POLICY.md:69`: the byte-compare "is only available if edit 1 is adopted") and there is no
cumulative init to compare against — `0_init` is one step of a six-step history, and the generator emits
*today's* schema. Replaying `0_init` … `6_drop_generation_a` needs a shadow database, so the only command that
answers the question is the one that cannot run (`phases/00-prerequisites.md` §4 0.3, exit **1**, quoted at
`COMPAT-POLICY.md:70`), and Prisma 7.9.1 offers no flag-level way in either. Both halves, plus the measurement that
the substitute was **born red on a correct tree** — reading a good tree as drift — are in *Evidence*.
**`prisma validate` (G10) is therefore the pipeline's entire schema check**, and it never reads a migration file:
this refactor ships with **NO schema-drift gate at all**, and no cheaper gate took the old one's place —
`prisma validate` checks the schema against itself (syntax, relation references), which is a different question.
This is a decided gap, not an oversight: it is not scored, not baselined, and not fixable from `ci.yml`. It closes
only when a real database exists, and **no phase owns that** — Phase 1b writes `6_drop_generation_a` but books no
drift step, and the trigger is the staging-Neon connection
`docs/implementation/slice-03-05-portal-handoff.md:35` item 1 asks a human to supply (`COMPAT-POLICY.md:26`, §2's
R1 row, which hands the "unproven history" risk to that acceptance list rather than to a gate).

## Scope

**In.** Retiring G2 **and demoting G3 to an informational `echo`**; editing `ci.yml` (a file Phase 00 creates —
step 2 states what this phase owns versus re-proposes) to land G4, G5 and the rewritten G11/G12; the
stale-generated-types rule (step 3 — the *ordering* claim it used to state is refuted there); the two new checker
scripts (G7, G8) plus their baselines; the demo-behaviour decisions R-03/R-04 and the `localStorage` version bump
recorded as product choices; the documentation truth pass with per-file edits; branch-protection verification.
Decides: this phase. Does **not** decide: D-1 (a human call whose two branches make G6 and `phases/30:235`
mutually unsatisfiable — see G6's row and *Accepted breakage*).

**Out — and who decides.** `REFACTOR_PLAN.md` §6-§7 is **fixed input**: Day 4's "assert no `api/` in `out/`"
(`:236`) is *implemented around*, never edited. `deploy.yml` stays as-is — moving Pages behind `needs: gates`
needs `gh api` settings or a workflow redesign (repo owner). The `prisma migrate diff` drift leg is **not** this
phase's and **no phase has it any more** — deleted outright, with no substitute booked to Phase 1b or to anyone
else; the ruling chain and both measurements are *Gate inventory*'s closing paragraph. The `@runtime/*` seam itself
is Phase 2. CSS *extraction* is deferred by D-3; this
phase only builds the oracle that makes it safe later. No `Heroes_Trial` work (class B, external repo).

## Work order

**1. Confirm the `check` composition before trusting any "green".** No edit.
**Verify:** `npm run check` → runs 4 legs in order, stopping at the first red one; `grep -n '"check"' package.json` → `24`.
**If it fails:** red on `format:check` means Phase 00 item 0.1 did not merge — nothing in this phase can pass behind it. Land that first; do not add a bypass.

**2. Retire G2, demote G3, and be explicit about which `ci.yml` edits are this phase's at all.** Ownership first, because the file is not this phase's: `.github/workflows/ci.yml` is **created by Phase 00 §5** (`phases/00-prerequisites.md:101-144`), which already embeds the four assertion bodies there (`:139-143`: route keys, 17 ids, 0 ids, the document census) and whose own P4 handoff forbids duplicating them (`phases/00:238` — "§9.1's replacement table is *implemented* by step 5 — the docs must describe `ci.yml` as it exists, **not re-propose it**"). This phase's diff is therefore **two edits and no insertions**: (i) delete the `out/api` informational echo (G2's retirement, the one genuine diff Phase 00 concedes at `phases/00:160`); (ii) turn G3's `process.exit(1)` into an `echo`, editing the body at `phases/00-prerequisites.md:142`, and say in the commit message why the assertion moved to `build:demo`'s exit code. G4 and G5's bodies stay where Phase 00 put them. **The `104 → 26` edit inside G4's body is not this phase's, and it is not booked as any phase's *step* yet**: `grep -n "ci.yml" phases/10-purge-generation-a.md` → 2 hits (`:7` Depends, `:260` an Accepted-breakage row), **neither a Work-order step**, so today the edit exists only as *handoff notes in other phases' files* — `phases/00:159` and `:234` book it to **P1's PR**, this file's *Handoff notes* book it to Phase 1, and `phases/00:235` separately hands "the `104 → 26` doc-count follow-through" to **P1b**, i.e. two owners for one line. Canonical answer, stated here so the pipeline does not have to guess: **the edit lands in Phase 10's purge PR, in the same commit as the deletions**, because that is the commit where the number changes and because Phase 00 step 7's branch protection requires `gates`, which a purge PR leaving `104` in place cannot satisfy. `main` is otherwise red from the purge merge until this phase, which is the exact red window Phase 00 exists to bound.
**Verify:** `test -f .github/workflows/ci.yml`; `grep -c "out/api" .github/workflows/ci.yml` → `0` (a *printed* 0
with exit 1 — fine to read locally, fatal as a `run:` step, so the Exit gate and any CI use negate it); and the
demotion is visible from the file: `grep -n "E625-risk" .github/workflows/ci.yml | grep -c "process.exit"` →
`0`, i.e. the string survives (as the `echo` that documents plan §7.2's sentence) while the exit leaves the
workflow. `grep -c "expected 17" .github/workflows/ci.yml` → `1` (G5's server-side assertion is the only
throwing action count left). One more owner to name while this diff is open: the `// PHASE-1: 26` comment inside
G4's body is authored by `phases/00:131,143`, edited by Phase 10 with the census, and rewritten by this step — three
owners of one comment line; say in the PR which of the three lands it.
**If it fails:** two reads of the same manifest path with the same expected number means the copy-paste lost the target distinction — G5's is `!==17` after `build:server`, G3's echo is `0` after `build:demo`. If `ci.yml` does not exist, this step has nothing to edit: Phase 00 §5 has not merged, and nothing downstream in this file can be asserted.

**3. Clear the stale generated types, and stop claiming a step order performs the task.** `[Correction — the ordering rule this step used to state rests on a false premise; it is retained here marked refuted.]` **What survives:** `next.config.ts:26-28` gives `distDir: ".next-demo-dev"` **only** under `PHASE_DEVELOPMENT_SERVER`, so a demo **build** writes the same `.next` as a server build, and `tsconfig.json:45-55` globs `.next/types/**`, `.next/dev/types/**`, `.next-demo-dev/types/**` and `.next-demo-dev/dev/types/**` with `exclude` = `["node_modules"]` only — an explicit `exclude` replaces TypeScript's defaults, so nothing is dropped and those generated files are in the program whether you want them or not. **What is refuted:** that `npm run typecheck` is the only type leg, and that its position in the order controls which flavour gets checked. `next build` type-checks the project itself — `node_modules/next/dist/build/index.js:1068-1073` calls `startTypeChecking` for the app dir after the build, `next.config.ts` sets no `typescript.ignoreBuildErrors`, and the installed doc states the scope plainly (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md:39`: "**The CLI checks the complete project selected by your `tsconfig` file. This includes test files and `.next/dev/types` when they are included by that configuration.**"). So a PR with both builds runs `tsc` **three times** (`build:server`'s, `typecheck`'s, `build:demo`'s), and `build:demo` re-type-checks the *server* build's `.next/types/validator.ts` — which is harmless by design but is not a guarantee step ordering provides. **And the 63 is unreachable on CI:** on a fresh runner there is no `.next` before the first build, and the build regenerates `.next/types/validator.ts` from the current tree. The two `dev/types` copies are written by `next dev`, which CI never runs — this workstation's mtimes say it directly: `.next/types/validator.ts` `2026-09-23 02:05`, `.next/dev/types/validator.ts` `2026-09-22 22:21`, `.next-demo-dev/dev/types/validator.ts` `2026-09-22 23:04`. **No ordering clears those 42; only deletion does.** (Sharpness note: the 21 refs per copy are *not errors today* — all 21 resolve to real `.tsx` files on this tree; they become 21 false `TS2307`s only in the window where the source is deleted and the validator is not regenerated.) The ordering that genuinely remains load-bearing is the manifest read: G5's `!==17` immediately after `build:server`, G3's echo immediately after `build:demo` — measured, the same body run against the server manifest exits **1** with `E625-risk 17`.
**Disposition: this is a local runbook remedy, not a `ci.yml` insertion — and step 2's "two edits and no insertions" is why.** The remedy is correct (`rm -rf .next/types .next/dev .next-demo-dev`, never `typescript.ignoreBuildErrors`) and Phase 00 §4's step 5 books it as a **local** pre-flight, which is where it does work: it is the workstation that has run `next dev` and holds the two stale `dev/types` copies, and `phases/00:104` explicitly declines to duplicate it in the workflow.

On CI it is a **no-op**, for three measured reasons: `.gitignore:5-6` keeps every `.next` tree out of git so a fresh checkout has none; `setup-node`'s `cache: npm` caches npm only, so nothing restores a stale build dir; and the two `dev/types` copies are written only by `next dev`, which CI never runs. Inserting a step that cannot change an outcome, while it *can* invalidate other phases' assertions, is a bad trade.

**The coupling to respect if anyone ever does insert it.** Phase 00 asserts its own step count in two places — the measured parse output at its step 5 (`steps=17 uses=3 run=14`) and its Evidence row repeating `17 steps / 3 uses / 14 run` — so an added step silently falsifies both. Any future insertion must therefore, **in the same PR**: update both counts to `18 steps / 3 uses / 15 run`, re-run Phase 00's `js-yaml` extraction probe against its own finished text, and re-run the ten cross-phase greps Phase 00 lists as constraints on its workflow. The parse probe is the cheap half of that and it is the one that catches drift.

**Verify (local, on this workstation — not on a runner):** after `rm -rf .next/types .next/dev .next-demo-dev`, `test ! -e .next/types/validator.ts && echo cleared` → `cleared`; after `npm run build:server`, the Entry-gate probe → `44 21` on this tree with **21/21 refs resolving**, and `node -e 'console.log(Object.keys(require("./.next/server/server-reference-manifest.json").node).length)'` → `17`; after `npm run build:demo`, the same one-liner → `0`. **Warning:** these three numbers are this file's Evidence. Record them *before* clearing, or the step destroys the evidence it is meant to support (`phases/00`'s Do-not-touch says so at its own resolution note).
**If it fails:** `17` after a demo build means the demo read is post-server and the echo is lying. If you cannot get 0-after-demo *and* 17-after-server in one run, the `.next` collision is unfixed; the durable remedy is a `distDir` per target, which is a **Phase 2** edit to `next.config.ts` and must update every `.next/…` path in `ci.yml` in the same PR (`phases/00:192` books it the same way). Do **not** reach for `typescript.ignoreBuildErrors` to make a stale-validator red go away — that deletes the type leg from all three builds at once.

**4. Record that `build:server` needs valid env but no database.** No edit; both halves read at HEAD.
`next.config.ts:5-7` Zod-parses `APP_RUNTIME_MODE` **unconditionally** at config import — so bare `next build` can never work and every invocation goes through `scripts/next-target.mjs` — and `next.config.ts:12-19` parses `DATABASE_URL` `.url()`, `NEON_AUTH_BASE_URL` `.url()`, `NEON_AUTH_COOKIE_SECRET` `.min(32)`, `APPLICATION_SECRET` `.min(32)` **only** under `server`. Nothing connects: `src/server/db/client.ts:17-25` exposes `getPrisma()`, which constructs only on first call via `createPrismaClient()` (`:10-15`), and `src/app/(professional)/portal/layout.tsx:21-24` awaits `connection()` only in server mode, forcing `/portal/**` dynamic so no prerender reaches it. Demo blanks all seven server vars (`scripts/next-target.mjs:41-53`) and `:39` pins `AUTH_DEV_BYPASS=false` for server builds only. This is also *why* G3's echo legitimately prints 0 on the demo target rather than merely hopelessly: `grep -rln '"use server"' src` → **7** files, **all** under `src/app/…` and **none** under `src/runtime/`, so the demo target registers no actions to begin with.
**Verify:** `DATABASE_URL=postgresql://ci:ci@127.0.0.1:54325/ci?sslmode=require NEON_AUTH_BASE_URL=https://ci.invalid.example NEON_AUTH_COOKIE_SECRET=$(node -e 'console.log("a".repeat(40))') APPLICATION_SECRET=$(node -e 'console.log("b".repeat(40))') APP_RUNTIME_MODE=server npm run build:server` on a machine with **no** Postgres listening → exit 0.
**If it fails:** a Zod error naming a key → that placeholder breaks its own rule (`min(32)` vs `.url()`); a connection timeout → something queries at build time, which is a **Phase 1/2 defect** (a prerendered route reaching `getPrisma()`), not a CI bug. Fix the route, not the job.

**5. Prove `npm ci` installs offline.** **Verify:** `grep -n '"postinstall"' package.json` → `26: "postinstall": "prisma generate"`; `sed -n '6,8p' prisma/schema.prisma` → a `datasource db` block with **no** `url` key; `rm -rf src/generated && npm ci && ls src/generated/prisma` → populated; then `npm ci --ignore-scripts && npx tsc --noEmit` → **fails**, which is the in-direction proof that no CI step may use `--ignore-scripts`. `[U]` the failure count is the only part this pass could not measure (running `npm ci`/`prisma generate` is outside this dossier pass's budget); the *population* is: `grep -rln "@/generated" src tests \| wc -l` → **47** first-party files (`phases/00:92`'s "48" is one high; this file's "~48" survives on the tilde), so expect 47-ish `TS2307`s, and note this step mutates `src/generated/` — run it on a scratch clone, never on the tree holding this phase's other evidence.
**If it fails:** `postinstall` dying with a connection error means `prisma.config.ts` resolved `DIRECT_URL` from a shell holding a real `.env` — unset it; `.env.example` is sufficient env for both targets. `prisma.config.ts:1` is `import "dotenv/config"`, so the exposure is **structural, not shell-dependent**: every Prisma CLI call inherits the ambient environment (recorded at `COMPAT-POLICY.md:111`), and deleting the drift gate narrows it without closing it.

**6. Add `scripts/check-css-selectors.mjs` (G7) with an honest baseline.** The prototype was run against HEAD for this file; it prints **5** violations over `module-imports 50 / usages 670`:

```
UNDEFINED src/components/portal/materials-explorer.tsx   portal.module.css#materialAudience
UNDEFINED src/components/portal/portal-navigation.tsx    portal.module.css#mobileNavItem
UNDEFINED src/components/public/player-entry-screen.tsx  public.module.css#entryProblem  (×3: :143, :162, :181)
```

Ship the gate with a **new-violations-only** contract and those three names in a checked-in baseline.
`materialAudience` dies with Phase 1 (`materials-explorer.tsx` is in plan §2.3 and in `phases/10`'s table B);
`mobileNavItem` is §11 R-02's defect proven mechanically (`grep -rn "mobileNavItem" src --include=*.css` → **0**
files); `styles.entryProblem` has no defining selector — the same grep returns only `.entryProblemIcon`
(`public.module.css:842,854`) — so that one is a **live** dead-class reference in a **surviving** file, i.e. new
register row R-18, whose row and the *Evidence* carry the proof that it is already published in today's `out/`
chunks. Semantics: for each `import X from "…/*.module.css"`, every `X.<ident>` must appear as a class
selector in that file; `composes` is exempt because this repo's count is **0**, and the two dynamic
`styles[\`tone…\`]` sites (`activity-mark.tsx:22`, `materials-explorer.tsx:92`) are whitelisted because both die
with Phase 1 — a third is a finding, not a whitelist.
**Direction, stated once because it is load-bearing for R-01:** this rule is **usage → definition**, one-way, and it
cannot see the inverse — a definition, or an `@media` block, orphaned from the module that needs it. `phases/40`'s
A1 unapplied-class oracle is that opposite axis and the two must not be conflated (different names, rules and
baselines: `css-selector-integrity.mjs`/90 vs `check-css-selectors.mjs`/5). **Therefore G7 is not R-01's oracle, and
this file used to claim it was** — measured in *Evidence*: the print block spans `portal.module.css:4355-4391`,
`.printSheet` is defined at `:4140`, and 37 files import that module today, so "someone still imports it" proves
nothing. Move `.printSheet` into a new `print.module.css` under a D-3 extraction and re-point
`player-credential-print-sheet.tsx` at it, and `styles.printSheet` still resolves → **G7 exits 0 with the print
stylesheet orphaned.** G7's landing is therefore *not* a reason to un-defer D-3. The assertion that **can** see it is
already on paper in the other file: `phases/40`'s **A2 "print pairing — the R-01 tripwire"** (`phases/40:63-66`, with
the `misplaced-print` fixture at `:84-85`) requires `@media print` to share a file with `.printSheet` /
`.credentialPrintCard`. So the fix is **adoption, not duplication**: G7 owns usage→definition, A2 owns
definition→consumer, and D-3's deferral rests on A2 not having landed — not on G7 having landed.
**Verify:** `node scripts/check-css-selectors.mjs` → exit 0 with `violations 5 (baseline 5)`; then rename
`.entryCard`→`.entryCardX` in `public.module.css` → exit 1 naming the file, and revert.
**If it fails:** a violation on a file you did not touch means an extraction moved a class **definition** out of
the module its consumer still imports — restore the rule, or re-point the import; extend the baseline only with a
line in *Evidence*. A violation you *do not* get after moving a class **and its consumer's import together** is
the blind spot above, not a pass.

**7. Add `scripts/check-size-budget.mjs` (G8) implementing the ratchet reading — and pin the classifier in the script header.** Budgets: component 250/400, module 300/500, `*.module.css` 300/600, test 400/800 (`REFACTOR_PLAN.md:246-250` verbatim; applied to **new or modified** files only, `REFACTOR-DOSSIER.md` §8.5 adopting `docs/architecture-audit-2026-09-23.md:744-746`). The plan names **categories**, not globs, so the gate is only reproducible if the script states its own mapping; the rule that produces the numbers below, and which belongs in the header comment verbatim: `.module.css` → CSS budget; `tests/**` or `*.test.ts(x)` → test budget; `src/components/**` or `src/app/**` **and** `.tsx` → component budget; everything else in scope → module budget; FAIL = lines above the second number, WARN = above the first; line count = `wc -l`. Scope: `git ls-files 'src/**' 'tests/**' 'scripts/**' '*.ts' '*.mts' '*.mjs'` minus `src/generated` → **214** files today. The baseline is the census re-derived **twice** in this file's history and agreeing digit-for-digit both times: **13 FAIL / 12 WARN** today; **9 FAIL / 8 WARN** post-purge, the post-purge half previously `[U]` (it needs `phases/10`'s 46-path manifest, now applied here off `phases/10:30-51,59-76,82-87`) and reproduced with the classifier above, so it is re-derived rather than inherited. The 9 post-purge FAILs are exactly `src/application/adult-portal/service.ts` 616, `marketing.module.css` 688, `player-access-workflow.tsx` 540, `portal.module.css` 4,910, `team-screen.tsx` 411, `game-host.tsx` 932, `public.module.css` 1,017, `adult-portal-demo-store.ts` 1,024, `game-offline-sync.ts` 1,222 — of which **5 have no plan §4 step** (`adult-portal-demo-store.ts` 1,024; `public.module.css` 1,017; `marketing.module.css` 688; `player-access-workflow.tsx` 540; `team-screen.tsx` 411, each confirmed against `wc -l`). Those five are recorded **debt**, not silence.
**Verify:** `node scripts/check-size-budget.mjs --baseline .size-baseline.json` → `new FAILs 0 (baseline 13)`;
`grep -c '"src\|"tests' .size-baseline.json` → `13`.
**If it fails:** a new FAIL from a decomposition split means the split was wrong. The known trap is plan §4.2's
own allocation: `REFACTOR_PLAN.md:162` splits `game-offline-sync.ts` (**1,222 lines**, measured) and `:165`
budgets `idb-store.ts` at **~650** — a *plan estimate for a file that does not exist yet*
(`test -f src/runtime/idb-store.ts` → absent), and 650 > the 500-line module ceiling, so that split must be broken
at least twice regardless of how `phases/40` allocates it. Fix the split; do not raise the budget.

**8. Harden CI and protect `main`; state plainly what runs today; land the rewritten G12.** Verified from the
file: `deploy.yml:3-6` triggers on `push: branches: ["main"]` + `workflow_dispatch`, has **no** `pull_request`
trigger, and its body is `npm ci` (`:31`) → `npm run build:demo` (`:34`) → `upload-pages-artifact ./out` (`:36-39`)
→ `deploy-pages@v4` (`:41-50`; the action itself is at `:50`, which an earlier version of this row missed by one
line) — no lint, typecheck, test, format or assertion step anywhere, and
`cancel-in-progress: false` (`:15`) queues a red artifact rather than cancelling it. Branch protection on `main`
requiring `ci.yml`'s checks is therefore the only thing keeping `deploy.yml` from publishing mid-purge commits.
G12 is what asserts that, and it had to be rewritten first because its old positive clause was satisfied by a word
(G12's row). **Proposal** — the body for `ci.yml`'s assertion step and for any local run; it is four
structural checks, and note that `!` is not decoration: without it the step's success state exits 1:

```bash
# PROPOSAL — G12 rewritten (each line is a CI step's whole `run:`, failing loudly on the first problem)
test -f .github/workflows/ci.yml                                                       # (i) the file exists at all
grep -qE '^[[:space:]]*pull_request:' .github/workflows/ci.yml                         # (ii) a real trigger key, not prose
for leg in format:check lint typecheck test; do                                        # (iii) all four `check` legs
  grep -qE "^[[:space:]]*(-[[:space:]]+)?run:[^#]*(npm run ${leg}|npm ${leg}|tsc -p tsconfig\.json|vitest run|npm run check)" \
    .github/workflows/ci.yml || { echo "G12: no '${leg}' leg" >&2; exit 1; }
done
! grep -qE '^[[:space:]]*(pages:|id-token:)' .github/workflows/ci.yml                    # (iv) Pages permissions stay out
```

Clause (iii) accepts `tsc -p tsconfig.json` and bare `vitest run` because that is what Phase 00's own listing runs
(`phases/00:126-127`), and accepts `npm run check` because `package.json:24` composes the four legs in order so one
step genuinely discharges all four; it is anchored to a `run:` line — `- ` list marker included — so a comment cannot
discharge a missing leg. **The body was executed, not assumed:** four synthetic workflows, four correct answers
(comment-only impostor, four-leg pass, `pages: write` regression, absent file), tabulated in *Evidence*.
**Verify:** `gh api repos/niciniV/SMS_Portal/branches/main/protection/required_status_checks` → lists the CI job —
and check it against Phase 00, whose `PUT` additionally requires `required_approving_review_count: 1`, so verifying
only `required_status_checks` proves half the setting; `grep -c "run:" .github/workflows/deploy.yml` → `2`
(re-confirmed here); the G12 body run against today's repo → fails at clause (i),
`test -f .github/workflows/ci.yml` → exit 1.
**If it fails:** no protection and not an admin → stop and hand to the owner. Do not substitute "we'll be
careful", and do not edit `deploy.yml` to make it wait (out of scope; it is the live publisher).

**9. Land the demo-behaviour decisions, and the `localStorage` version bump, as product choices.**
`COMPAT-POLICY.md` rules §12 row 3 ("do not change the key or version") class **A** — drop it, and the code
confirms there is nothing to protect: `readDemoAdultPortalState`
(`src/runtime/adult-portal-demo-store.ts:346-356`) returns `cloneSeed()` when `window` is undefined (`:347`),
when nothing is stored (`:349`), when JSON parsing throws (`:353-355`) and when `value.version !== 2` (`:352`);
there is **no** migrate-on-read path in the file. So any bump of `DEMO_ADULT_PORTAL_STORAGE_KEY` (`:137-138`) or
`version` (`:124`, `:148`) discards state by the same mechanism that already discards a corrupt entry — and the
v1→v2 bump happened exactly that way (`git log --all -S 'adult-portal:v1' -- src` → `48b6c5d`, `06baea2`).
Bump to `:v3` only if Phase 2/3 genuinely changes the shape; this step's output is the *permission* plus three
recorded decisions:
- **Hydration flash** — prerendered demo HTML is always seed state and always `PLATFORM_ADMIN` (`:347`, seed
  `activeProfileId` `:149`) with 10 screens re-reading after mount. **Survives as a product decision:** inherent
  to `output: 'export'` + localStorage; document it, do not "fix" it.
- **Deep links to created entities** — `demoId(kind)` → `demo-<kind>-<uuid>` can never appear in
  `generateStaticParams` output, so Pages serves `out/404.html`; plan §3.3's "falls back to the `/portal/turmas`
  list" is **false for GitHub Pages** (no rewrite capability). **Survives as a product decision:** option (c),
  already implemented at `classes-screen.tsx:169-180`, `organizations-screen.tsx:146-154`,
  `overview-screen.tsx:207`; its only violator (`activity-builder.tsx:60`) is deleted by Phase 1.
- **Cross-tab sync** — the mechanism is the `storage` listener at `src/components/portal/use-demo-portal.ts:15`
  (teardown `:18`); the same-tab `CustomEvent` at `:14` is not cross-tab and `:13` is just `sync()`. Keep the
  line fix (class **C** — it stops someone deleting the wrong handler); drop the "regression row" framing.
**Verify:** `grep -n "adult-portal:v" src/runtime/adult-portal-demo-store.ts` → the key line;
`grep -rn "migrate\|version === 2" src/runtime/adult-portal-demo-store.ts` → only the seed fallback; `ls out/404.html`.
**If it fails:** if a real migrate-on-read branch turns out to exist, the ruling still permits deleting it — but
record it here first, because it changes D-2's cost, not its answer.

**10. Keep the serial test leg, and assert equality rather than a number.** The pair this step used to hard-code
(`33 files / 284`) is the **pre-purge** state, and a gate that prints it is red on every tree this phase actually
runs on. Label every test-count claim with the state it describes: `[pre-purge]` **33 files / 284 tests**
(`find tests -name '*.test.ts' | wc -l` → **33**, `*.test.tsx` → 0); `[post-purge, i.e. from Phase 10's PR]`
**27 / 182**; `[at this phase's exit]` **~33 files** again — 27 plus Phase 2's seam test and Phase 3's ~5 files —
with **182 + however many cases those add**, which is *not* 284. Both executed totals stay `[U]` in this pass
(running `vitest` is outside a read-only dossier pass), but the *relationship* between the pairs is derivable
statically and is derived in *Evidence*: one measurement read on either side of the purge, which is why
`phases/00`'s 284 and `phases/10`'s 182 are not a disagreement. **Verify:**
`npx vitest run --no-isolate --fileParallelism=false` → identical file and case totals to `npx vitest run`, exit 0;
expect `1 failed | 32 passed`, `282 passed`, exit **1** on an unfixed `e5aaf1e` (`phases/00:248`), which is Phase 00
item 0.2's job, not this step's.
**If it fails:** a serial total below the parallel total means a file is bleeding `process.env`. Name
`tests/unit/auth.test.ts:163` alone — the unconditional `delete process.env.APP_RUNTIME_MODE` inside the `afterEach`
at `:161-165`, undoing `vitest.config.mts:13-15`; *Evidence* disposes of the reviewer's claimed second deleter at
`tests/unit/portal-dev-bypass-actions.test.ts:46,55`. The silent count drop, not the red, is the dangerous symptom —
which is why this step keeps the leg but no longer keeps a number.

**11. Documentation truth pass.** Execute the per-file edits in *Documentation corrections*, then gate with the
rewritten G11. Two defects had to be fixed in G11 first (its row carries the reasoning): the pass state exited 1,
and the pattern list forbids the vocabulary the pass is required to write. **Proposal** for the step body:

```bash
# PROPOSAL — G11 rewritten. Exit 0 = clean; a line marked `compat-note` is allowed to name a retired thing.
for f in README.md docs/current-architecture.md docs/schemas/database-model.md; do test -f "$f" || exit 1; done
n=$(grep -rnF -e "health/" -e "/atividade/[token]" -e "access_links" -e "capability_assignments" \
      -e "rate_limit_buckets" -e "audit_events" \
      README.md docs/current-architecture.md docs/schemas/database-model.md \
   | grep -vF -- "compat-note" | wc -l)
[ "$n" -eq 0 ] || { echo "G11: $n stale-doc lines remain"; exit 1; }
```

The `wc -l` form is deliberate: a bare `grep` reporting "no matches" exits 1, and a `grep` reporting "no such
file" exits 2 — both would otherwise be indistinguishable from a clean tree, and one of them would be read as a
pass. **Verify:** the G11 body → exit 0 after the pass; **before** the edits it prints
`G11: 19 stale-doc lines remain` and exits **1** — red for the right reason, where the old form reddened the job for
having nothing to report. Which files hold those 19, the **17** with the dossier's three-table set, the **17** without
`-F`, and the per-pattern split are tabulated in *Evidence*; G11's row states why `audit_events` must be in the list
(`COMPAT-POLICY.md` §4 edit 7, adopted at §6, makes it a **fourth** dropped table, at
`docs/schemas/database-model.md:51` and `:127`). Also `grep -c atividade walkthrough.md` → `11` today (repo root,
**not** `docs/walkthrough.md`; one of the 11 is the substring in `Interatividade` at `:28`), `1` after the pass.
**If it fails:** `src/app/health` holds `live/` and `ready/` as **directories with zero files**
(`find src/app/health` → 3 lines, `git ls-files src/app/health` → 0), so any doc still advertising those
handlers describes something that has never existed in either target, in any commit.

## Exit gate

- [ ] `npm run check` → exit 0 on a fresh clone after `npm ci`, with no prior compile (a fresh clone has no
      `.next`, so `tsconfig.json:45-55`'s four generated-type globs match nothing and the 63-stale-validator
      hazard is structurally absent — step 3).
- [ ] `ci.yml` green on a real PR with **zero** repository secrets configured (proof that step 4's placeholders
      are enough), containing: G5 (4 route keys + the throwing `!==17` action count after `build:server`), G3 as
      an **informational `echo`** after `build:demo` (its assertion moved to `build:demo`'s own `E625` exit code —
      G3's row), G4 at **26** documents with the §11.1 path list, and G12's four structural clauses (step 8).
      **The `104 → 26` edit inside G4's body must already be in place when this phase's PR opens**: it lands with
      `phases/10`'s purge PR, never before and never here (step 2). If it did not land there, `main` has been red
      since the purge — that is the finding to report, not to paper over from this phase.
- [ ] `test -f .github/workflows/ci.yml && ! grep -q "out/api" .github/workflows/ci.yml` → exit 0. (Negated on
      purpose: the `grep -c "out/api" …` form this bullet first printed *succeeds* by exiting **1**, which is G11's
      own defect in this file's own checklist.) `REFACTOR_PLAN.md`
      untouched: `git diff --name-only` must never list it — plan `:236` and §7.2's action sentence
      (`:251`) stay as written and are *implemented around*, which is this file's own device for a gate the
      toolchain already guarantees.
- [ ] `ci.yml` carries **no** drift leg and no half-built one, checked on `run:` lines rather than anywhere in
      the file (a `# the migrate diff leg is deferred` comment must not false-red, and prose must not hide a real
      step): `test -f .github/workflows/ci.yml`; then
      `! grep -qE '^[[:space:]]*(-[[:space:]]+)?run:[^#]*(migrate diff|shadowDatabaseUrl|SHADOW_DATABASE_URL)' .github/workflows/ci.yml`;
      then `! grep -qE '^[[:space:]]*services:' .github/workflows/ci.yml` (the Postgres container is a job key, not a
      `run:` line, so it needs its own anchored check); then
      `test "$(grep -cE '^[[:space:]]*(-[[:space:]]+)?run:[^#]*prisma validate' .github/workflows/ci.yml)" -eq 1`
      → exit 0, and `git diff --name-only prisma.config.ts` → empty. All four verified against synthetic workflows
      (*Evidence*). Anchoring is what makes the bullet decidable: the unanchored `grep -c "prisma validate" → 1` this
      bullet first carried counted *mentions*, so a comment naming the command twice failed a correct file, and a
      missing `ci.yml` printed an error instead of a 0.
- [ ] `node scripts/check-css-selectors.mjs` → exit 0, `violations 5 (baseline 5)`, and a deliberate rename
      probe → exit 1. Recorded in the same PR: **G7 is not R-01's oracle** (step 6's direction note), so D-3's
      deferral stands on the orphan-block gap and not on G7's landing.
- [ ] `node scripts/check-size-budget.mjs --baseline .size-baseline.json` → `new FAILs 0`, baseline listing
      all 13 (later 9) offenders, with the 5 unaddressed ones named as debt, and the classifier rule (step 7) in
      the script header.
- [ ] `npx vitest run --no-isolate --fileParallelism=false` → **identical to `npx vitest run`** at whatever the
      current state's pair is (`[pre-purge]` 33/284, `[post-purge]` 27/182, `[here]` ≈33 files / 182+new).
      Equality is the gate; no number appears in `ci.yml`'s test leg.
- [ ] G11's rewritten body → exit 0 over `README.md`, `docs/current-architecture.md`,
      `docs/schemas/database-model.md`, with `<!-- compat-note -->` carried on the lines that legitimately name a
      retired route or table; and `walkthrough.md` (repo root) retains only the `Interatividade` substring.
- [ ] Branch protection active and a deliberately-unformatted scratch PR commit is blocked from merge.
- [ ] §11 register re-issued in this file's *Regression register* form (7 rows dropped, 1 added, R-18 added by
      G7).
- [ ] **G6 settled by an answer, not by editing the gate.** Either D-1 has been answered = (a) — then G6 asserts
      `0,0` and passes — or the deviation is recorded in the PR body (`phases/30:307`), and G6 is withdrawn from
      the table as unsatisfiable-with-honour. Silence is the failure mode: on one branch G6 is the only gate that
      can fire and on the other `phases/30:235` is the only one that can (see G6's row and *Accepted breakage*).

## Interfaces that must not change

- `package.json` script names and bodies, especially `check` (`:24`) and `postinstall` (`:26`) — every later
  phase's gate text quotes them verbatim, and `postinstall` is what keeps typecheck alive on a clone.
- The four assertion surfaces: `.next/server/server-reference-manifest.json`,
  `.next/app-path-routes-manifest.json`, `out/**/*.html`, `out/404.html`. Their paths change if Phase 2 gives
  the demo build its own `distDir`; that PR must edit `ci.yml` in the same commit.
- `next.config.ts:22-31`, `:35-41`, `:44-79`; `tsconfig.json:6` (`skipLibCheck`), `:24-42` (paths), `:45-55`
  (include/exclude) — flipping any of these changes what "typecheck green" means, in both directions.
- `vitest.config.mts:12-16` and `eslint.config.mjs`'s `globalIgnores` list.
- Class **B** contracts, untouched and not ours to rename: `basePath "/SMS_Portal"` + `trailingSlash: true`
  (`next.config.ts:28-29,35-41`), which is what G4's expected paths are written against; and the GameMaker
  protocol-v1 field names, which live in `contracts/schemas/v1/protocol-error.v1.schema.json` — *not* in
  `api-error.v1.schema.json` (see *Evidence*).
- `deploy.yml` (the only publisher) and every route tree Phase 1 owns.

## Tests

- **Added:** none under `tests/**` **by this phase**. G4-G8 are deliberately **not** unit tests: they assert facts
  about build artifacts that do not exist in a `tests/` process, and wrapping them would recreate the
  unfalsifiable gate this phase exists to eliminate. They are commands in `ci.yml` plus two scripts under
  `scripts/`. The sentence is scoped to this phase's own diff on purpose — `phases/30` adds
  `tests/unit/runtime-seam.test.ts` and `phases/40` adds ~5 test files, and the suite total at this phase's exit
  is those plus 27, which is exactly why G9 stopped carrying a number.
- **Changed:** `tests/unit/auth.test.ts:161-165` (Phase 00) — its `afterEach` deletes `APP_RUNTIME_MODE` at
  `:163` while `vitest.config.mts:13-15` injects it; this phase keeps the serial leg that proves the fix.
- **Gaps made explicit, not filled:** `tests/unit/proxy.test.ts` has **2** tests, both CSP/correlation on
  `/entrar`, so R-09 stays manual; `vitest.config.mts:12` is `environment: "node"` with no
  `playwright`/`jsdom`/`@testing-library` installed, so **every UI claim in R-01, R-10, R-11, R-13, R-14, R-17
  and R-18 is manual by construction.**
- **Retired as unfalsifiable:** plan Day 4 `:236` (`no api/ in out/`), any "assert `out/` has no `health/`"
  variant, and — as of this revision — **G3**, which is plan §7.2's first sentence (`:251`) asserted one step
  after the compiler already threw `E625` for its negation. Same species, same disposition: documented, `echo`ed,
  not scored.

## Do not touch

`REFACTOR_PLAN.md` (fixed input; implement around `:236` and §7.2's action sentence, never edit either).
`src/**`, `contracts/**`,
`prisma/**`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.mts`, `package.json`,
`scripts/next-target.mjs`, `.github/workflows/deploy.yml`, existing `docs/refactor-dossier/**` files and other
phases' files. `out/`, `.next/`, `.next-demo-dev/` are this phase's **evidence** — cleaning them **locally**
destroys the Entry-gate counts, and every number in this file was read off them. The `rm -rf .next/types .next/dev
.next-demo-dev` proposed in step 3 is a `run:` step inside `ci.yml` on a runner, not a command to type in this
phase's working tree; `package.json`'s script text is additionally frozen by *Interfaces* below, so the proposal
touches only the workflow file. No `prisma migrate dev`, `prisma db push`, or `npm ci --ignore-scripts`, ever, in
any leg.

## Rollback

One PR; one commit per step (2-3 workflow, 6-7 scripts, 8 settings, 9-11 docs), so any one reverts alone.

- Revert step 2 → G2's echo returns **and G3's `process.exit(1)` returns with it**; nothing breaks, but the
  phase's premise fails twice — say so in the revert PR, with the `export/index.js:375-385` citation, because a
  reverted G3 is a step that can only ever print 0.
- Revert steps 6-7 → both scripts and their baselines disappear and plan §7.1/§7.5 revert to review convention,
  i.e. **cannot fail**. Correct but loud outcome; zero runtime effect.
- Revert step 11 → docs again advertise `/health/*`, `/atividade/[token]` and **four** dropped tables
  (`access_links`, `capability_assignments`, `rate_limit_buckets` — and `audit_events`, dropped by
  `COMPAT-POLICY.md` §4 edit 7 as adopted at §6), and G11
  goes red: that is the signal, not the bug.
- Branch protection is **not in git**: `gh api -X DELETE repos/niciniV/SMS_Portal/branches/main/protection`. A
  `git revert` will not undo it, so say so in the revert.
- Nothing here touches a runtime path: cost to redo ≈ 1 day, risk to a live user ≈ none, and `deploy.yml`
  keeps publishing throughout.

## Accepted breakage

- Docs state, in writing, that GitHub Pages 404s un-prerendered demo URLs and that the export ships **no CSP**
  (`proxy.ts` is inert under `output: 'export'`), so "the demo has no CSP header" becomes an expected report.
- The `localStorage` version bump is permitted again, so a shape change can discard a visitor's demo state —
  accepted per `COMPAT-POLICY.md` §2 (class A) and because the fallback already does that to every mismatched entry.
- `ci.yml` ships **no schema-drift check of any kind**, and this phase does not paper over it: a phase that edits a
  model without editing the history — or edits `6_drop_generation_a` — stays green here. The gate was deleted, not
  deferred, and the only DB-free substitute went with the history collapse it depended on (*Gate inventory*'s
  closing paragraph and *Evidence* hold the ruling chain and both measurements). Reintroducing it needs a real
  database, a `datasource.shadowDatabaseUrl` in `prisma.config.ts`, and a Postgres `services:` container — i.e. the
  three things this ruling removed — so the trigger belongs to whoever supplies the staging Neon connection
  (`COMPAT-POLICY.md:26`), not to `ci.yml`. Naming it here is the only mitigation available without a database.
- G7/G8 land **red-adjacent**: they pass only against checked-in baselines (5 selector violations, 13 size
  offenders). A reader may call that toothless; the alternative is a gate that cannot fail, which is what this
  phase was written to remove — and note which side of that line G3 fell over: a *ratchet over a checked-in
  baseline* can go red on a new violation, an *echo of a compiler guarantee* never can.
- **UNRESOLVED, and it needs an owner answer, not a phase's judgement: D-1 makes G6 and `phases/30:235`
  mutually unsatisfiable.** G6 asserts `grep -c '"@runtime/' next.config.ts tsconfig.json` → `0`,`0`, which is true
  only if the seam deletes the aliases — D-1 = (a), the plan §3.1 generated-seam design and `phases/30`'s own stated
  default. `phases/30:235` asserts `APP_RUNTIME_MODE=demo npx tsc -p tsconfig.demo.json --noEmit` → 0, and
  `tsconfig.demo.json` is created by no (a) step — it *is* the (b) design (`phases/30:201-212`), which layers a demo
  typecheck on top of the aliases it refuses to remove (`phases/30:307` books "0 `@runtime/*` aliases" as a
  deliberate deviation). `phases/30`'s exit list carries both branches at once (`:229` needs (a), `:235` needs (b)),
  and the per-branch arithmetic is in *Evidence*. **This file does not resolve it** — D-points are human calls here —
  but it records that under (b) the surviving seam assertion is `phases/30`'s export-name `satisfies` check plus
  `typecheck:demo`, and G6 must be **withdrawn** rather than quietly left red.
- **Two CSS oracles and two size ratchets are scheduled for the same tree.** `phases/40` lands
  `scripts/css-selector-integrity.mjs` (unapplied classes, baseline **90**) and `scripts/size-ratchet.mjs`
  (exit 0 listing **exactly 4 exceptions**, `phases/40:220`); this file lands
  `scripts/check-css-selectors.mjs` (undefined usages, baseline **5**) and `scripts/check-size-budget.mjs`
  (`new FAILs 0 (baseline 13)`, `.size-baseline.json`). The two CSS rules are genuinely different axes and step 6
  now says so instead of both files claiming R-01; **the two size contracts are not reconcilable as written** —
  four exceptions and thirteen baseline entries are different statements about the same tree, and whichever
  ships, the other phase's exit gate fails on its own command line. Someone must pick one; `REFACTOR_PLAN.md:246`
  has a single §7.1.
- `ci.yml` grows two full builds plus a serial test leg against a ~11 s local baseline; above ~10 min, split
  into two jobs preserving step 3's manifest ordering **within** each (the ordering that survives — the
  stale-types part of it is a deletion, not a position).
- `REFACTOR_PLAN.md` stays outside prettier's reach (Phase 00's choice, re-affirmed here), and
  `api-error.v1.schema.json` loses `RATE_LIMITED` alongside `model RateLimitBucket` in one commit (Phase 1b
  executes; this phase's gate no longer forbids it).

## Regression register — revised

Dropped rows keep their numbers so the dossier's cross-references resolve. Markings per
`COMPAT-POLICY.md` §1's A/B/C scheme. Tally, checked against the dossier's 17 original rows: 7 dropped
(R-02/03/04/06/08/15/16, exactly `COMPAT-POLICY.md` §4 edit 10's set, adopted at §6) + 10 kept + 1 added =
**18 rows here, 11 live**. Per `COMPAT-POLICY.md:78` (§4 edit 10) §11's own header gains the
"rows removed by `COMPAT-POLICY.md`" line when the register is re-issued.

| # | Behavior | Class | Verdict |
| :--- | :--- | :--- | :--- |
| R-01 | QR credential printing after a CSS split | **C correctness** | **Keep.** Real defect: per-file class hashing can orphan `@media print` (`portal.module.css:4355-4391`, with `:global(body) > * { visibility: hidden }` at `:4356` and `.printSheet` re-selected at `:4360-4369`) from `.printSheet` (`:4140`) / `.credentialPrintCard` (`:4146`), whose sole owner `src/components/portal/player-credential-print-sheet.tsx` is **not** in the purge. **Refuted: this row used to say "G7 is its oracle" and it is not** — G7 runs usage→definition and stays green when the block is the orphan (step 6's direction note). The tripwire for this axis is `phases/40`'s **A2 print-pairing** rule + `misplaced-print` fixture (`phases/40:63-66,84-85`), which has not landed, and **that** is why D-3's deferral stands |
| R-02 | Mobile vs desktop nav styling | A framing / C substance | **Dropped as a register row** (no phase causes it); survives as a defect ticket + the oracle blind-spot warning. Mechanically re-confirmed by G7: `portal-navigation.tsx → portal.module.css#mobileNavItem` undefined (`grep -rn "mobileNavItem" src --include=*.css` → **0** files) |
| R-03 | Hydration flash on demo pages | A | **Dropped as a compat obligation**, retained as a **product decision** (step 9) |
| R-04 | Deep link to a demo-created class | A | **Dropped as a compat obligation**, retained as a **product decision**: created entities surface in place; the Pages 404 is documented, not defended. `[S]` the "Pages serves `out/404.html`" half rests on `ls out/404.html` (present) plus Pages' lack of rewrite capability, and `COMPAT-POLICY.md:116` leaves the live-URL fetch unconfirmed by the main agent |
| R-05 | Sign-in/out without JS; `basePath` correctness | **C** + **B** | **Keep.** Hosting correctness: `<form method="get">` bypasses `basePath` and 404s on Pages |
| R-06 | Cross-tab demo sync | A framing | **Dropped as a row**; the `storage`-vs-`CustomEvent` line fix (`use-demo-portal.ts:13-18`) is a **C** fact to carry into whoever edits that file |
| R-07 | Player credential leaking into logs | **C** | **Keep.** `src/server/observability/logger.ts:3-20` is the whole `sensitivePaths` array — the six cited names sit at `:10-15`, and `cred` is genuinely **absent**. The range this row first printed (`:3-16`) cut the array mid-list and hid four **real** connection-string/secret entries, named in *Evidence*. `cred` becomes the only token-in-URL flow after Phase 1. **Ownership, newly recorded:** nobody has the edit — `phases/20:252` says it is "fixed in the seam/CI phase", `phases/30` has no logger step, `phases/10:218` names it "deliberately not fixed here", and this phase freezes `src/**`. Class C, one line, and the only surviving token-in-URL path is the credential `phases/10` calls security-critical |
| R-08 | Previously published `/atividade/<token>` URLs | A (B4 residue) | **Dropped**; the only duty left is deleting `walkthrough.md:11` (step 11, repo root) |
| R-09 | Referrer isolation on `/jogar` | **C** | **Keep.** `proxy.ts:113` only; `proxy.test.ts` does not cover it (2 tests, `/entrar`), so it stays manual |
| R-10 | Offline queue survives the storage-layer split | **C** | **Keep.** Real defect awaiting `fake-indexeddb` characterization tests |
| R-11 | "Saved" indicator honesty | **C** | **Keep.** Real defect; last-wins + late-`fail`-rejects semantics |
| R-12 | Portal↔GameMaker protocol agreement | **B external** | **Keep.** The genuine class-B row (`protocol-error.v1`, sibling `Heroes_Trial`). Both `demo-game-adapter.tsx:16-20` and `game-host.tsx:652` hardcode `1` |
| R-13 | Demo QR issue → same-browser scan | **C** | **Keep.** `hashPlayerCredentialToken` needs `node:crypto`; unrunnable in a browser |
| R-14 | Status badge tone across 6 screens | **C** | **Keep.** Real defect; verify visually in `dev:demo` |
| R-15 | "An audit trail exists" | A | **Dropped** per D-6(b): `AuditEvent` is deleted, and `src/server/services/portal-view-service.ts:416` proves server mode always rendered an empty list (`export const auditEvents = demoRuntime ? demoAuditEvents : [];`, verbatim) — the file is in `src/server/services/`, not `src/application/portal/`, which is why it is cited by full path here |
| R-16 | GameMaker reads `RATE_LIMITED` | A, mislabelled B | **Dropped.** `api-error.v1.schema.json` is portal↔browser for `/api/v1/player/*`, unreachable under `output: 'export'`; the real vocabulary is R-12's file |
| R-17 | Every demo route after the purge | **C** | **Keep.** Manual checklist of §11.1, run against **26** documents and, separately, in `dev:demo` (which has no `basePath` and no export, so a `dev`-only pass proves nothing). This phase's Exit gate carries no item for it — plan §7.5's functional sign-off is *this* row plus the manual pass, and *Accepted breakage* records that no automated gate in the repo can reach it |
| R-18 | **NEW.** Player-entry error state renders without its class | **C** (pre-existing defect, found by G7) | **Add — and it is the register's strongest new row.** `styles.entryProblem` used at `src/components/public/player-entry-screen.tsx:143,162,181`; **no `.entryProblem` selector exists** in any stylesheet (`grep -rn entryProblem src --include=*.css` → only `.entryProblemIcon` at `public.module.css:842,854`), while `.entryCard` **is** defined (`:707`), so each of the three renders `public-module__…__entryCard undefined`. The file is not in plan §2.2/§2.3's delete set and not in `phases/10`'s 46-path manifest; its only importer is `src/app/(public-play)/jogar/page.tsx:1`, and `out/jogar/index.html` is one of the surviving 26. **It is in the artifact published today:** `grep -rl entryProblem out` → the shipped JS chunk `out/_next/static/chunks/0pvtinj9q2oay.js` (3 bare `entryProblem` reads inside `${ev.default.entryCard} ${ev.default.entryProblem}`) and the shipped CSS chunk `…/2nnyb6jqb_ito.css`, whose only `entryProblem*` token is `entryProblemIcon`. No phase causes it; the oracle caught it. **Ratchet, not zero-tolerance:** the gate ships with these three names baselined, because a day-one red on a pre-existing defect teaches an implementer to delete the gate |

## Documentation corrections

| File:line | Claim | Truth at `e5aaf1e` | Edit |
| :--- | :--- | :--- | :--- |
| `README.md:53`, `:59` | "`health/` liveness and readiness route handlers"; server subtree = `config/ db/ http/ observability/ services/` | `find src/app/health` → 3 empty dirs, **0 files**, `git ls-files src/app/health` → 0, `find out -type d -name health` → none; `src/server/` also holds `auth/ authorization/ security/`, and `services/` loses 7 of 12 files in Phase 1 | Delete the `health/` row (it has never existed in either target); restate the real, post-purge tree |
| `README.md:62`, `:74-78`, `:102` | "predates the numbered-player V1 direction … aggregate-only reporting"; "Slice 1 demo stores"; demo "does not represent player identity" | per-player slots/credentials exist (`adult-portal-demo-store.ts:252-266`); localStorage now covers orgs/team/classes/assignments/player access | Rewrite: the only divergence is that results screens read the seed, not localStorage; update scope + slice naming |
| `docs/current-architecture.md:175`, `:176` | route table lists `/atividade/[token]` as a live family and `/health/live`, `/health/ready` | both deleted / both never existed | Drop both rows |
| `docs/current-architecture.md:168,178,180-186,259-261` | "still represents the current demo implementation"; Materials "may remain temporarily" | route trees and both components deleted | Rewrite to past tense + add a "Runtime composition" section for the seam |
| `docs/schemas/database-model.md:3-5,49,50,51,52,56-65,84-123,127,139,151-153,162-169,171-177` | documents `capability_assignments`, `access_links`, `rate_limit_buckets` **and `audit_events`** (`:51` in the table, `:127` in prose) + their CHECK/index rows, the 6-value `Capability` enum, an access-link-centred model, and "Deferred models … added as new migrations" | all four dropped with their models in Phase 1b — `audit_events` only because `COMPAT-POLICY.md` §4 edit 7 was adopted at §6; migrations 2-5 already created the deferred tables | **Rewritten, not patched**: 196 lines, the "~14 stale rows" figure inherited from the earlier revision of this file and **not re-derived** (only `:51` and `:127` were located here, for `audit_events`), and it omits `player_slots`, `player_credentials`, `game_states`, `game_sessions`, `participations`, `class_groups`, `teacher_assignments` entirely. Outside the plan's Day-4 doc scope; now inside this phase's |
| `walkthrough.md:11`, `:24`, `:40-51` (repo root, not `docs/`) | publishes `https://niciniv.github.io/SMS_Portal/atividade/7FQ-29M/`; 12 purged routes listed as delivered | live today (Pages serves what `deploy.yml` published — `[S]`: `COMPAT-POLICY.md:116` records the main agent never reproduced the fetch), 404s after Phase 1; `src/components/portal/activity-controls.tsx:39-44` minted those tokens — `:39` builds `MC-<rand>-<rand>` from `Math.random()`, `:44` wraps it into the Pages URL — so rotated links 404'd from birth, and that whole file is in `phases/10`'s table B (156 ln) | Delete `:11`; strike the delivered-route list with a one-line archive pointer. Per `COMPAT-POLICY.md` B4 the **announcement, not a shim**, is the whole duty |
| `.env.example:22-23`, `:26` | `APPLICATION_SECRET` covers "rate-limit keys"; `READINESS_TIMEOUT_MS=2000` | rate limiter deleted (the var is still required by `next.config.ts:17` and `src/server/config/env.ts`); no `/health/ready` exists to read the timeout | Correct the comment, keep the var; delete the timeout var or implement the handler — decide and record |
| **NEW** `README.md` CI section | none exists | plan §7.4 is 0-of-4 true today (`deploy.yml` runs `npm ci` + `build:demo` only, `grep -c "run:"` → 2) | Add: what `ci.yml` enforces (the four legs), that both targets share `.next`, that the demo build is what fails on a server action (`E625`, not a gate), and that `out/` is a build artifact, not a committed tree (`git ls-files out` → 0). **Every line here that names a retired route or table must carry `<!-- compat-note -->` or G11 reds the explaining prose** (step 11) |
| `REFACTOR-DOSSIER.md` §2 row/§8.3 | "104 **committed** documents"; oracle "green today" | untracked; 5 violations | This file supersedes both sentences (the dossier body is not edited here — `COMPAT-POLICY.md` §4 states phases mirror corrections forward) |

## Handoff notes

- **Phase 1 (`phases/10`):** your PR owns the `104 → 26` edit in `ci.yml` (G4) **and** the expected-path list, plus
  removing `materialAudience` and the two dynamic `styles[…]` sites from G7's baseline. **But neither edit is in
  your own Work order**: `grep -n "ci.yml" phases/10-purge-generation-a.md` → 2 hits, neither a step, so today the
  edit exists only as handoff prose in three other files (`phases/00:159`, `phases/00:234`, this row). Give it a
  numbered step in your PR or the purge cannot merge behind branch protection — and note that `phases/00:235`
  books the same edit's "follow-through" to **P1b**, a second owner the main agent must collapse. The same
  double-booking sits on `walkthrough.md:11`: `phases/10` deletes it in its own purge PR (owner note `:101`, step
  `:262`) while this file's step 11 books it here — pick one PR, or one of the two exit gates is unmet on whichever
  tree ships. Also: the instruction this row used to print — "build `build:server` before any `typecheck` or you
  inherit 63 false `TS2307`s" — is **refuted**; step 3 and *Evidence* hold why (every `next build` is itself a
  project-wide typecheck, a fresh runner has no `.next`, and 63 is a workstation figure). The remedy is a
  `rm -rf .next/types .next/dev .next-demo-dev` step, not an order.
- **Phase 1b (`phases/20`):** **the drift leg is nobody's** — deleted, with no substitute booked to you or to any
  phase, and nothing in `ci.yml` may imply otherwise (no `services:` container, no `SHADOW_DATABASE_URL`, no
  `prisma.config.ts` edit; that file stays at its 12 untouched lines). The earlier text of this row handed you the
  DB-free byte-compare "in the form `COMPAT-POLICY.md` §4 edit 2 prescribes"; §6 **withdrew** that prescription with
  the edit-1 history collapse it depended on, and *Evidence* measures the command born red on a correct tree.
  `prisma validate` (G10) is the only schema check in `ci.yml`.
  What you do own: writing `6_drop_generation_a/migration.sql` and asserting it is **non-empty** — the exit-code
  contract is Empty **0** / Error **1** / Not-empty **2** (`migrate diff --help`, re-quoted verbatim in *Evidence*),
  so use `--exit-code` expecting **2**, or `test -s`, and remember that a plain `--script` run exits **0 on an empty
  diff**. If the drift question is ever answered, the trigger is a real database: add `datasource.shadowDatabaseUrl`
  to `prisma.config.ts` and land `migrate diff --from-migrations prisma/migrations --to-schema
  prisma/schema.prisma --exit-code` in `ci.yml` **in the same PR as the connection**. One stale leak, flagged to the
  main agent and not to you: `phases/00-prerequisites.md:150` still ends "Hand the leg to P1b with the exit-code
  contract …", describing a leg that no longer exists (*Evidence*).
- **Phase 2 (`phases/30`):** if you split `distDir`, every `.next/…` path in `ci.yml` changes in the same PR; add
  `typecheck:demo` (absent from `package.json`) right after `lint` — `package.json` is frozen by *Interfaces*
  above, so the script addition is yours to make and this phase's exit gate will simply read it — and
  **answer D-1 in writing before you touch G6**: under (a) G6 passes and your own `phases/30:235`
  `tsc -p tsconfig.demo.json` bullet has no config to point at; under (b) that bullet needs
  `tsconfig.demo.json` and `package.json` in the same PR, and G6 must be withdrawn as a recorded deviation
  (`phases/30:307`). If `src/runtime/target.ts` is generated **and** committed, `.prettierignore` first or G1
  fails on machine-written code.
- **Phase 3 (`phases/40`):** each lane re-runs G7/G8; `team-screen.tsx` (411) is 11 lines over and has no §4 step —
  splitting it to satisfy the ratchet contradicts §2.1(1)'s "zero JSX churn" promise. Choose and record.
  `npm run test:contracts` (`package.json:22`) is in no CI leg; R-12 half-depends on it. Decide.
  And the two-ratchet collision is now on the table (step 7, *Accepted breakage*): your
  `scripts/size-ratchet.mjs` (exit 0 listing exactly **4** exceptions, `phases/40:220`) and this file's
  `check-size-budget.mjs` (`.size-baseline.json`, **13** entries) are different contracts over plan §7.1's one
  table; one of the two exit gates is red on whatever tree ships. Your A2 print-pairing rule is also now named as
  R-01's oracle instead of this file's G7, which retires a duplicated claim as well as a mis-attributed one.
- **Owner, not any phase:** branch protection, Pages access logs (`COMPAT-POLICY.md` §5.1), whether
  `deploy.yml` should ever stop publishing on a bare push, **the D-1 answer that G6 and `phases/30:235` are both
  waiting on**, and the one-line `cred` entry in `src/server/observability/logger.ts:3-20` that four files defer
  and none of them books (R-07).

## Evidence

| Claim | Source / command run at `e5aaf1e` |
| :--- | :--- |
| `check` = `format:check && lint && typecheck && test`, in that order | `package.json:24` read this session |
| `format:check` red on exactly one file | `npx prettier --check .` → `[warn] REFACTOR_PLAN.md`, exit 1 |
| G2 is vacuous; export has no `api/`/`health/` dir; census 104 → 26 | `find out -type d -name api -o -type d -name health` → 0 lines; `next.config.ts:28` `output:"export"`; `find out -name index.html \| wc -l` → 103, `*.html` → 104, `-type f` → 554, the seven §2.2 trees → 78 docs ⇒ 26. §9.1 rows 1 and 5, `INV-F` §7.5 |
| 17 server-action ids, 4 route keys, 0 in demo | `.next/server/server-reference-manifest.json` read via `node -e` → `ids 17 actions 17` (17 `.node` / 0 `.edge`); `INV-F` gate baseline, `VER-F` |
| Both targets write one `.next`; demo dev alone gets `distDir` | `next.config.ts:26-28`; `INV-F` §CI "the `.next` collision"; §4 item 0.3 last bullet |
| Validators: 3 copies × 448 ln × 44 refs, **21** naming §2.2 trees | Entry-gate probe run here → `44 21`; `tsconfig.json:45-55`; **corrects** `REFACTOR-DOSSIER.md:99` "~55 lines / up to 60", `ADV-1` row 1/F3 and `ADV-3` table's "20 per copy"; agrees with `phases/00-prerequisites.md:96` (cause: `atividade/[token]/layout.js` is a layout) |
| `build:server` env = 4 Zod fields, server-only (`runtimeMode` parsed always); **no** reachable DB; `npm ci` offline | `next.config.ts:5-7,12-19`; `scripts/next-target.mjs:28-29,39,41-53`; `src/server/db/client.ts:10-25` (lazy `getPrisma()`); `src/app/(professional)/portal/layout.tsx:3,21-24` (`connection()`); `package.json:26` + `prisma.config.ts` attaching `datasource.url` only under `DIRECT_URL`; §4 item 0.4, `INV-F` §CI, Phase 00 exit gate |
| `deploy.yml` = publish-only, zero checks, no PR trigger | file read lines 1-50 this session (`:3-6` triggers, `:8-11` `pages: write` + `id-token: write`, `:15` `cancel-in-progress: false`, `:31` `npm ci`, `:34` `build:demo`, `:36-39` artifact, **`:41-50` deploy job — `deploy-pages@v4` is at `:50`**, not `:49`, which the earlier version of this row printed); `grep -c "run:"` → **2**; `INV-F` §CI table; plan §7.4 |
| **`ci.yml` does not exist at `e5aaf1e`, and Phase 00 authors it** | `ls .github/workflows` → `deploy.yml`; `test -f .github/workflows/ci.yml` → exit 1; author = `phases/00-prerequisites.md:101-144` (item 0.4, "new file"), whose P1/P2/P4 handoffs (`:234,:236,:238`) book three later edits into it. Consequence for this file: G12's old "fails right now" was a *file-missing* grep error, and steps 2/3/8 are edits to a file this phase cannot create |
| Order dependence needs **both** flags | `tests/unit/auth.test.ts:161-165` (`:163` deletes `APP_RUNTIME_MODE` **unconditionally**) vs `vitest.config.mts:13-15` (`env.APP_RUNTIME_MODE:"demo"`), `:12` `environment:"node"`; §4 item 0.2, `phases/00-prerequisites.md:85`, and `phases/00:248`'s executed `1 failed \| 32 passed` / `282 passed` / exit 1. **Refuted reviewer claim:** `tests/unit/portal-dev-bypass-actions.test.ts:46,55` was reported as a second deleter with the `delete` "inside the test body"; read on disk it is `:48 afterEach(` → `:54 if (originalRuntimeMode === undefined)` → `:55 delete` → `:57` restore, i.e. **conditional and inside `afterEach`**, and with `vitest.config.mts` injecting `demo` the guard never fires so the file restores rather than deletes. It is also in `phases/10`'s table C and dies with the purge (`phases/00:234` says so). `auth.test.ts:163` remains the only real mechanism |
| Demo store has no migrate-on-read; v1→v2 precedent | `src/runtime/adult-portal-demo-store.ts:124,137-138,148,346-356`; `git log --all -S 'adult-portal:v1' -- src` → `48b6c5d`, `06baea2`; `COMPAT-POLICY.md` §2 row 5, §3 C-3 |
| Created-entity deep links hit `out/404.html`, not a fallback list | `ls out/404.html` present; `demoId()` at `adult-portal-demo-store.ts:334-341`; `classes-screen.tsx:140,169-180`; plan §3.3 refuted by `INV-F` §Demo deep-link reality; §11 R-04 |
| `cred` unredacted; `proxy.test.ts` is 2 tests, neither on `/jogar` | `src/server/observability/logger.ts:3-20` — the whole `sensitivePaths` array (`:3` opens, `:20` closes; the six cited names are `:10-15`; `:16-19` are `DATABASE_URL`, `DIRECT_URL`, `NEON_AUTH_COOKIE_SECRET`, `APPLICATION_SECRET`, which the `:3-16` range this row and R-07 used to print cut off), **`cred` absent**; `grep -n "it(" tests/unit/proxy.test.ts` → `:7` CSP, `:19` correlation |
| **G3's condition is compiler-enforced: `build:demo` cannot exit 0 with an action present** | `node_modules/next/dist/export/index.js:375-385` — `const actionIds = [...Object.keys(serverActionsManifest.node), ...Object.keys(serverActionsManifest.edge)]` then `if (actionIds.some(id => extractInfoFromServerReferenceId(id).type === 'server-action')) throw new ExportError('Server Actions are not supported with static export.')`, `__NEXT_ERROR_CODE` value `"E625"` at `:380-381`; co-condition `nextConfig.output === 'export'` at `:360` (manifest itself required at `:359`), satisfied for every demo build by `next.config.ts:26-28`. The predicate this file's one-liner computes is the same function: `node_modules/next/dist/shared/lib/server-reference-info.js:36-37` (`parseInt(id.slice(0,2),16)`, `infoByte >> 7 & 0x1`) and `:47` (`type: typeBit === 1 ? 'use-cache' : 'server-action'`). Corroborated in the installed docs: `01-app/02-guides/static-exports.md:291` lists Server Actions among the features an export rejects. **Same-shape corroboration from a sibling phase:** `phases/30:233` already writes its own exit bullet as "`npm run build:demo` → 0 with **no E625**" and `phases/30:297-300` explains the gate is reached only on the demo target |
| **`next build` is itself a project-wide typecheck, so step 3's ordering premise is refuted** | `node_modules/next/dist/build/index.js:672-680` (`typeCheckingOptions`), `:904-907` ("For pages directory … after route collection but before build", skipped when `appDir`), `:1068-1073` ("For app directory, we run type checking after build" → `startTypeChecking`). `next.config.ts` has **no** `typescript` key, so `ignoreBuildErrors` is unset. Installed doc, verbatim at `…/05-config/02-typescript.md:39`: "**The CLI checks the complete project selected by your `tsconfig` file. This includes test files and `.next/dev/types` when they are included by that configuration.**" → three `tsc` passes per PR, not one |
| **63 is a workstation figure; no ordering clears the two dev copies** | `stat` mtimes on this tree: `.next/types/validator.ts` **2026-09-23 02:05**, `.next/dev/types/validator.ts` **2026-09-22 22:21**, `.next-demo-dev/dev/types/validator.ts` **2026-09-22 23:04** — only the first is a production build's; `cmp` says `.next/types` ≠ `.next/dev/types` (differ at line 50). Each copy: 448 ln, 44 refs, **21** naming §2.2, **4** naming `/api/v1/player/`; `.next-demo-dev/types/` (globbed at `tsconfig.json:52`) does not exist. Fresh-clone arithmetic: `out/`, `.next/`, `.next-demo-dev/` are gitignored (`.gitignore:5,6,7`) so a runner starts with none of them → 0 stale refs before the first build, and the 21 refs are **not errors today** (all 21 resolve to real `.tsx` files; measured) — they only become `TS2307`s in the window where the source is deleted and the validator is not regenerated. `phases/10:133` reaches the same conclusion from its side: "gate on the regeneration, never on a count" |
| The two published copies of the manifest one-liner were incompatible | the Gate inventory cell, extracted raw from the markdown and executed: `SyntaxError: Unexpected token '\|'`, exit **1** (the `\|\|` GFM escaping is mandatory in a table cell and invalid JS); the same body with the escapes restored, run against the on-disk **server** manifest: `E625-risk 17: src/app/(professional)/entrar/actions.ts, …` exit **1**. Fix applied: the table no longer prints a command body (G3's row) |
| **G11's rewritten body, executed** | `grep -qF "absent-token-xyz" README.md; echo $?` → **1** (a no-match grep *is* exit 1, so the old pass state reds a `run:` step); `! grep -qF "Portal" README.md` → exit 1 and `! grep -qF "zzabsentzz"` → exit 0 (negation is the fix, both directions measured). Body from step 11 run against the current docs → `G11: 19 stale-doc lines remain`, exit **1**. Per-pattern `-F` audit: `health/` 2, `/atividade/[token]` **2 → 0 without `-F`**, `access_links` 5, `capability_assignments` 4, `rate_limit_buckets` 4, `audit_events` 2 ⇒ **19 with `-F`, 17 without**, and **17 with the dossier's three-table set** (`README.md:53`, `docs/current-architecture.md:175,176,178`, the rest `docs/schemas/database-model.md`) |
| **G12's rewritten body, executed against four synthetic workflows** | comment-only impostor (`# … pull_request … lint … typecheck … test`) → fails at (ii); four-leg workflow → passes, and fails at (iv) once `pages: write`/`id-token: write` are added; one-step `run: npm run check` → passes; absent file → fails at (i). Old clause measured on the impostor: `grep -n "pull_request"` → line 1, i.e. a **comment** satisfies it. **Same treatment for the Exit gate's four drift-leg checks:** a compliant workflow passes all four; one carrying a `run: npx prisma migrate diff … --exit-code` leg plus a `services: postgres:` block and a doubled `prisma validate` fails at the first drift check; a missing file fails at `test -f` |
| **Test-count pairs reconciled by one static derivation** | `find tests -name '*.test.ts' \| wc -l` → **33**, `*.test.tsx` → **0**; `grep -rhoE "^[[:space:]]*(it\|test)\(" tests --include='*.test.ts' \| wc -l` → **229** static; **5** `it.each` sites (`neon-auth-gateway:44`, `runtime-mode:6`, `v1-contracts:150,172,178`), all three files surviving the purge ⇒ 284 − 229 = **55** dynamic; the six purged files by the same rule → 56/24/2/13/5/2 = **102** static, **0** `.each` ⇒ 33 − 6 = **27** files and (229 − 102) + 55 = **182**. So `phases/00`'s 33/284 and `phases/10`'s 27/182 are one measurement read on either side of the purge, and `phases/40:17`'s "33 files / 229 tests" is a grep of neither state. `[U]` the two executed totals (284, 282) need `vitest`, which this pass does not run |
| **G8's census, both states, with the classifier pinned** | scope `git ls-files 'src/**' 'tests/**' 'scripts/**' '*.ts' '*.mts' '*.mjs'` minus `src/generated` → **214** files; rule (`.module.css`→css, `tests/**`\|`*.test.ts(x)`→test, `src/{components,app}/**`+`.tsx`→component, else→module; FAIL above the second budget number) applied **twice**: at HEAD → **13 FAIL / 12 WARN**, and with `phases/10`'s 46 paths (`:30-51,59-76,82-87`) removed → **9 FAIL / 8 WARN**, the 9 named in step 7. This upgrades the post-purge half from `[U]` (the refutation could not reach it without another file's manifest) to re-derived, and the 5-debt set reproduces digit-for-digit. `wc -l` confirms the cited sizes: 1,024 / 1,017 / 688 / 540 / 411, plus `game-offline-sync.ts` **1,222** and `plan:162`'s own heading. `src/runtime/idb-store.ts` **does not exist** (a plan-estimated file, `REFACTOR_PLAN.md:165` "~650") |
| **The purge/alias disjointness this file's graph note rests on** | `grep -oE '"\./src/[^"]+"' next.config.ts` ∪ `tsconfig.json` → **17** distinct alias targets; intersection with `phases/10`'s 46-path manifest → **0**; `grep -rln "@/generated" src tests \| wc -l` → **47** (`phases/00:92`'s "48" is one high). `ls scripts` → `next-target.mjs`, `start.mjs`; `wc -l eslint.config.mjs` → 17, `grep -c max-lines` → **0** |
| **R-01's orphan axis, measured (why G7 cannot police it)** | `portal.module.css`: `.printSheet` base rule `:4140`, `.credentialPrintCard` `:4146`, `@media print` opens `:4355` with `:global(body) > * { visibility: hidden }` at `:4356` and re-selects `.printSheet` at `:4360-4362`, `:4365`, `:4369`; `grep -rln "portal.module.css" src \| wc -l` → **37**; sole owner `src/components/portal/player-credential-print-sheet.tsx` imports at `:14`, applies `styles.printSheet` at `:117`. G7's usage→definition rule reports nothing for that shape; `phases/40`'s A2 (`phases/40:63-66`) is the assertion that does |
| **D-1 ⇒ G6/`phases/30:235` unsatisfiability, read from both files** | `phases/30:201-214` (the (a)/(b) table; "**Default if unmade: implement (a)**"), `:229` (`@runtime/` in `src` → 0, "only under D-1 = (a); under (b) a recorded deviation"), `:235` (`APP_RUNTIME_MODE=demo npx tsc -p tsconfig.demo.json --noEmit` → 0, unconditional), `:307` ("If D-1 = (b) is taken, plan §7.2's '0 `@runtime/*` aliases' criterion is deliberately unmet"); `REFACTOR_PLAN.md:251` §7.2 carries both sentences; this file's G6 greps the **configs** (`next.config.ts:44-79`, `tsconfig.json:24-42`) which (b) preserves. Arithmetic: (a) → G6 0/0 ✓, `:235` has no `tsconfig.demo.json` ✗; (b) → `:235` ✓, G6 stuck at 9/9 ✗. No answer satisfies both; the owner must, and this file takes no side |
| G7 is **red today**: 5 violations / 50 module imports / 670 usages | prototype `node` script run against `src` this session; output transcribed in step 6. **Divergence from** §8.3 ("green today") |
| G8 baseline 13 FAIL / 12 WARN, 9/8 post-purge, 5 unbudgeted | census re-run this session (`git ls-files … \| grep -v '^src/generated'` + per-category budgets) — reproduces `INV-F` §7.1 table file-for-file; §8.5 |
| `src/app/health` is 0 files and untracked; `out/` likewise untracked | `find src/app/health` → 3 dirs, `git ls-files src/app/health` → empty (confirms `INV-F`'s `find … -type f` → 0); `git ls-files out \| wc -l` → 0, `.gitignore:7` `/out`; `COMPAT-POLICY.md` §4 edit 9 |
| **No schema-drift gate survives the ruling**, and the substitute with it | `COMPAT-POLICY.md:68-71` (edits 2-3, ADOPTED) + `:67` (edit 1, **REJECTED**) + `:69` ("only available if edit 1 is adopted") + §6 `:97-100`; `REFACTOR-DOSSIER.md:511` is the `ci.yml` order losing its `migrate diff --exit-code` clause; the cannot-run measurement (`--from-migrations` → exit **1**, "You must set `datasource.shadowDatabaseUrl` in your `prisma.config.ts` if you want to diff a migrations directory") is `phases/00-prerequisites.md` §4 0.3, quoted at `COMPAT-POLICY.md:70`. `prisma.config.ts` re-read here **[me]**: **12 lines**, keys are `schema`, `migrations.path`, and a conditional `datasource.url` from `DIRECT_URL` (`:4`, `:11`) — **no** `shadowDatabaseUrl`, and `grep -n -i shadow` over `prisma.config.ts` and `./node_modules/.bin/prisma migrate diff --help` → **0 hits in both [me]**, which is why no flag-only replacement exists. **And the withdrawn substitute was not merely inapplicable, it was born red [me]:** `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` → exit 0 / **367** lines against `prisma/migrations/0_init/migration.sql`'s **175** (386 ln across the six dirs), `diff` → exit **1** with 236 differing lines; under this file's own "1 is never a pass" contract that reads a *correct* tree as drift |
| G11 needs **four** dropped-table terms, not three | `grep -rnF -e audit_events docs/schemas/database-model.md` → `:51`, `:127` **[me]**; G11's pattern set prints **17** matches without `audit_events` and **19** with it **[me]** — the +2 is this phase's own gate blind spot, created by `COMPAT-POLICY.md` §4 edit 7 (adopted at §6) deleting `model AuditEvent` while `docs/schemas/database-model.md` still documents its table |
| `out/` is 104 documents, untracked, and published only by `deploy.yml` | `find out -name '*.html' \| wc -l` → **104**, `find out -name index.html \| wc -l` → **103**, `find out -type f \| wc -l` → **554**, the seven §2.2 trees → **78** ⇒ 26 post-purge **[all re-run me]**; `git ls-files out \| wc -l` → **0**, `.gitignore:7` → `/out` **[me]**. So "104 committed documents" (`REFACTOR-DOSSIER.md:54`) is a wording error, corrected by `COMPAT-POLICY.md:77` (edit 9) and confirmed at §6 `:109` — every PH-50 sentence about `out/` says "in the current local export", never "committed" |
| The real class-B error vocabulary is `protocol-error.v1` | `COMPAT-POLICY.md:46` (§3 **B2**) and `:28` (§2 row D-5) — `api-error.v1.schema.json` is portal↔browser and unreachable under `output:'export'`; §12 row 2 and §11 R-16 mislabel it. *(This row previously cited "§2 row 6", which is the D-6/`AuditEvent` row at `:30` — wrong row, right conclusion.)* |
| Ratchet reading governs §7.1 | `docs/architecture-audit-2026-09-23.md:744-746` via §8.5; plan `:246` "new or modified" |
| Report-level sources | `REFACTOR-DOSSIER.md` §9.1-§9.4 (`:496-527`), §11 (`:566-592`), §12 (`:596-607`), §13 (`:611-622`), §14 (`:626-638`), §8.5 (`:484-490`), §4 (`:88-106`); `reports/INV-F-gates-ci-demo.md`; `reports/VER-F-gates-ci-demo-verification.md`; `reports/ADV-1-sequencing-integration.md` (rows 1, F3, F4); `reports/ADV-3-scope-and-regressions.md:211,384`; `reports/AUDIT-dossier-correctness.md`; `reports/RV-50-gates-refutation.md` (the pass this file's revisions answer to); `reports/RV-X-cross-phase-consistency.md` (§1 N2/N3/N4/N14, §2 under-declared edge, §3 M2/M3/M5/M6, §6 U8/U9, §7 D1/D2/D5); `COMPAT-POLICY.md` §2-§6 — **§6 governs wherever §4's original recommendation differs**. §6's "files this ruling invalidates" list is at `:118-123` (this row used to print `:116-119`), and its PH-50 bullet at `:121` names this file "for the Phase-1b handoff row" at *"lines 65 and 357-359"* — pointers that were already ~50 lines
stale when written and now live, respectively, in *Gate inventory*'s closing paragraph and in *Handoff notes* →
"Phase 1b". **Cite this file's sections, never its line numbers, in cross-references**; sibling `phases/00-prerequisites.md`, `phases/30-composition-seam.md`, `phases/20-schema-and-migration.md` |
| **Cross-file conflict — status updated by measurement, not by vote** | This row previously asserted that `phases/00-prerequisites.md` §Handoff "still instructs P1b to add `datasource.shadowDatabaseUrl` … assert exit 2 = drift". **Re-read on disk it is no longer true:** `phases/00:235` now opens "**the drift leg is nobody's — it was deleted, and it has no substitute**" and closes "So `prisma validate` is the whole schema check, and **no gate covers `schema.prisma` ↔ migration-history drift**", which is the same ruling this file states, and `COMPAT-POLICY.md:123` records the fix. Two residues survive in that file and neither is this phase's to edit: **`phases/00:150`** (step 5's divergence 3) still ends "Hand the leg to P1b with the exit-code contract **Empty: 0 / Error: 1 / Not empty: 2**", describing a leg that no longer exists, and **`phases/00:235`'s last clause** hands "the `104 → 26` doc-count follow-through from P1 above" to P1b, giving one `ci.yml` line two owners (`:234` books it to P1's PR, as step 2 does). Both flagged to the main agent. |
