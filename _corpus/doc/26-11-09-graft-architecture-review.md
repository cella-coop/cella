+++
title = "Graft Architecture: Astra's review, 9 November"
updated = 2026-11-09
+++

> Astra's adversarial review of the Graft Architecture design against
> main `f29312e8`, kept as it was written. It is the reference for its
> findings until each is answered; where it and the docs differ, the
> docs say how cella is and this page what was found.


Reviewed `cella` main `f29312e8`, remote stream histories and workshop records. Paths below are relative to `cella/` unless prefixed otherwise; **G** means `graft-architecture.txt`. This is static inspection, not a test run. Overall priority order: **1, 2, 6, 7, 11, 3**, then **4, 5, 8, 9, 10, 12, 13, 14, 15, 16**. Sections retain the requested A–E grouping.

**Evidence limitation:** G's extraction has lost individual clause status badges: “enforced convention accepted proposed” survives only as a legend (G:320); no sidebar clause retains its status. Consequently B audits all enforcement-bearing clauses, rather than inventing which were marked enforced. Restore textual status labels before treating this as a complete badge-by-badge certification.

## A. Contradictions

### 1. High — Optionality is false today, and its proof omits runtime dependencies

“Who may act is core” and “Every feat outside core can be removed” (G:336–338) conflict with `membership` registering the global authority: `INSERT INTO cella.authority ... membership.may` (`apps/org/feats/person/feats/membership/core/sql/013-authority.sql:31–32`). Main explicitly assigns authority to membership (`_corpus/doc/architecture.md:115–117`). Removing it changes every slice's authorization, despite no forbidden package import.

The people-to-core stream moves identity, not this authority or the motion roll. Registrations, required effects and shell imports also survive the package-edge argument.

**Fix:** make the authority/roll split a prerequisite; define removal as pruning a subtree plus all affected registrations, grafts and composition-root imports. Prove behavior with a pruned integration build, not merely package edges.

### 2. High — Moving data into core currently removes protections

“All slices,” including core feats, own writes and obey guards (G:220,351–361). But `sql-check` deliberately exempts `kind === 'core'` from own-schema DDL, policy-wording and clock refusals (`tools/sql-check.mjs:204–215,244–254`); TypeScript foreign-write scanning excludes app-core packages (`tools/feat-check.mjs:373–380`).

**Fix:** distinguish privileged notary infrastructure from ordinary core slices in the checker before moving person/motion/policy. Core permanence must not imply exemption from ownership or determinism.

### 3. High — The remote-functions plan chooses the opposite owner

G puts `api/remote/task.remote.ts` in each slice (G:130–131). Stream `26-11-09-every-slice-s-api-is-sveltekit-remote-functions-and-the-shell-reads-and-writes-through-them`, commit `70aee1b7`, instead specifies: “The remote functions are the shell's,” under `src/lib/remote/<family>.remote.ts`, “so a slice writes no SvelteKit.” REST commit `8637d41c` similarly plans one shell endpoint.

**Fix:** rule explicitly whether protocols are slice-owned implementations or shell adapters over a framework-independent slice API. Update both plans and the folder diagram together; client imports of generated remote proxies also need an explicit layering exception.

### 4. Medium — The target tree is presented as the checked tree

G's `core/{libs,feats,grafts}`, leaf packages and `app.toml` (G:107–159,325–328) differ from main's `core/<lib>/{ts,rs}`, leaf `core/ts`, and app `feat.toml` (`_corpus/doc/architecture.md:35–61`). `feat-check` recognizes only the latter (`tools/feat-check.mjs:56,85–99,129–140`).

The layer-first stream moves leaf slices but explicitly keeps libraries language-first (`c42bb9f6`); the people stream targets `core/person`, not `core/feats/person`. No inspected stream implements the whole new core hierarchy, finance nesting or motion promotion; policy is already a core library.

**Fix:** label the tree “target,” add a current-to-target mapping and a dedicated core/tree migration plan. Do not describe its paths as presently enforced.

