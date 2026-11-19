+++
title = "Rules language spike"
updated = 2026-11-19
+++

# Rules language spike

Lanterne's real rules, written in five candidates and run over the same
facts. `facts/convert.mjs` turns the fixture into `facts/lanterne.json`;
`facts/cases.json` holds 18 permission requests, 7 proposed writes and 4
surplus splits. Every runner prints the same line format into its
`output.txt`, and `run.sh` compares each with the TypeScript one (the
WASM run, `rust/output.wasm.txt`, is by hand under wasmtime).

The fixture holds two things only as prose, so the converter maps them by
hand: mandate powers to action ids, and the 45/40/15 split in d-2026-006's
body. Both need fields before any rules language can read them.

## Results

All five agree on every line they can express (CEL in two runtimes).

| Case | Outcome |
|---|---|
| d-2026-012, admit Inès (consent, AG) | **passes**, still open until 31 Oct: 8 of 10 have consented; Hugo's latest stance (seq 31, consent) supersedes his objection; Sofia and Malik have not voted |
| d-2026-011, 2027 day rate (consent, coordination) | **fails** while Malik's objection stands; open until 9 Nov |
| d-2026-006, 2025 accounts (majority) | passes 9 for, 0 against, 1 abstain |
| d-2026-007, internal rules v3 (consent) | passes, 10 consents |
| Surplus 61 400 € at 45/40/15 | work 27 630 €, reserves 24 560 €, interest 9 210 €; every legal bound holds |
| Requests p01–p18 | 8 allowed, 10 denied, identical in all five |
| Writes w01–w07 | closed period, unbalanced, overpaid and voided each refused; the three valid writes pass |
| The books as they stand | all 40 entries balance; no invoice overpaid; the voided F-2026-0050 took no payment |

| Candidate | Lines agreeing with TS | Not expressible |
|---|---|---|
| Rust (native and `wasm32-wasip1` under wasmtime) | 36 / 36 | — |
| CEL (Rust `cel` crate and JS `cel-js`, same `rules.toml`) | 36 / 36 | — |
| Soufflé, 64-bit build | 36 / 36 | — |
| Cedar | 29 / 36 | the 4 decision outcomes, the 3 checks of the existing books, the split amounts |

### Findings the runs surfaced

- **Negative amounts pass everywhere.** Cedar's SymCC answered "can anyone
  outside operations pay a supplier?" with a counterexample at
  `amount: -1`. Every encoding here, including TS and Rust, accepts a
  negative payment. A money type that cannot be negative fixes it.
- **nixpkgs' Soufflé uses 32-bit numbers and wraps silently**:
  `6 140 000 × 4 500` came out as 1 860 196 224, which gave a split of
  1 860 € for work, with no error. The 64-bit domain needs a source build
  (`-DSOUFFLE_DOMAIN_64BIT=ON`); the wrapped run is kept in
  `datalog/output.32bit.txt`.
- **CEL is strict about int and uint.** serde turns non-negative JSON
  numbers into `uint`, and `0 + uint` then fails at runtime. The host has
  to convert values itself.
- **Standard CEL has no fold.** Summing entry lines takes a host function
  (`sum`), registered separately in each runtime. I found no `cel.bind` in
  cel-rust 0.15, so the latest-stance list is its own rule, and the host
  passes its result to the next one.
- **Datalog aggregates run over sets.** Two identical entry lines would
  count once, so every line and vote carries an index.
- **Cedar has no quantifier over a set of records**, so a position held
  from one date to another cannot be checked in a policy. The host
  flattens positions to the ones held on the request day, and an auditor
  replaying a past request has to rebuild that day's entity store.

## Rule kinds

| | Cedar | CEL | Soufflé | TypeScript | Rust |
|---|---|---|---|---|---|
| 1 Mandates, AG votes | yes | yes, mandates as data | yes, mandates as data | yes | yes |
| 2 Invariants | only with host-computed sums | with a host `sum` | yes | yes | yes |
| 3 Consent, majority | no aggregation | yes, quadratic latest-stance | yes | yes | yes |
| 4 Surplus split | checks the bounds, no division to compute it | yes | yes, if 64-bit | yes | yes |
| Rule lines (logic only) | 63 policies + 40 schema | 36 | 41 + 33 declarations | 77 + types | ~85 + types |

## Properties

