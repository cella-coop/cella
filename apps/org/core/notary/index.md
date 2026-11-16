+++
title = "Notary"
updated = 2026-11-16
+++

The `cella` Postgres extension (pgrx, Postgres 18): the notary and the guard primitives as SQL, in schema `cella`. Every item is a thin wrapper over `cella-guards` (`core/guards/rs`) with no logic of its own, and the whole SQL surface is declared in one file, `rs/src/surface.rs`, whose header lists it; `rs/src/notary.rs` is the SPI plumbing `submit` and `verify_log` need.

The notary is the scope's office for every action, and a layer under every feat rather than a feat: it holds no collection and has no actions of its own. It signs a receipt when an actor's attempt arrives, runs the guards that attach to it, then signs a numbered verdict, and appends after it, in the same transaction, the effects that decision carries, each an entry citing it ([below](#effects)); it never decides an outcome, which is computed from the signed votes and can be computed again by anyone holding the log. Moving a scope's notary is moving its database to another host, a rung-6 concern ([ratchet](../../../../_corpus/doc/ratchet.md#moving-a-notary)); peers, other scopes' notaries, arrive with federation at rung 5.

## Surface

| SQL | What |
|---|---|
| `cella.amount` | positive cents, with `=`, `<>`, `<`, `<=`, `>`, `>=`, `+`, a btree class, casts from `bigint` and to `numeric` |
| `cella.amount(bigint)`, `cella.cents(amount)`, `cella.allocate(amount, bigint[])` | construct, unwrap, split exactly by weights |
| `cella.digest(text)`, `cella.digest(bytea)` | the plain BLAKE3 of the text's UTF-8 bytes or of the bytes, as `b3sum` computes it; immutable, so a generated column may hold it |
| `cella.lthash(text)`, `cella.lthash_add(a, b)`, `cella.lthash_times(a, k)`, `cella.lthash_zero()`, `cella.lthash_sum(bytea)` | the multiset hash the fold keeps of each state table, LtHash16 (`cella_guards::multiset`): an element's hash, its BLAKE3 output under a key of its own extended to 2048 bytes, 1024 lanes of 16 bits; the lane-wise sum of two modulo 2^16, a null the empty multiset; a hash times a count, `-1` its inverse; the empty multiset's; and the aggregate summing a column of them. Immutable, from 0.12.0 ([architecture](../../../../_corpus/doc/architecture.md#folds)) |
| `cella.document_canonical(bytea)`, `cella.document_hash(bytea)`, `cella.document_text(bytea)` | a Loro snapshot's canonical JSON, its BLAKE3 and its plain text (`cella_guards::document`); immutable, so a document version's generated columns hold them; a snapshot with no canonical form raises SQLSTATE `22000` |
| `cella.consent(member, stance, receipt)`, `cella.majority(…)`, `cella.share(member, stance, receipt, num, den)` | aggregates; each member's highest-receipt stance counts, so they take no `ORDER BY`; `share` passes when at least `num` in every `den` of the stances for and against are for |
| `cella.verdict_date()` | the transaction's verdict date, fixed at first use and recorded by `submit` |
| `cella.receipt()` | the transaction's receipt number: one write, one receipt, taken at first use from a sequence; a rolled-back write leaves a gap here, never in the log |
| `cella.begin(op, actor, device)` | opens a write, after `BEGIN` and before its state: the transaction may write the registered state tables, and commits only with the verdict `submit` appends for the same action, actor and device ([below](#bound)); one per transaction |
| `cella.submit(op, payload, actor, signed)` | checks that the transaction began this write, the member's signature, that the payload restates the request, the device and the nonce, runs the action's guards, signs the receipt and appends a numbered, signed entry; returns `(verdict, state, reason)` |
| `cella.follow(op, payload, cause)` | appends an effect: an entry with no signature of its own, on the authority of entry `cause`, which this transaction appended and whose op `cella.follows` lets `op` follow; runs the op's guards as `submit` does; returns `(verdict, state, reason)` ([below](#effects)) |
| `cella.forgo(op, cause, why)` | records an effect its guards refused, or one forgone with a required effect refused, after its savepoint rolled back: an entry citing `cause`, an entry this transaction appended, settled or forgone, recorded forgone, its logged payload `{"reason": why}`; returns `(verdict, 'forgone', why)` |
| `cella.cause()` | the number of the entry the effect `follow` is judging cites; NULL outside it |
| `cella.action()`, `cella.actor()`, `cella.device()` | the action `submit` or `follow` is judging, its id, its actor and their device, for guards to read; NULL outside it, and the device NULL for an effect, whose actor is its decision's |
| `cella.signed(n, request)` | whether a request is what receipt `n`'s member signed: salted with the salt the receipt keeps, its digest is the one their signature names; NULL for no such receipt or one from before 0.3.0; the owner's |
| `cella.verify_log()` | rechecks the chain, every receipt, every signature, the member's and the notary's, each under the key in office at its entry as `cella.signer` keeps it, and the head; it never reads the key file, so a log verifies after its key is rotated or lost. It reads the log ten thousand entries at a time, each page in an SPI connection of its own, its rows read in a child of SPI's context, so the values pgrx copies out of them land in SPI's, which the connection frees before the next page; read in SPI's own, they would land in the transaction's and stay to the end of the call. So it holds one page whatever the log's length: whole, a million-entry log verifies in the memory its last ten thousand entries take |
| `cella.verify_log(after)` | the same over the entries after entry `after`, the end of a write, chained from that entry's hash as it stands; each receipt keeps the entry that names it (`cella.receipt.entry`), which `submit` writes with it under the head's lock, so every receipt keeping an entry after `after` must be one an entry it walked names, read up the receipts' index of the entries they keep, and a receipt no entry names keeps none, which the index of those finds wherever its number falls, before the checkpoint's receipts or after them; a write numbers its receipt before it locks the head, so an entry may name a lower number than the one before it, which verifies. It reads no entry and no receipt before entry `after`'s, so it costs what follows `after`, not the log's length. Where a checkpoint the fold recorded is trusted, a verification starts there, never from the first entry ([folds](../../../../_corpus/doc/architecture.md#folds)) |
| `cella.notary_key()` | the public key of `cella.key_file`, which signs the next entry |
| `cella.head`, `cella.log`, `cella.receipt`, `cella.receipt_seq` | the log, its head row and its signed receipts |
| `cella.signer` | every key the notary has signed with: its id, its public key and `since`, the first entry it signed; each receipt and entry names its signer by `key` |
| `cella.guard`, `cella.guard_text`, `cella.keyring`, `cella.power`, `cella.follows` | the registries: guards per action and their texts, the keyring, the power each action needs, and which op may follow which as its effect, `(cause, op, owner, required, since)`, each row registered by the feat or graft that carries or reacts through `cella.lets_follow(cause, op, owner, required)`, a superuser's, from its migration, `required` saying the cause stands only with the effect from entry `since` on, the first after the row was registered or its requirement changed ([below](#required-effects)) |
| `cella.state`, `cella.notarise(tab)`, `cella.notarised()` | the registered state tables, `(schema, tab)`; registering one, a superuser's, which installs on it the notary's trigger; and the trigger, which refuses a row no begun transaction writes ([below](#bound)) |
| `cella.retention`, `cella.personal` | the retention classes, each with its clock in years, whether the law keeps it (restricted) and its basis; and the columns holding personal data, `(schema, tab, col, class, subject, owner)`, each registered by the feat or graft owning the table, `subject` naming the column that says whose it is. A trigger refuses a column that does not exist or that erasure could not redact: NOT NULL and neither text nor JSON |
| `vault.key`, `vault.secret`, `vault.erased`, `vault.swept` | the vault ([below](#the-vault)); only the owner reads it, but `vault.erased`, which everyone may read |
| `cella.opened(n)` | entry `n`'s logged payload with its commitments opened: the value, `restricted` or `redacted`; the owner's, which the app reaches through `cella.disclosed` |
| `cella.vault_sweep()` | erases the restricted data whose clock has run out on the verdict date; a superuser's, run by `cella vault sweep` |
| `cella.vault_rewrap()` | seals every vault key under the wrap key of `cella.vault_key_file`, moving each that opens only under `cella.vault_key_previous` and naming its new wrap key, and returns how many moved; a superuser's, run by `cella vault rewrap` |
| `cella.vault_reerase(erasures jsonb)` | carries out again each erasure of a list, as `cella backup` writes it, that the vault holds no tombstone for: deletes the subject's keys and sealed values of each erasable class, restricts each restricted one, redacts their columns and writes the tombstone, with the erasure's date and no log number, since the entry that made it is past the restored head; returns how many it carried out, and run again carries out none. A superuser's, run by `cella restore` before the database opens to the app ([operations](../../../../_corpus/doc/operations.md#backups)) |
| `cella.redacting()` | whether the notary is redacting right now: the one change a record that never changes takes, which a feat's trigger keeping a row fixed lets through; no role can set it |
| `cella.redact(subject, class)` | the owner's: sets a subject's registered columns of a class to `redacted` (text), `"redacted"` (JSON) or NULL |

The org core's SQL beside the extension (`sql/`) adds the app's role, the
guards' and the analytics', who reads ([below](#reads)), the folds and a document's line arithmetic, so the extension ships no new version for them. It is the one core SQL that makes `cella.*` and reads the clock ([architecture](../../../../_corpus/doc/architecture.md#sql)):

| SQL | What |
|---|---|
| `cella.reader()`, `cella.writing()` | the person this transaction reads for, from `cella.actor`, which the server sets from the session; and whether it is a write's, from `cella.writing`, which `write` sets for its transaction |
| `cella.authority`, `cella.reading`, `cella.reach` | the registries of who reads: the functions saying whether a member holds a power on a day, and which owning circles its mandates cover, the membership feat's; the powers that read a feat's rows, `(what, key, power, owner)`; a graft's functions opening a joined feat's rows to more readers, `(what, fn, owner)` |
| `cella.may(power)`, `cella.covered(power)` | whether the reader holds the power on the verdict date, by any mandate, as the authority says; and the owning circles their mandates for it cover that day |
| `cella.circles(what)`, `cella.sees(what)`, `cella.reaches(what, key)` | the owning circles whose rows of `what` the reader reads, by the powers that read them; whether they see every row: a write's transaction, or a current role past row-level security (a superuser's tools, or a function running as its owner to sum the whole); and whether they reach one row by its key: a power for that key, or a graft's function |
| `cella.disclosed(n)` | entry `n` opened, for the reader who wrote it, whom all its commitments are about, or who holds its action's power; null for anyone else |
| `cella.line_amount(quantity, unit_price)`, `cella.line_vat(amount, rate)` | a document's line arithmetic, which every feat that bills or is billed calls, and the vat library prices a write's lines by ([vat](../vat/index.md)): a line's amount in cents, its quantity times its unit price rounded to the cent; and the VAT on an amount at a rate in percent (`5.50`), rounded to the cent, so a document's VAT by rate adds up to its lines' |
| `cella.records(n)` | the records entry `n` is about, by the name its form holds each under: every plain text or number under its op's thing or a slice its op names, `{"invoice": "F-2026-004"}` for `invoice:invoice:send`, `{"role": …, "circle": …}` for `circle:role:seat`; never a commitment nor any other of the form's values, so Activity links an entry to its record and reads nothing else of the form |
| `cella.about(op, form)`, `log_about` | the same ids as text, a function of an entry's op and form alone, and the log's GIN index of them, the extension's, which finds the entries about a record without reading the log |
| `cella.made(ids)` | each id's first and latest settled entries about it, `(id, created, created_by, updated, updated_by)`, their dates and actors, through `log_about` for a thousand ids or fewer, as a page asks, and by one read of the log for more, since the index looks many ids up at once at a cost that grows with the square of their number; a forgone effect counts for neither, and an id no entry names has no row. What it reads is every reader's already, an entry's date and actor and the ids `cella.records` gives, and the core read asks it only for the rows the reader reads ([db](../db/index.md)) |
| `cella.fold`, `cella.lets_fold(op, version, fn, owner)`, `cella.folds_of(op, n)` | the folds: each slice's fold of an action by version, `(op, owner, version, fn, since)`, registered by the slice from its migration, a superuser's, `since` the first entry after it; and the folds entry `n` of `op` runs, each owner's version in force at `n`, the action's own slice's first, then core's and the feats', then the grafts' by how many feats they join ([architecture](../../../../_corpus/doc/architecture.md#folds)) |
| `cella.fold_log(upto)`, `cella.fold_head`, `cella.checkpoint` | a procedure, a superuser's, that applies the log copied into a database by its folds from the entry after the fold's head through `upto`, one write per transaction, committed with the head, `cella.clock` set to each entry's date, the founding's carried rows before its folds and an entry's erasures after them; how far it has applied the log; and the checkpoints `cella fold` records, `(n, hash, state)` |
| `cella.carry()`, `cella.fold_carried(n, carried)` | the state the founding carries, read inside its write and granted to the app: every registered state table's rows by its name, without their generated columns, a decimal or a JSON value as its text, each personal value marked `$personal`, and each sequence's value; and its application before the founding's folds, a superuser's, as a replica loads a snapshot, each table's rows in place of the migrations', each personal value by its commitment |
| `cella.commitment`, `cella.commits(field, subject, n, logged)`, `cella.fold_erasures(n, form)` | the commitments a fold applied, `(field, subject, n, commitment)`; a personal value as a fold writes it, its commitment kept there and its column answered `redacted`, or null for a null, refusing a value the log keeps plain; and an entry's erasures as the notary carried them out, each class erased losing its commitments and its columns redacted by `cella.redact`. A superuser's |
| `cella.state_rows(schemas)`, `cella.committed(field, subject, value)`, `cella.generated(schema, tab)`, `cella.folded()` | the rows of the schemas' state tables in the canonical order the state hash reads, each table by name and its rows as JSON text sorted bytewise, without their generated columns, a personal text column null where its value is, before the vault or a fold's commitments are read, so one a later write cleared reads null in the scope and in its fold, and any other personal column as `cella.committed` gives it; a personal column's value as the log holds it, the newest commitment the vault keeps for its field and subject, or in a folded scope the newest `cella.commitment` keeps, one entry's greatest first, or the value where neither keeps one; a table's generated columns; and each slice's schema, whether it is folded and its actions with no fold, the actions its log holds read up the log's index of them (`log_op`), a probe each, so it costs the actions' count, never the log's length. The owner's, as the vault is |
| `cella.table_hash`, `cella.slot`, `cella.keep_hashes()`, `cella.rehash()`, `cella.state_hash(schemas)`, `cella.kept_hash(schemas)` | the multiset hash a fold keeps of each state table as it writes, `(tab, hash)`, and each personal field's count of a subject's rows, `(field, subject, count)`, by which a new commitment moves every one of those rows' terms at once; the triggers `cella fold` makes on every state table and on the commitments it applies, which keep them only with `cella.folding` on, as `cella.fold_log` sets it, each table's hash from scratch where none is kept; every hash and count from scratch, where a fold begins and once the founding's carried rows are in; and the state hash of the schemas' tables, the BLAKE3 of a line for each by name, its name, a tab and its hash in hex, from every row read, or unnamed of the folded slices, and from the kept hashes alone, reading no row, as a checkpoint takes it. A superuser's ([architecture](../../../../_corpus/doc/architecture.md#folds)) |
| `cella_analytics` | the role the analytics shell reads as: it logs in, its transactions are read-only, and it is granted nothing here; `cella migrate` grants it the views the slices publish in their analytical contracts and nothing else ([trust](../../../../_corpus/doc/trust.md#the-analytics-role)) |

## Submit

A handler opens a transaction, begins its write with `cella.begin(op, actor, device)`, writes its state, calls `cella.submit` last and commits. `signed` is `{ request, device, salt, nonce, sig }`, bytes in hex: what the member asked for, the salt its digest is taken with, and their device's signature on it ([signatures](../../../../_corpus/doc/signatures.md)). `submit`:

1. checks that the transaction began this write, by the same action, actor and device, and refuses one not begun or begun as another;
2. checks the signature over the scope (`cella.scope`), the action, the actor, the device, the salted request's digest and the nonce;
3. checks that the payload restates the request where it says the same thing: each top-level field of the request that the payload holds with a value of the same JSON kind has the same value there, a personal value compared by the value it marks (`cella_guards::sign::restates`), so the server cannot log that the member asked for what they did not sign; a value of another kind under the same name, such as the id of the file stored for the file sent, is the server's own and restates nothing;
4. locks the head row, which the first write makes;
5. asks the keyring, the one function registered in `cella.keyring` (the `person` feat's), whether the device is a current key of the actor;
6. refuses a nonce a receipt of the same device already holds;
7. takes the payload out of personal data ([the vault](#the-vault)): each marked value committed to and sealed, each marked erasure carried out, giving the payload as the log keeps it;
8. runs every guard registered for the action in `cella.guard (op, fn regprocedure, owner)`, ordered by owner, on that logged payload, with `cella.action()`, `cella.actor()` and `cella.device()` set;
9. signs the receipt, keeping the request's salt beside it, and appends the entry naming it, with the logged payload, both with the key of `cella.key_file` and naming it by its id in `cella.signer`: the first time a key signs, it is registered there as in office from that entry, and a key a later one replaced is refused, so a retired key never signs again.

A guard is a `STABLE` function `(payload jsonb) → text` that sees the transaction's own writes and returns `NULL` to accept or a reason to refuse; a volatile guard or one of another shape is an error. The keyring is a `STABLE` function `(actor text, device bytea) → text` of the same kind. Both run as `cella_guards`.

On a refusal, at any step, `submit` raises SQLSTATE `09000` (`triggered_action_exception`) with the reason as the message, so the transaction cannot commit: the state and the verdict roll back together, the verdict number is not used and the nonce is not spent. Feats' triggers raise the same code, so a handler maps `09000` to `Refused`. The rows `submit` returns are therefore always `settled`.

Each receipt holds its number, the action, the actor, the device, the nonce, the request's digest, the member's signature, the payload's digest and the time it arrived, hashed with BLAKE3 and signed. Beside them, outside the hash, it keeps the salt of the request, which the digest it hashes is taken with: given the salt, `cella.signed(n, request)` says whether a request is what the member signed, so what a member signed can be checked against the payload later wherever the payload restates it. The salt is the owner's alone, since anyone else could confirm a guess of the request with it, and so is `signed`; a receipt taken before 0.3.0 kept none. Outside its hash too, it keeps the number of the entry that names it, which that entry's hash covers by naming the receipt, so a receipt no entry names keeps none. Each entry holds its number, op, actor, verdict date, the digest of the logged payload, its receipt's number and hash, or for an effect its cause's number and hash and whether it settled or was forgone, and each deciding guard's owner, signature and text digest; the text itself goes to `cella.guard_text`. Entries are hashed over the previous hash and signed with Ed25519. Beside them, `cella.log.form` keeps the logged payload, personal values replaced by commitments, which the folds read ([architecture](../../../../_corpus/doc/architecture.md#folds)); `verify_log` checks that it hashes to the entry's digest.

## Effects

A decision is the one write in its transaction a member signed: what it
carries and what reacts to it are its effects, written in the same
transaction after its `submit`, each an entry of its own with no
signature of its own. A handler writes an effect's state and calls
`cella.follow(op, payload, cause)` last, as it calls `submit` for a
decision. `follow`:

1. checks that `cause` is an entry this transaction appended, the
   decision's or an earlier effect's; the transaction holds the head's
   lock from the decision's `submit`, so a write's entries are
   consecutive in the log;
2. checks that `cella.follows` lets `op` follow `cause`'s op, and that
   `cause` is fewer than five effects from its decision;
3. takes the payload out of personal data, its commitments kept under
   the decision's receipt, which `cella.disclosed` reads for an effect,
   and runs every guard registered for `op`, as
   `submit` does, with `cella.cause()` set, the actor that of the
   decision, and no device;
4. signs and appends an entry naming its cause by number and hash in
   place of a receipt, hashed under a domain of its own
   ([signatures](../../../../_corpus/doc/signatures.md)), so an effect
   never reads as a decision.

An effect citing no entry, an entry of another transaction, or a cause
its op may not follow is refused, as a refused guard is, with SQLSTATE
`09000`. The handler runs each effect in a savepoint: on a refusal it
rolls back to it and calls `cella.forgo(op, cause, why)`, which
appends an entry recording the effect refused, its logged payload the
guard's reason, and runs no guard; the decision and the other effects stand. A write's transaction
commits whole or not at all: a decision never commits without its
effects, each settled or forgone.

### Required effects

An effect may be required by its cause: a `cella.follows` row marked
`required` says the cause stands only with the effect, as an admission
stands only with the subscription of the capital the statutes ask. A
required effect refused forgoes its cause with it: the handler rolls
back to the cause's savepoint, which holds every effect after it, and
forgoes the cause and each of those effects, each with its reason, the
cause's naming the required effect refused and why; a forgone cause
that is itself required forgoes its own cause the same way. A row binds
from entry `since`, the first after `cella.lets_follow` registered it or
changed whether it is required, so a requirement registered later never
breaks a write logged before it. The
decision and its other effects stand. A decision whose own required
effect is refused is refused whole, as by a guard. At commit the notary
refuses a write holding a settled entry without a settled effect for
each op its `required` rows name, so no state commits inconsistent.

A forgone entry's reason is in the log, so it names the action by its
op and its cause and gives the values its guard read and what would
have let it settle, the statutes' minimum and the shares asked, or the
closed month and the open one, and never a person.

An auditor holding the log checks an effect without trusting the
server: its cause is an earlier entry of the same write, a settled one,
and it names what the effect does: the close of a motion that passed,
which anyone computes again from its signed votes, and the action's
number, which the motion's proposing entry names; or the write a
reaction follows, under a `cella.follows` row letting the effect's op
follow it. `verify_log` checks that every effect's cause is an entry
of its own write, settled for a settled effect, fewer than five effects
from its decision, under a `cella.follows` row letting its op follow
its cause's, its actor its decision's, so no effect acts for anyone
but the member who signed, and that no settled entry lacks a settled
effect a row requires of it. An effect whose actor is not its
decision's breaks the log at that entry, as one whose cause hash is
altered does.

## Bound

A write's state lands only inside a transaction `cella.begin` opened and `cella.submit` settled, its effects' state with it. `begin(op, actor, device)` opens it, once per transaction, before any state: a second is refused, and `submit` refuses a write not begun or begun as another op, actor or device. Until the transaction ends, it may write the registered state tables; at commit (and at `PREPARE TRANSACTION`) it is refused unless its verdict was appended, so a handler that skips `submit` commits nothing. Both follow savepoints: one rolled back past the begin undoes it, and one rolled back past the verdict undoes the verdict, so the commit is refused; a released one hands both to its parent.

`cella.state (schema, tab)` lists the registered state tables. `cella.notarise(tab)`, a superuser's, registers one and installs on it the notary's trigger, `cella.notarised()`: a constraint trigger after every inserted, updated or deleted row, and one before a truncate, each refusing with SQLSTATE `09000` unless the transaction is begun, the notary is redacting ([the vault](#the-vault)), which `vault_sweep` does outside any write, or `cella.unbound` is set. A partition takes its row trigger from its table. The org core registers every table a feat or a graft makes, as it is made, by an event trigger (`sql/007-notarised.sql`): every table outside `cella`, `vault`, `migration`, `public`, the catalog and the temporary schemas. A table is named in `cella.state`, not referenced, so a dump keeps the list, and restores the triggers with its tables.

`cella.unbound`, which only a superuser may set, lets a session write state outside a write: the migrations set it for each file, as they change the schema and its registries, and `cella test slice` sets it on a slice's database, whose tests write the rows they need below the notary. A host's superuser can always set it, or drop the trigger; the app's role cannot ([trust](../../../../_corpus/doc/trust.md#current-limits)).

## The vault

Personal data never enters the log. A handler marks each personal value a payload carries, `{"$personal": {"field": "schema.table.column", "subject": …, "value": …}}`, for a field registered in `cella.personal`; every other object key starting with `$` is refused. `submit` replaces it with `{"$commit": hex}`, the BLAKE3 commitment, under its own domain, to a fresh 256-bit salt and the value, and stores in `vault.secret` the commitment, the receipt, the subject, the class, the year, the field, the salt and the value sealed with XChaCha20-Poly1305 under the subject's key for the class and the verdict's year (`vault.key`, made on first use from Postgres's strong random source and itself sealed under the wrap key derived from the vault's own key file, `cella.vault_key_file`, never from the notary's seed, and naming that wrap key by its id, `vault.key.wrap`, the BLAKE3 of the wrap key under its own domain, never the key). The same value written twice commits differently.

A payload marks an erasure as `{"$erase": {"subject": …, "classes": […]}}`, every class when none is named; `submit` carries it out under the head's lock and logs `{"$erasure": {"subject", "erased", "restricted"}}`. For an erasable class (`profile`, `contact`) it deletes the subject's keys and sealed values, so its commitments no longer open, and redacts the class's registered columns in the read models (`cella.redact`). A restricted class (`payroll`, `expense-receipt`, `books`), which the law keeps, loses only the keys whose clock has run out and is marked restricted; `cella.vault_sweep()` erases it in full once its clock, counted from the erasure's year, runs out. Either way a tombstone in `vault.erased` refuses any later value of the subject's class: erasure wins. A tombstone names the erasure's entry by its number, but for one `cella.vault_reerase` carried out again after a restore, which names none. A key's clock runs `years` full years past the end of its year: books from 2025, kept ten years, may be destroyed from 1 January 2036.

`cella.opened(n)` reads an entry's logged payload back with its commitments opened, checking each against its salt: the value, `restricted` while the law keeps it, `redacted` once erased. The log verifies the same before and after an erasure, since erasure deletes what a commitment opens to, never the commitment.

`cella.power (op, power, amount, owner)` names the power each action needs and the payload field holding its amount in cents, registered by the action's feat; the extension holds no guard over it: the membership feat attaches one to every action listed.

The log tables and the registries are readable by everyone, but the log's `form` and a receipt's `salt`, and writable by no role but the extension's owner and the migrations; `submit`, `receipt`, `verify_log` and `notary_key` are `SECURITY DEFINER` with a pinned `search_path`. Only `cella_app` may execute `begin`, `submit` and `receipt`.

## Reads

The app's role reads every table but where a feat keeps row-level
security, and its policies ask the functions above
([architecture](../../../../_corpus/doc/architecture.md#sql),
[trust](../../../../_corpus/doc/trust.md#one-server)). `cella.log.form`
is the owner's alone: every other column of the log stays everyone's,
the ids of the records an entry is about everyone's through
`cella.records(n)` and their first and latest entries through `cella.made(ids)`, and the vault opens to the app only through `cella.disclosed(n)`.
`may`, `covered` and `reaches` call the functions their registries name, so each
is a `STABLE` function of the shape it is registered for. Each is called
by the schema and name its function has, its arguments cast to the types
it was registered with, so a function overloaded under its name runs the
overload registered.

## The guards role

Guards never run with the owner's rights. `submit` runs each guard as `cella_guards`, a role that cannot log in, is no superuser, bypasses no row security and owns nothing; each feat and graft grants it `USAGE` and `SELECT` on its own schema, and a table keeping row-level security gives it a policy reading every row, and nothing more. `SET ROLE` is refused inside a security-definer function, so `submit` switches the way Postgres itself does for one: it sets the user id to `cella_guards` in a security-restricted operation around each guard call (`SetUserIdAndSecContext`) and restores it on return, on unwind and, through the transaction's abort, on any error. The keyring runs the same way. A guard therefore cannot write a table, take a receipt, call `submit`, read `cella.key_file` or the key file itself; `submit` refuses a guard declared `SECURITY DEFINER`, and the role is refused if it is a superuser or bypasses row security.

## Settings

- `cella.key_file` (`postgresql.conf` only): a file holding the scope's 32-byte Ed25519 seed. `cella db start` generates a dev key in `.data/notary.key`; it is never committed. Pointing it at a new key rotates the notary's key: the next entry registers it as the next signer ([operations](../../../../_corpus/doc/operations.md#keys)).
- `cella.vault_key_file` (`postgresql.conf` only): a file holding the vault's own 32 random bytes, from which the wrap key sealing every vault key is derived; kept apart from the notary's seed, so either rotates alone. `cella db start` generates a dev one in `.data/vault.key`.
- `cella.vault_key_previous` (`postgresql.conf` only): the vault key file before a rotation, read only to open a vault key still sealed under it until `cella.vault_rewrap()` has moved it; unset once it has. A vault key opens only under the key file whose id it names, and one naming neither file is refused with that id, so a restore that lacks a key says which.
- `cella.vault_keys_kept` (`postgresql.conf` only): the vault key files of earlier rotations, comma-separated, kept until no restore point older than their rotation is kept; the notary opens nothing under them, and `cella backup` carries each ([operations](../../../../_corpus/doc/operations.md#keys)).
- `cella.clock` (superuser only): a fixed verdict date, `YYYY-MM-DD`, for fixtures and tests. Unset, the date is the clock's day in the scope's timezone, read once per transaction.
- `cella.timezone` (superuser only): the scope's timezone, an IANA zone such as `Europe/Paris`, whose day is the verdict date, so a cutoff or a period's close falls on the co-op's day and not on UTC's, an hour or two apart around midnight. Unset, UTC. `cella seed` sets it on the database from the fixture's `scope.toml`; the shell reads its today from `cella.verdict_date()` too.
- `cella.unbound` (superuser only): a session may write the registered state tables outside a write; set by the migrations and on a slice test's database ([above](#bound)). Off by default.
- `cella.scope` (superuser only): the scope's address, such as `lanterne.example`, which every write signature names. Set in `postgresql.conf` or on the database; `cella seed` sets it on the database from the fixture's `scope.toml`. The co-op's name and the mentions its invoices print are no setting: they are its particulars, a policy its assembly adopts ([the co-op's particulars](../circle/index.md#the-co-ops-particulars)).

The library is loaded through `shared_preload_libraries` so its settings exist before any session sets them.

## Build

`cella ext build` packages it with `cargo pgrx package` into `.data/ext`; Postgres 18's `extension_control_path` and `dynamic_library_path` load it there, since the Nix store is read-only. The devshell provides cargo-pgrx, `pg_config`, the server headers and bindgen's libclang flags, so `cargo check --workspace` builds it too.

A host takes it from the flake instead, as `cella-pg`: cargo-pgrx builds it in the Nix sandbox for Postgres 18, in release, from the Rust workspace alone, and lays it out as `postgresql.withPackages` takes an extension, its library, its control file, the generated script and every script of `rs/sql/` beside it. Its flake check preloads it in a fresh cluster, makes it, reads `cella.verdict_date()`, and updates a database made at the version before to this one ([packaging](../../../../_corpus/doc/operations.md#packaging)).

The extension's version is its own, `version` in `rs/Cargo.toml` (0.13.0), and changes with every change to its SQL. `rs/sql/` keeps each earlier version's install script, as pgrx generated it, and the upgrade script from it, `cella--<from>--<to>.sql`, written by hand; `cella ext build` stages them all beside the generated one, since pgrx stages only the upgrade scripts and an earlier version installs from its own; an org migration appended to `sql/` then runs `ALTER EXTENSION cella UPDATE`, so a database keeps its log, its receipts and its vault through every change of the notary, never `DROP EXTENSION`, which `cella check feats` refuses in every `sql/` directory, this one's with the slices' ([operations](../../../../_corpus/doc/operations.md#upgrades)). An upgrade script never drops a function a guard may call: a guard whose body is SQL-standard (`BEGIN ATOMIC`) holds what it calls by its oid, so Postgres refuses the drop. It renames the function instead, which keeps its oid and so every body that calls it, and rebinds it to the new library's symbol with `CREATE OR REPLACE`, as `cella--0.5.0--0.6.0.sql` does with `cella.op()`, now `cella.action()`. A fresh install makes no head row, so a dump of the head restores into one.

`sql/001-cella.sql` creates the extension and the app's role, `cella_app`; `sql/002-guards-role.sql` creates `cella_guards` and keeps `submit` and `receipt` to the app; `sql/003-vault.sql` keeps `opened` to the app and the sweep to a superuser; `sql/005-signers.sql` updates a database made before 0.2.0 in place and makes the head row of a new one; `sql/006-salts.sql` updates one made before 0.3.0; `sql/007-notarised.sql` updates one made before 0.4.0, keeps `begin` to the app and registers every table a feat or a graft makes as a state table ([above](#bound)); `sql/009-guards.sql` updates one made before 0.5.0, when guards were called rules; `sql/010-actions.sql` updates one made before 0.6.0, when `cella.action()` was `cella.op()`; `sql/011-reerase.sql` updates one made before 0.7.0, when every tombstone named its entry and no restore carried an erasure out again; `sql/012-effects.sql` updates one made before 0.8.0, when no entry was an effect, and keeps `follow` and `forgo` to the app, as `submit` is; `sql/013-wrap-ids.sql` updates one made before 0.9.0, when no vault key named the wrap key that sealed it; `sql/015-verify-after.sql` updates one made before 0.10.0, when the log verified only whole and in one read; `sql/017-receipt-entry.sql` updates one made before 0.11.0, when no receipt kept its entry, giving each the log names its entry once; `sql/018-kept-hashes.sql` updates one made before 0.12.0, when no multiset hash was kept, and makes the kept hashes beside the folds; `sql/019-made.sql` updates one made before 0.13.0, when the log kept no index of the records its entries are about, and makes `cella.made` beside `cella.records`. The extension keeps `vault_rewrap`, `vault_reerase` and `signed` to their owner itself.

## Tests

`rs/src/tests.rs` holds the notary's own `#[pg_test]`s, which `cella test notary` runs in Postgres on a cluster pgrx makes and drops: a signed write settles and keeps its salt, and `signed` knows its request from another; an unsigned write, a signature by another key, a request swapped under its signature, and one signed for another scope, op or actor are refused, as is a payload restating a field otherwise; a nonce counts once; the keyring refuses an unknown, another member's or a revoked device, and no keyring refuses every write; a guard refuses with its reason and is named by its entry; the verdict date is the day in `cella.timezone`, or the fixed clock in any zone; and the chain breaks wherever an entry, its form, its receipt, the head or a signer is altered, where an entry chains to anything but the one before, and where an effect, hashed and signed again under the key in office, acts for another actor than its decision's; verified after a checkpoint, the log is checked from that entry's hash, so an entry altered before it is the checkpoint's and one altered after it breaks the chain, and a receipt naming no verdict is refused, numbered below the checkpoint's receipts or above them, as are a receipt keeping an entry past the head and one keeping another entry than the one naming it, while an entry after it naming a lower receipt than one before it verifies; a restore's list of erasures is carried out once, each erasable class erased and each restricted one restricted as on its date, a later list's sweep completing a restricted one, and a list naming no retention class refused; a write not begun, or begun as another, is refused, and a transaction opens one write; and a registered table refuses a row inserted, updated, deleted or truncated outside a write, unless unbound, a rolled-back savepoint undoing the begin. Each earlier version the notary ships installs with a guard whose SQL body calls `cella.op()`, or from 0.6.0 `cella.action()`, and `ALTER EXTENSION cella UPDATE` brings it to the current version, where the guard still runs and reads the action it judges and the log is indexed by the records its entries are about: `cella test notary` stages the earlier install scripts beside the generated one, and the test build alone keeps the earlier library's `op_wrapper`, so an earlier version installs on it. The tests share one database, each in a session of its own, and each opens by taking the tests' lock, a transaction-level advisory lock on `hashtext('cella test notary')`: every test takes it shared (`beside()`), and the upgrade test, which drops the extension every other reads, takes it exclusive (`alone()`), so it runs with no other beside it and none sees the extension dropped; each lets it go as its transaction rolls back. A plain `#[test]`, `every_pg_test_takes_the_tests_lock`, reads `rs/src/tests.rs` and fails any `#[pg_test]` whose body opens with neither. Each runs in a transaction that rolls back, on a keyring and devices of its own, and the notary signs with a TEST-ONLY seed. The harness writes that seed and the vault's key to their files on every test thread, before the tests' lock is taken, each to a temporary file renamed over the last, so a test beside it never reads a key file empty or short. What happens at commit, a skipped `submit` or a verdict rolled back to a savepoint, is the e2e scenario `notarised`'s, on a seeded Lanterne.