### 5. Medium — SQL API is simultaneously mandatory and undecided

“Across a module boundary, SQL reaches only the api's SQL” (G:368) contradicts “Whether and when to require it” (G:313). Main allows grafts direct joined-schema access (`tools/sql-check.mjs:159–173`). The SQL-API and GraphQL remote refs both equal main and have no planned commits; `corpus stream show` reports neither as an ongoing stream.

**Fix:** choose accepted versus proposed. Specify stable referenced keys separately from views, version compatibility, and how migrations discover module ownership. A normal PostgreSQL view cannot itself supply an FK target's uniqueness constraint.

## B. Enforcement claims

### 6. High — “Only through the notary” is not a five-check guarantee

`writes` explicitly permits `cella.*` targets (`tools/writes.mjs:205–209`); it does not reject `cella.begin`/`submit` calls. Qualified foreign writes are checked, but dynamically constructed SQL and unqualified targets are not (`writes.mjs:14–16,189–209`). The architecture audit's `b3305387` plans precisely these missing notary checks; it is not implemented code.

Table binding is **runtime**, via the DDL event trigger (`apps/org/core/notary/sql/007-notarised.sql:24–30`) and `notarised` (`core/notary/rs/src/surface.rs:468–509`, under `apps/org/`). Superuser unbinding and erasure remain exceptions; `trust.md:692–701` also says a write can change more than its payload claims.

**Fix:** qualify G:351–354 as application-write rules under the documented trust model; name runtime enforcement and exceptions. Land the audit checks, retaining explicit static-analysis limits.

### 7. High — Exports are checked; architectural layering is not

For G:363–366, `feat-check` only allowlists export **keys**, including `.` (`tools/feat-check.mjs:301–313`). It does not inspect exported targets/re-exports, prohibit another slice's `/app`, order internal layers, or match typed sockets/plugs. `ui-check` checks selected client/server imports, not the full dependency matrix (`tools/ui-check.mjs:163–175`). Audit commit `c8baa25d` plans inward-layer checking; sockets have no corresponding implementation found.

**Fix:** mark each missing check separately; resolve package aliases and export targets, enforce `/app` consumers, and add failing fixtures for re-export laundering and unmatched plugs.

### 8. Medium — Tree, SQL and action checks: real, but narrower than the clauses

| Clause in G | Actual enforcement |
|---|---|
| Nesting/inheritance; names; external brand/site/diagrams; ancestry; placement/declaration (323–330,342–345) | `feat-check:64–126,175–266` checks the **current** tree. It proves declaration by a joined feat, not which feat semantically “extends.” No arbitrary new core layout support. |
| No core-to-optional dependency; pruned build (337) | Manifest-edge rule at `feat-check:113–116`; no all-optional-pruned build found. |
| SQL references/own-schema DDL/FKs (330–333,352) | `sql-check:198–215,858–872,1025–1065`; FK exceptions are circle/grantee, **not any core feat**; the FK check also applies to grafts, refusing literal FKs into joined feats despite G's junction-key claim. Core exemptions: finding 2. |
| Writes, reactions, guards (353) | `writes:189–219`, `sql-check:1648–1707`, `feat-check:411–426`; qualified static writes and registered `on` causes, not proof of all runtime behavior. |
| Power, grant, fold (355) | `powers:39–99,115–156,178–186`; declaration/SQL agreement, fixture grants and presence of a fold registration. `first`, rights and stance powers are exceptions to “a mandate”; registration is not replay correctness. |
| RLS (356) | `sql-check:445–470,908–914`; migrated database checked through `circle.unsecured` (`migrate:238–245`). Not protection against a hostile host (`trust.md:709–726`). |
| Clock/policy wording (360) | `sql-check:213–215,244–254`, non-core SQL only. |
| Migration order/immutability (349–350) | `migrate:72–102,185–189`; `migrations:24–28`. Hashes protect files already applied to that database, even **before** launch; no repository-wide append-only proof. |

