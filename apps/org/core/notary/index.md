+++
title = "Notary"
updated = 2026-10-25
+++

The `cella` Postgres extension (pgrx, Postgres 18): the notary and the rule primitives as SQL, in schema `cella`. Every item is a thin wrapper over `cella-rules` (`core/rules/rs`) with no logic of its own, and the whole SQL surface is declared in one file, `rs/src/surface.rs`, whose header lists it; `rs/src/notary.rs` is the SPI plumbing `submit` and `verify_log` need.

The notary is the scope's office for every write, and a layer under every feat rather than a feat: it holds no collection and has no writes of its own. It signs a receipt when a write arrives, runs the rules that attach to it, then signs a numbered verdict; it never decides an outcome, which is computed from the signed votes and can be computed again by anyone holding the log. Moving a scope's notary is moving its database to another host, a rung-6 concern ([ratchet](../../../../_corpus/doc/ratchet.md#moving-a-notary)); peers, other scopes' notaries, arrive with federation at rung 5.

## Surface

| SQL | What |
|---|---|
| `cella.amount` | positive cents, with `=`, `<>`, `<`, `<=`, `>`, `>=`, `+`, a btree class, casts from `bigint` and to `numeric` |
| `cella.amount(bigint)`, `cella.cents(amount)`, `cella.allocate(amount, bigint[])` | construct, unwrap, split exactly by weights |
| `cella.digest(text)`, `cella.digest(bytea)` | the plain BLAKE3 of the text's UTF-8 bytes or of the bytes, as `b3sum` computes it; immutable, so a generated column may hold it |
| `cella.document_canonical(bytea)`, `cella.document_hash(bytea)`, `cella.document_text(bytea)` | a Loro snapshot's canonical JSON, its BLAKE3 and its plain text (`cella_rules::document`); immutable, so a document version's generated columns hold them; a snapshot with no canonical form raises SQLSTATE `22000` |
| `cella.consent(member, stance, receipt)`, `cella.majority(…)`, `cella.share(member, stance, receipt, num, den)` | aggregates; each member's highest-receipt stance counts, so they take no `ORDER BY`; `share` passes when at least `num` in every `den` of the stances for and against are for |
| `cella.verdict_date()` | the transaction's verdict date, fixed at first use and recorded by `submit` |
| `cella.receipt()` | the transaction's receipt number: one write, one receipt, taken at first use from a sequence; a rolled-back write leaves a gap here, never in the log |
| `cella.submit(op, payload, actor, signed)` | checks the member's signature, that the payload restates the request, the device and the nonce, runs the op's rules, signs the receipt and appends a numbered, signed entry; returns `(verdict, state, reason)` |
| `cella.op()`, `cella.actor()`, `cella.device()` | the write `submit` is judging, for rules to read; NULL outside it |
| `cella.signed(n, request)` | whether a request is what receipt `n`'s member signed: salted with the salt the receipt keeps, its digest is the one their signature names; NULL for no such receipt or one from before 0.3.0; the owner's |
| `cella.verify_log()` | rechecks the chain, every receipt, every signature, the member's and the notary's, each under the key in office at its entry as `cella.signer` keeps it, and the head; it never reads the key file, so a log verifies after its key is rotated or lost |
| `cella.notary_key()` | the public key of `cella.key_file`, which signs the next entry |
| `cella.head`, `cella.log`, `cella.receipt`, `cella.receipt_seq` | the log, its head row and its signed receipts |
| `cella.signer` | every key the notary has signed with: its id, its public key and `since`, the first entry it signed; each receipt and entry names its signer by `key` |
| `cella.rule`, `cella.rule_text`, `cella.keyring`, `cella.power` | the registries: rules per op and their texts, the keyring, the power each op needs |
| `cella.retention`, `cella.personal` | the retention classes, each with its clock in years, whether the law keeps it (restricted) and its basis; and the columns holding personal data, `(schema, tab, col, class, subject, owner)`, each registered by the feat or graft owning the table, `subject` naming the column that says whose it is. A trigger refuses a column that does not exist or that erasure could not redact: NOT NULL and neither text nor JSON |
| `vault.key`, `vault.secret`, `vault.erased`, `vault.swept` | the vault ([below](#the-vault)); only the owner reads it, but `vault.erased`, which everyone may read |
| `cella.opened(n)` | entry `n`'s logged payload with its commitments opened: the value, `restricted` or `redacted`; the owner's, which the app reaches through `cella.disclosed` |
| `cella.vault_sweep()` | erases the restricted data whose clock has run out on the verdict date; a superuser's, run by `cella vault sweep` |
| `cella.vault_rewrap()` | seals every vault key under the wrap key of `cella.vault_key_file`, moving each that opens only under `cella.vault_key_previous`, and returns how many moved; a superuser's, run by `cella vault rewrap` |
| `cella.redacting()` | whether the notary is redacting right now: the one change a record that never changes takes, which a feat's trigger keeping a row fixed lets through; no role can set it |
| `cella.redact(subject, class)` | the owner's: sets a subject's registered columns of a class to `redacted` (text), `"redacted"` (JSON) or NULL |

The org core's SQL beside the extension (`sql/`) adds the app's role and
the rules', and who reads ([below](#reads)):

| SQL | What |
|---|---|
| `cella.reader()`, `cella.writing()` | the person this transaction reads for, from `cella.actor`, which the server sets from the session; and whether it is a write's, from `cella.writing`, which `write` sets for its transaction |
| `cella.authority`, `cella.reading`, `cella.reach` | the registries of who reads: the one function saying whether a member holds a power on a day, a graft's; the powers that read a feat's rows, `(what, key, power, owner)`; a graft's functions opening a joined feat's rows to more readers, `(what, fn, owner)` |
| `cella.may(power)` | whether the reader holds the power on the verdict date, as the authority says |
| `cella.reads_all(what)`, `cella.sees(what)`, `cella.reaches(what, key)` | whether the reader holds a power that reads every row of `what`; whether they see every row: a write's transaction, a current role past row-level security (a superuser's tools, or a function running as its owner to sum the whole), or such a power; and whether they reach one row by its key: a power for that key, or a graft's function |
| `cella.disclosed(n)` | entry `n` opened, for the reader who wrote it, whom all its commitments are about, or who holds its op's power; null for anyone else |

## Submit

A handler opens a transaction, writes its state, calls `cella.submit` last and commits. `signed` is `{ request, device, salt, nonce, sig }`, bytes in hex: what the member asked for, the salt its digest is taken with, and their device's signature on it ([signatures](../../../../_corpus/doc/signatures.md)). `submit`:

1. checks the signature over the scope (`cella.scope`), the op, the actor, the device, the salted request's digest and the nonce;
2. checks that the payload restates the request where it says the same thing: each top-level field of the request that the payload holds with a value of the same JSON kind has the same value there, a personal value compared by the value it marks (`cella_rules::sign::restates`), so the server cannot log that the member asked for what they did not sign; a value of another kind under the same name, such as the id of the file stored for the file sent, is the server's own and restates nothing;
3. locks the head row, which the first write makes;
4. asks the keyring, the one function registered in `cella.keyring` (the `person` feat's), whether the device is a current key of the actor;
5. refuses a nonce a receipt of the same device already holds;
6. takes the payload out of personal data ([the vault](#the-vault)): each marked value committed to and sealed, each marked erasure carried out, giving the payload as the log keeps it;
7. runs every rule registered for the op in `cella.rule (op, fn regprocedure, owner)`, ordered by owner, on that logged payload, with `cella.op()`, `cella.actor()` and `cella.device()` set;
8. signs the receipt, keeping the request's salt beside it, and appends the entry naming it, with the logged payload, both with the key of `cella.key_file` and naming it by its id in `cella.signer`: the first time a key signs, it is registered there as in office from that entry, and a key a later one replaced is refused, so a retired key never signs again.

A rule is a `STABLE` function `(payload jsonb) → text` that sees the transaction's own writes and returns `NULL` to accept or a reason to refuse; a volatile rule or one of another shape is an error. The keyring is a `STABLE` function `(actor text, device bytea) → text` of the same kind. Both run as `cella_rules`.

On a refusal, at any step, `submit` raises SQLSTATE `09000` (`triggered_action_exception`) with the reason as the message, so the transaction cannot commit: the state and the verdict roll back together, the verdict number is not used and the nonce is not spent. Feats' triggers raise the same code, so a handler maps `09000` to `Refused`. The rows `submit` returns are therefore always `settled`.

Each receipt holds its number, the op, the actor, the device, the nonce, the request's digest, the member's signature, the payload's digest and the time it arrived, hashed with BLAKE3 and signed. Beside them, outside the hash, it keeps the salt of the request, which the digest it hashes is taken with: given the salt, `cella.signed(n, request)` says whether a request is what the member signed, so what a member signed can be checked against the payload later wherever the payload restates it. The salt is the owner's alone, since anyone else could confirm a guess of the request with it, and so is `signed`; a receipt taken before 0.3.0 kept none. Each entry holds its number, op, actor, verdict date, the digest of the logged payload, its receipt's number and hash, and each deciding rule's owner, signature and text digest; the text itself goes to `cella.rule_text`. Entries are hashed over the previous hash and signed with Ed25519. Beside them, `cella.log.form` keeps the logged payload, personal values replaced by commitments, from which the state folds; `verify_log` checks that it hashes to the entry's digest.

## The vault

Personal data never enters the log. A handler marks each personal value a payload carries, `{"$personal": {"field": "schema.table.column", "subject": …, "value": …}}`, for a field registered in `cella.personal`; every other object key starting with `$` is refused. `submit` replaces it with `{"$commit": hex}`, the BLAKE3 commitment, under its own domain, to a fresh 256-bit salt and the value, and stores in `vault.secret` the commitment, the receipt, the subject, the class, the year, the field, the salt and the value sealed with XChaCha20-Poly1305 under the subject's key for the class and the verdict's year (`vault.key`, made on first use from Postgres's strong random source and itself sealed under the wrap key derived from the vault's own key file, `cella.vault_key_file`, never from the notary's seed). The same value written twice commits differently.

A payload marks an erasure as `{"$erase": {"subject": …, "classes": […]}}`, every class when none is named; `submit` carries it out under the head's lock and logs `{"$erasure": {"subject", "erased", "restricted"}}`. For an erasable class (`profile`, `contact`) it deletes the subject's keys and sealed values, so its commitments no longer open, and redacts the class's registered columns in the read models (`cella.redact`). A restricted class (`payroll`, `expense-receipt`, `books`), which the law keeps, loses only the keys whose clock has run out and is marked restricted; `cella.vault_sweep()` erases it in full once its clock, counted from the erasure's year, runs out. Either way a tombstone in `vault.erased` refuses any later value of the subject's class: erasure wins. A key's clock runs `years` full years past the end of its year: books from 2025, kept ten years, may be destroyed from 1 January 2036.

`cella.opened(n)` reads an entry's logged payload back with its commitments opened, checking each against its salt: the value, `restricted` while the law keeps it, `redacted` once erased. The log verifies the same before and after an erasure, since erasure deletes what a commitment opens to, never the commitment.

`cella.power (op, power, amount, owner)` names the power each op needs and the payload field holding its amount in cents, registered by the op's feat; the extension holds no rule over it: the `circle-membership` graft attaches one to every op listed.

The log tables and the registries are readable by everyone, but the log's `form` and a receipt's `salt`, and writable by no role but the extension's owner and the migrations; `submit`, `receipt`, `verify_log` and `notary_key` are `SECURITY DEFINER` with a pinned `search_path`. Only `cella_app` may execute `submit` and `receipt`.

## Reads

The app's role reads every table but where a feat keeps row-level
security, and its policies ask the functions above
([architecture](../../../../_corpus/doc/architecture.md#sql),
[trust](../../../../_corpus/doc/trust.md#one-server)). `cella.log.form`
is the owner's alone: every other column of the log stays everyone's,
and the vault opens to the app only through `cella.disclosed(n)`.
`may` and `reaches` call the functions their registries name, so each
is a `STABLE` function of the shape it is registered for.

## The rules role

Rules never run with the owner's rights. `submit` runs each rule as `cella_rules`, a role that cannot log in, is no superuser, bypasses no row security and owns nothing; each feat and graft grants it `USAGE` and `SELECT` on its own schema, and a table keeping row-level security gives it a policy reading every row, and nothing more. `SET ROLE` is refused inside a security-definer function, so `submit` switches the way Postgres itself does for one: it sets the user id to `cella_rules` in a security-restricted operation around each rule call (`SetUserIdAndSecContext`) and restores it on return, on unwind and, through the transaction's abort, on any error. The keyring runs the same way. A rule therefore cannot write a table, take a receipt, call `submit`, read `cella.key_file` or the key file itself; `submit` refuses a rule declared `SECURITY DEFINER`, and the role is refused if it is a superuser or bypasses row security.

## Settings

- `cella.key_file` (`postgresql.conf` only): a file holding the scope's 32-byte Ed25519 seed. `cella db start` generates a dev key in `.data/notary.key`; it is never committed. Pointing it at a new key rotates the notary's key: the next entry registers it as the next signer ([operations](../../../../_corpus/doc/operations.md#keys)).
- `cella.vault_key_file` (`postgresql.conf` only): a file holding the vault's own 32 random bytes, from which the wrap key sealing every vault key is derived; kept apart from the notary's seed, so either rotates alone. `cella db start` generates a dev one in `.data/vault.key`.
- `cella.vault_key_previous` (`postgresql.conf` only): the vault key file before a rotation, read only to open a vault key still sealed under it until `cella.vault_rewrap()` has moved it; unset once it has.
- `cella.clock` (superuser only): a fixed verdict date, `YYYY-MM-DD`, for fixtures and tests. Unset, the date is the clock's day in the scope's timezone, read once per transaction.
- `cella.timezone` (superuser only): the scope's timezone, an IANA zone such as `Europe/Paris`, whose day is the verdict date, so a cutoff or a period's close falls on the co-op's day and not on UTC's, an hour or two apart around midnight. Unset, UTC. `cella seed` sets it on the database from the fixture's `scope.toml`; the shell reads its today from `cella.verdict_date()` too.
- `cella.scope` (superuser only): the scope's address, such as `lanterne.example`, which every write signature names. Set in `postgresql.conf` or on the database; `cella seed` sets it on the database from the fixture's `scope.toml`, and beside it `cella.scope_name` and `cella.scope_legal_name`, the co-op's name and legal name, which the notary never reads and the shell calls the co-op by, and the mentions its invoices print (`cella.scope_form`, `_capital`, `_siren`, `_rcs`, `_vat`, `_seat`; [operations](../../../../_corpus/doc/operations.md#a-scopes-server)).

The library is loaded through `shared_preload_libraries` so its settings exist before any session sets them.

## Build

`cella ext build` packages it with `cargo pgrx package` into `.data/ext`; Postgres 18's `extension_control_path` and `dynamic_library_path` load it there, since the Nix store is read-only. The devshell provides cargo-pgrx, `pg_config`, the server headers and bindgen's libclang flags, so `cargo check --workspace` builds it too.

The extension's version is its own, `version` in `rs/Cargo.toml` (0.3.0), and changes with every change to its SQL. `rs/sql/` keeps each earlier version's install script, as pgrx generated it, and the upgrade script from it, `cella--<from>--<to>.sql`, written by hand; `cella ext build` stages them all beside the generated one, since pgrx stages only the upgrade scripts and a rehearsal installs an earlier version; an org migration appended to `sql/` then runs `ALTER EXTENSION cella UPDATE`, so a database keeps its log, its receipts and its vault through every change of the notary, never `DROP EXTENSION` ([operations](../../../../_corpus/doc/operations.md#upgrades)). A fresh install makes no head row, so a dump of the head restores into one.

`sql/001-cella.sql` creates the extension and the app's role, `cella_app`; `sql/002-rules-role.sql` creates `cella_rules` and keeps `submit` and `receipt` to the app; `sql/003-vault.sql` keeps `opened` to the app and the sweep to a superuser; `sql/005-signers.sql` updates a database made before 0.2.0 in place and makes the head row of a new one; `sql/006-salts.sql` updates one made before 0.3.0. The extension keeps `vault_rewrap` and `signed` to their owner itself.

## Tests

`rs/src/tests.rs` holds the notary's own `#[pg_test]`s, which `cella test notary` runs in Postgres on a cluster pgrx makes and drops: a signed write settles and keeps its salt, and `signed` knows its request from another; an unsigned write, a signature by another key, a request swapped under its signature, and one signed for another scope, op or actor are refused, as is a payload restating a field otherwise; a nonce counts once; the keyring refuses an unknown, another member's or a revoked device, and no keyring refuses every write; a rule refuses with its reason and is named by its entry; the verdict date is the day in `cella.timezone`, or the fixed clock in any zone; and the chain breaks wherever an entry, its form, its receipt, the head or a signer is altered, and where an entry chains to anything but the one before. Each runs in a transaction that rolls back, on a keyring and devices of its own, and the notary signs with a TEST-ONLY seed.