| | Cedar | CEL | Soufflé | TypeScript | Rust |
|---|---|---|---|---|---|
| Read by a coop member | best: `permit … when { amount <= 300000 }` with prose ids | short rules fine; nested `exists` gets dense | logic style, low | code | code |
| Determinism | by construction | by construction (map iteration order is unspecified, and nothing here relied on it) | sets are deterministic; overflow is not | by discipline only: `Date`, `Math.random`, floats are all in reach | `#![no_std]` lib cannot reach a clock, file, network or RNG; floats denied by clippy; `overflow-checks` on |
| Termination | guaranteed (no loops) | guaranteed (non-Turing-complete; cel-js adds parse limits) | guaranteed without arithmetic in recursive heads | none | none; wasmtime fuel can bound it for auditors |
| Analysis | **symbolic over every possible store** (SymCC + cvc5, run here) | type check, AST references; no semantic queries | queries over today's facts (run here: only Camille pays outside operations, up to 20 000 €) | none | none |
| Rules as governable data | text: hash, sign, adopt, replay by version | text | text | code; only its parameters | code; only its parameters |
| Rust | `cedar-policy` 4.14, `cedar-policy-symcc` 0.7 | `cel` 0.15 (MIT, run here) | no; C++ (ascent and crepe compile rules into the binary) | needs an embedded JS engine | native |
| Browser / JS | `@cedar-policy/cedar-wasm` 4.14 (updated 2026-10-19) | `@marcbachmann/cel-js` 8.0 (MIT, run here), `@bufbuild/cel` 0.6 | none found | native | WASM: `wasm32-unknown-unknown` builds; `wasm32-wasip1` runs identically under wasmtime (348 KB) |
| Postgres | none found | `pgcel` 0.1.0, pg14–15 only, looks stale | none | plv8 is removed from nixpkgs (it depended on the insecure Node 20) | pgrx 0.19.3, or the notary process in the same transaction |
| Maturity, licence | AWS-backed, Apache-2.0; the CLI ships without `symcc` (rebuilt here with `--features analyze`) | Google spec, Apache-2.0 reference (cel-go 0.32); third-party Rust and JS ports | academic, UPL-1.0, 2.5 | — | — |

The analysis gap between the languages narrows once mandates are data.
Every candidate except Cedar reads the same `mandates` table, so "who can
pay a supplier" is a query on that table in any language. What Cedar adds
is proof over *every* entity store, and that is the tool that found the
negative-amount hole.

## General-purpose languages

**What they give up.** The logic is not data a coop adopts by decision:
a new kind of rule ships as a release. Neither enforces termination or
answers "can anyone outside operations pay?" by itself. TS cannot enforce
determinism without a sandbox (SES, or QuickJS with no host APIs), has
floats by default, and on a Rust notary means a second runtime.

**What they gain.** Every rule kind fits with no host shims; the DSLs
needed four (`sum`, int conversion, flattening, a 64-bit build). Real
types, tests, debuggers, one language with the app or notary. Rust reaches
the browser and auditors from the same source, confirmed here byte for
byte.

**What a restricted subset recovers.**

- Determinism: a `#![no_std]` Rust crate with floats denied and overflow
  checks on gets most of it by construction; TS only by lint and sandbox.
- Governability: what Lanterne changes by decision is parameters (who
  holds which mandate, caps, the rule per circle, split percentages), not
  logic. Typed, versioned tables in the log cover that.
- Analysability: a closed API (mandate table, fixed procedures `consent`,
  `majority`, later `threshold`, a non-negative money type) makes common
  questions data queries. Symbolic proof is not recovered.
- Termination: fixed, reviewed procedures matter less than coop-authored
  text; auditors can meter WASM with fuel.

## Recommendation

**Shared Rust**, answering trust.md's open question: one `#![no_std]`
rules crate in org's core (`ops`), with procedures, invariants and
computations as pure functions over typed facts. The notary links it, and
the TS app and auditors load it as WASM. The coop's governance lives in
typed parameter tables (mandates, decision rules, split bounds) that are
adopted by decision and versioned in the log. Money is a non-negative cents
type.

Keep **Cedar** in reserve for permissions if coops start writing
free-form policies. It is the only candidate here that proves properties,
and it runs in Rust and WASM. **CEL** is the fallback if coops need custom
conditions as data: it is small, terminating, and two independent
implementations agreed here.

**Main risk:** the logic is code, not data. A coop that wants a procedure
the crate lacks waits for a release, and rules no tool can analyse
symbolically sit inside the trusted base. Determinism rests on `no_std`,
lints and cross-target replay tests, not on the language. The second risk
is that the TS app depends on a WASM build of the crate.

## Not run

- **Catala**: not in nixpkgs; an opam install exceeds the 15-minute box.
- **Biscuit's Datalog** (`biscuit-auth` 6.0, `biscuit-wasm` 0.6): versions
  checked, not run; unverified whether it has the aggregates voting needs.
- **Nemo**: no crate or npm package found.
- **Cedar's Lean-verified model, its Go port, `pgcel`**: registry or
  project claims only.