**Fix:** replace universal “refuses” with these scopes and exceptions; reconcile graft/core FK rules with the checker; cite negative tests (`tools/_tests/{tree,writes,powers,reads,migrations}.test.mjs`) per clause, not per tool.

### 9. Medium — UI enforcement does not establish the stated abstraction

“A graft ... has no pages” (G:332) is not checked by the startup registry: every slice may register collections (`apps/org/ts/src/lib/server/slices.ts:168–175`). Extension reach is checked, but includes joined ancestors and **all core collections**, not only joined feats (`:177–195`).

The explicit state-class claim (G:271) is overstated: `ui-check:119–130` requires a `hooks/*.svelte.ts` location, not a class or `createContext` wiring. CSS rejection covers Svelte style blocks/attributes, not every standalone stylesheet (`:119–122`).

**Fix:** narrow the wording or add class/context, stylesheet and graft-page checks; document the actual extension exceptions.

### 10. Medium — Remaining clauses have no named static enforcement

No matching check was found for: one module owner; module exclusion from app core; removable-only nesting; unlinked-record validity; preferring pairs; universal circle-owned settings; semantic lowest guard placement; handler permission coverage/no duplicated TS guards; actionable refusals; socket declarations; four protocols/module SQL boundaries; module installation/upgrades/DAG/retirement/activation (G:338–349,358–360,362–363,366–378). New layer/SQL-folder placement is planned, not checked today.

The notary's package/extension exists, but that is construction, not a refusal check. Reporting is restricted by the analytics port, not a universal ban on server joins (`apps/org/core/analytics/ts/src/check.ts`; `_corpus/doc/architecture.md:443–447`).

**Fix:** label these convention/accepted/proposed individually. Give machine-checkable omissions tickets rather than calling them inherently invisible.

## C. Gaps

### 11. High — Retirement needs a dependency-closure and replay contract

“Removing a module freezes its tables and keeps its folds” (G:376) does not say what happens to active dependent modules, grafts, registrations or FKs. A retained fold can call removed functions or expect an obsolete schema. `trust.md:182–185` already requires versioned folds, a stronger obligation than retaining current code.

**Fix:** define active/retired dependency closure, retained executable/schema versions, erasure behavior and reactivation. Require replay across install–upgrade–retire sequences. No module-lifecycle implementation plan was found.

### 12. Medium — Operational writes and shared reads need explicit exceptions

The ownership axiom does not distinguish application writes from migrations, folds, erasure and live-body buffering. Main migrations deliberately set `cella.unbound` (`tools/migrate.mjs:218–222`). “Owns who may read” also omits registries, owner-rights analytics and disclosure suppression; these are substantial existing contracts, not simply RLS.

**Fix:** add a short exception taxonomy linking `trust.md` and analytical contracts; state who authorizes each path and whether it is replayed. Require the body-session plan to specify its server-signed saves and durable buffer within that taxonomy.

### 13. Medium — Publication identity does not fit the naming axiom yet

App-global unhyphenated feat names (G:324) can collide across publishers; reverse-DNS module names (G:372) do not resolve this. “Schemas derived from the name within ... 63 characters” remains open (G:314), while main schema derivation assumes bare feat names.

**Fix:** choose stable qualified identities, collision-resistant schema encoding and migration IDs before defining module manifests; keep display/graft names separate.

## D. Plan alignment

### 14. Medium — Plans need one reconciled target and dependency order

These are ongoing stream names (without `origin/`), not assertions that their planned commits are implemented:

| Stream / evidence | Direction and necessary change |
|---|---|
| `26-11-09-every-slice-s-api-is-sveltekit-remote-functions-and-the-shell-reads-and-writes-through-them` | Toward remote transport; away from slice ownership. Resolve finding 3. |
| `26-11-09-every-action-is-served-at-post-api-feat-verb-and-every-read-at-get` | Toward REST; shell adapter, not per-slice endpoints. Preserve signing/reader contracts. |
| `26-11-09-a-slice-s-folders-are-its-layers-and-the-language-comes-second` | Toward leaf/layer layout; `ef703035` plans SQL splitting and inner-to-outer migrations. Sequence with checker changes and core promotion. |
| `26-11-09-every-architecture-rule-names-the-tool-that-refuses-it-or-says-no-tool-can-see-it` | Toward honest enforcement; add core-slice parity, pruning, exports and sockets. Its enforcement document describes some still-planned checks. |
| `26-11-09-people-are-org-s-core-as-circles-are-and-the-inbox-with-them` | Toward mandatory identity; reconcile `core/person` versus `core/feats/person`, authority split and FK rules. |
| `26-11-07-every-record-has-a-body-of-blocks-and-a-thread-of-comments` | Current branch aligns: `core/body` has “no schema, no SQL and no actions”; task owns comments/reactions. Rename G's `blocks` or plan's `body`. Workshop's 8-Nov update still says core **keeps** bodies/comments: supersede that stale update explicitly. |
| `26-11-07-every-setting-shows-its-value-and-saves-it-or-proposes-the-motion-that-changes-it`; `26-11-08-the-co-op-s-particulars-are-a-policy-the-assembly-adopts-and-its-organization-page-proposes-a-change` | Toward circle-owned governance/settings; neither moves motion/authority to core. Add that dependency. |
| `26-11-05-the-log-folds-into-a-scope-s-non-personal-state-and-lanterne-s-year-proves-it`; `26-11-05-a-scope-restores-to-any-point-in-time-across-a-vault-key-s-rotation` | Toward replay/recovery; add module-version replay and retirement tests. Restore is still held/conflicted, not delivered. |
| `26-11-07-a-co-op-s-numbers-hold-past-their-old-widths-and-the-log-verifies-a-page-at-a-time`; `26-11-07-the-ratchet-keeps-the-pawls-of-confidential-hosting-and-the-steps-towards-it` | Compatible scale/trust work; preserve explicit limits rather than treating host autonomy as security. |
| `26-11-08-the-org-app-ships-as-nix-packages-and-a-nixos-module-runs-its-demo-scope`; workshop `26-11-09-the-production-host-is-configured-in-the-workshop-checked-and-not-deployed` and `26-11-09-bacillus-is-configured-in-the-workshop-at-hosts-dev-bacillus-and-deploys-from-its-main` | Compatible deployment work, **not** installable domain modules. Add configurable module-set builds later; keep dev/runtime CLI distinction. |

Other listed UI/editor/authority presentation streams are compatible, not implementations of new axioms. No substantive GraphQL, SQL-API, finance-node, motion-core or domain-module lifecycle plan was found in the inspected refs. **Fix:** publish an ordered architecture migration stream covering those holes.

## E. Soundness

### 15. Medium — Several “corollaries” require new premises

Ancestry does not force *lowest* placement: its graft exception permits an ancestor to join the same endpoints. Nor does it prohibit graft-owned pages, require an analytics shell, or imply RLS. Ownership can be enforced with other access-control mechanisms. Modularity alone does not imply permanent retirement storage.

**Fix:** classify these as explicit design choices, as the document already does for naming; reserve “derived” for consequences with stated premises.

### 16. Medium — The recursive base case and core order remain ambiguous

Every feat may be a node, every node has a core, and every core holds feats/grafts (G:322), yet leaves have no core folder. “Ancestors, never siblings” also leaves core libraries' mutual dependencies and ordered core feats unresolved (G:335). Current migrations topologically order core libraries (`tools/migrate.mjs:77–93`).

**Fix:** distinguish logical node from directory representation; define the leaf base case and an explicit acyclic core dependency graph. Do not leave core ordering open while claiming migration order follows uniquely.

## What holds up

- Grafts as relationship owners and proper-subset composition are concrete, substantially checked ideas.
- Qualified foreign-write checks, power/fold registration checks and migration hash refusal have real implementations and negative tests.
- Shared behavior with slice-owned data matches the latest body plan.
- Node/package/module are useful distinct concepts; the document correctly surfaces publication and upgrade questions.

