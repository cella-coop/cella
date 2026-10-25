+++
title = "Trust"
updated = 2026-10-25
+++

# Trust

Each scope — a co-op, a joint circle of co-ops, or a federation — runs its
own server, with its own Postgres database, log and notary. Every piece of
data has exactly one owning scope; anything shared gets a scope of its own.
There is no consensus between servers and nothing to resolve: other scopes
keep signed copies of what concerns them.

## Three kinds of write

| Label | Path | Examples |
|---|---|---|
| confluent | merges in any order; never waits | edits, comments, votes cast, deposits, time entries |
| bounded | spends a right granted in advance; waits only when the right runs out | budget shares, invoice series, draws |
| ordered | waits for the notary's verdict, and shows Pending until it comes | admissions, adoptions, voids, closing a period |

Until rung 2 every write goes through the server. The label is in the type
from the start, so that later rungs move confluent and bounded writes to the
clients without a rewrite. On the server a confluent or bounded write still
meets its feat's triggers and rules, so its outcome may be `Refused` as well
as `Settled`; only an ordered write may also be `Pending`.

## One server

The notary lives inside Postgres as the `cella` extension, built with pgrx
on the pure Rust rules crate (`apps/org/core/notary/rs` over
`apps/org/core/rules/rs`). The pgrx
spike (`research/pgrx/`) showed it builds on NixOS against Postgres 18,
holds one transaction from Node, and keeps a gapless signed log the app's
role cannot write. Installing it needs a superuser, so a scope runs on a
Postgres we operate, never a managed service.

```mermaid
sequenceDiagram
  participant D as Member's device
  participant A as App handler (TypeScript)
  participant N as cella extension
  participant P as Feat schemas
  D->>A: request, signed
  A->>A: permission check
  rect rgba(128, 128, 128, 0.15)
    A->>P: begin; state change
    A->>N: select cella.submit(op, payload, actor, signed request)
    N->>N: signature, device and nonce checked; rules; receipt and verdict signed and appended
    N-->>A: verdict, or a refusal raised
    A->>P: commit if Settled, roll back if Refused
  end
  A-->>D: Settled or Refused
```

- **The member signs every write on their device** (WebCrypto Ed25519):
  a domain-separated message naming the scope, the op, the actor, the
  device, the digest of the request and a single-use nonce
  ([signatures](signatures.md)). `submit` checks it before any rule runs:
  the signature, then, under the log's head lock, that the device is a
  current key of the actor (the keyring, the `person` feat's) and that its
  nonce was never counted. A forged signature, a revoked or another
  member's device, a reused nonce, a request swapped under a valid
  signature or a payload restating the request otherwise is refused, and
  no verdict number is used. Each receipt keeps the request's salt for
  the owner, so what a member signed can be checked against the payload
  later.
- **Only the extension's functions may write the log.** No client, script or
  psql session can append to it any other way. Each settled write has one
  receipt, numbered as it arrives, which the notary signs with the member's
  signature and the payload's digest in it; the numbered verdict names
  that receipt by number and hash. Verdicts follow commit order and
  receipts arrival order, so two concurrent writes may settle in the other
  order; what is ordered by receipt (stances, cutoffs) reads the receipt.
  The notary never decides an outcome: an outcome is computed from the
  signed votes, and anyone holding the log can compute it again.
- **The verdict and its state change commit in one transaction.** The
  handler opens it, writes the state, calls `cella.submit` last and commits
  once. A refusal raises inside `submit` (SQLSTATE `09000`), so the
  transaction cannot commit it: both roll back and no number is used.
  `submit` holds the log's head lock until
  commit, so calling it last keeps ordered writes from queueing behind slow
  transactions. Entries are numbered from that locked head, so an aborted
  write leaves no gap. The log is hash-chained (BLAKE3) and signed
  (Ed25519) with a deterministic fold, so the state can always be rebuilt
  from it and checked. A Merkle tree over the log (RFC 9162) gives
  inclusion and consistency proofs.
- **Order comes from receipts, never from clocks.** A member's latest stance
  is the one with the highest receipt number, not the latest date.
- **The scope's key** is read from a file only the database's superuser can
  read; the scope's address, which every write signature names, is the
  `cella.scope` setting.
- **A fault in the extension stays bounded.** A Rust panic becomes an
  ordinary error that aborts the transaction. A hard crash makes Postgres
  restart every connection in the scope, in about 0.2 s, and lose nothing
  committed.
- **A scope's database is the unit** that moves, backs up and replays: state,
  log, rules and the notary's key together. The notary is a layer under
  every feat, not a feat, and has no writes of its own; moving it is moving
  the database to another host, which arrives at rung 6
  ([ratchet](ratchet.md#moving-a-notary)).
- **Who may write is a rule like any other.** Each op that needs a power
  names it in `cella.power`, registered by its feat; the `circle-membership`
  graft attaches a rule to every such op that the actor holds, on the
  verdict date, a seat whose role has a mandate granting the power, within
  its limit for the write's amount. A write with no power is the actor's
  own (a profile, a device), a member's of a roll or a circle (a stance,
  a proposal, a close) or decided (an admission, an adoption, a seat):
  its label declares that check and a rule enforces it, and `cella check
  feats` refuses an op that names neither, so nothing is allowed by
  omission. Money leaves a cash account only through writes with their
  own right and a rule that checks the entry is exactly what they say:
  `transaction.pay` and `expense.reimburse` within their power's limit,
  `payslip:run.pay` and `account:capital.repay` under their power, and
  `account.draw` within the member's own draw limit. A mandate's budget, a total over a month or a
  year, is checked by the graft that sees what spends it:
  `circle-expense-membership` sums an approver's approvals.
- **Who may read is a policy in the database.** Every connection the
  server hands out reads as the session's person: it sets `cella.actor`
  from the session before any query, and `write` sets it again for its
  transaction (`cella.reader()`). Each table holding a person's pay, time,
  capital, personal files or a capital account's lines keeps row-level
  security for the app role. The person reads their own rows. A feat
  names in `cella.reading` the powers that read all of them, as its ops
  name theirs in `cella.power`, and the `circle-membership` graft, as
  `cella.authority`, says who holds a power on the verdict date: the
  payroll powers read pay, `approve-time` time, the books' and capital's
  powers capital. A graft that knows whose a row is opens it further
  (`cella.reach`): `account-transaction` opens the lines on the co-op's
  own accounts to every member and a capital account's to its holder, and
  `circle-file-membership` a class of personal files to the powers over
  what they record. No one signed in reads none of it. A write's
  transaction reads the whole state, whoever asked for it (`cella.writing()`):
  the notary judges whether they may, and a write's state must not depend
  on who wrote it. The rules role reads everything. The statements,
  rubric by rubric, an entry's amount, a project's burn, a
  distribution's divisions and the year's return to the federation sum
  the whole for every reader, as functions running as their owner; the
  figures behind them read as their rows do. The server acts as
  `cella_app` whatever role it logs in as, so an owner's or a
  superuser's login reads no further. The log's `form` is the owner's alone, and the vault opens only
  through `cella.disclosed(n)`: to the entry's writer, to the person
  every commitment in it is about, or to a holder of the power its op
  needs.
- **Confluent writes are logged in signed batches** once devices queue
  them offline (rung 2); until then each goes through the server's rules
  on its own.

## Rules

The extension is cella core's semantics exposed as SQL, wrapping the Rust
rules crate, which also compiles to WASM for browsers, devices and auditors:

- types: `cella.amount`, positive cents; balances are signed and derived;
- aggregates: `cella.consent`, `cella.majority`, …; an outcome is folded from
  the votes, never stored;
- the write being judged: `cella.op()`, `cella.actor()`, `cella.device()`;
  whether the actor may use a power is not a primitive but the
  `circle-membership` graft's composed rule, `circle_membership.may(actor, power,
  cents, day)`, since only that graft sees both mandates and seats;
- trigger functions that feats and grafts attach: entries balance, periods
  are open;
- time: `cella.verdict_date()`, never `now()`;
- the notary: `cella.submit`, log verification, proofs.

Rules come in four layers:

| Layer | Who changes it | Written as |
|---|---|---|
| Primitives | us, by release | Rust: the `cella.*` types, aggregates and functions |
| Composed rules | power users and module developers, adopted by decision | `LANGUAGE sql` functions over the primitives, in the declared subset |
| Parameters | circles and the assembly | rows: mandates, limits, the procedure each circle uses |
| Members' view | members | forms that read back as sentences |

The law for each legal form is ours to write, as primitives and composed
rules. A co-op's own rules live in custom feats, each with its own schema,
enabled by decision.

Composed rules are a declared subset of SQL: `SELECT`, joins over the
scope's tables, `FILTER`, a closed list of aggregates and the `cella.*`
primitives; no `now()` or `random()`, no recursion, no DDL, no writes. Each
rule is written as a `BEGIN ATOMIC` body and checked twice when it is
adopted: its parse tree against the subset (libpg_query), and its resolved
dependencies against Postgres's catalogue, which sees the casts and
operators the parser cannot. A rule outside the subset is refused. A statement timeout bounds evaluation. The log records
the text and version of every rule that decided a verdict.

A rule runs as `cella_rules`, never with the extension owner's rights:
`submit` switches to that role in a security-restricted operation around
each rule, as Postgres does for a security-definer function. The role
reads only what each feat and graft grants it, its own schema, and can
write nothing, take no receipt, call no `submit`, and read neither the key
file nor its setting. A rule declared `SECURITY DEFINER` is refused.

SQL is the source of truth for rules. The browser may preview a rule
through the WASM primitives but never re-implements one in TypeScript.

PGlite, Postgres compiled to WASM, cannot load a pgrx extension. On a device
the primitives first run beside it, as WASM in JavaScript, and composed rules
wait. To bring them onto devices, the same pure crate is compiled for
PGlite's toolchain and wrapped in a thin C binding that registers the same
`cella.*` surface; that binding is research for rung 7.

Five catches keep local-first (rung 7) open, so that composed rules can run
without the server's Postgres on a later runtime:

- the declared subset;
- the primitives in a pure Rust crate with no pgrx in it, so devices get
  them as WASM;
- the extension's SQL surface declared in one place: a fixed list of types,
  functions, aggregates and operators, each a thin wrapper over the crate
  with no logic of its own, so a second binding only wraps the list;
- each rule's text and version in the log;
- a conformance suite, Lanterne's cases and their expected verdicts,
  runnable against any engine: Postgres, PGlite, or a future runtime.

Until the native client (rung 4) the host serves the signing code. The pilot
guards against outsiders and later tampering, not against the host, and
makes no claim that the host cannot forge a vote.

## Keys and addresses

- Members have device keys from day one. A key is enrolled by the member's
  current key; rotating keys keeps the address. A member's first device
  is made when they take up their invitation by its one-time link: their
  browser makes the key, and the acceptance it signs enrols it, its log
  entry committing to the key and the link.
  Enrolment and revocation are ordered, and the keyring is read under the
  log's head lock, so a revocation that settled first is always seen.
- Each scope has a server key and stable addresses (`ana@coop-a`), so
  federation adds to the design rather than changing it.
- Signatures are Ed25519, on devices and at the root, where the notary
  signs receipts and log entries with the scope's key. Each names its
  signer, the key in office at its entry, by its id in `cella.signer`,
  which keeps every key the notary has signed with: the log verifies from
  what it stores after its key file is rotated or lost, and a retired
  key never signs again ([operations](operations.md#keys)). Org's `core/crypto`
  holds ML-DSA-44 behind the same signing seam, and hybrid X25519 +
  ML-KEM-768 encryption; no rung adopts post-quantum signing yet.
- Every signed artifact names its binding (parent, sequence, audience or
  freshness), and each signed type is domain-separated; the register of
  signed types, their tags and bindings is [signatures](signatures.md).
- Thresholds are signed policy in the log, never flags or unsigned config.
  No one holds a group's key alone.
- Lost keys are recovered from guardian shares.
- **A person signs in with a device, and the browser signs every write.**
  The browser keeps each device's key in IndexedDB, made by WebCrypto and
  not exportable. To sign in, the device signs the server's single-use
  challenge ([signatures](signatures.md#a-sessions-opening)); the server
  keeps the session in a cookie it MACs, and every route but the sign-in
  and an invitation's link needs one whose device is still current. A
  write from a page runs on the server while the browser signs: each
  time a handler signs, the post is answered with what to sign, the op,
  the request made plain and the scope, actor and device, and the browser
  signs it with that device and posts the proof back to the run it
  answers, which only the session that started it may. The server holds
  no member's key.

## What a decision adopts

A decision that adopts a document names its content, not a row: the
BLAKE3 of the version's canonical form, which anyone holding the version
can compute again without cella. A document is a Loro tree of blocks; its
canonical form is that tree as JSON per RFC 8785 (JCS): the blocks in
reading order, each with its type, the props its type keeps, its text as
runs with their marks, and its children, block ids left out, so documents
that read the same hash the same however they were made. Numbers are
safe integers; a document holding anything else has no canonical form
and cannot be saved as a version.

The database computes it, from the Loro snapshot a version keeps, in the
`cella` extension (`cella.document_canonical`, `cella.document_hash`, on
the `loro` crate pinned to the browser's `loro-crdt`); the server never
takes a hash from a client. The browser computes the same bytes to
preview the hash while members edit, and the document feat's tests hold
the two to the same bytes. An adoption's log entry commits to the hash,
and `decision-document`'s rule refuses to adopt a version that hashes
otherwise than the decision names.

## Personal data

Personal data stays out of the log. Each entry holds commitments, each with
a fresh salt; the data and its salt sit in a vault, encrypted per member,
retention class and year. Erasure deletes the row and its salt, destroys the
keys that expired, and writes an erasure entry; the log still verifies and
folds the gap to `redacted`. Books and payroll are restricted rather than
erased until their legal clock runs out.

- **What is personal is declared, column by column.** Each feat registers
  its personal columns in `cella.personal` with a retention class and the
  column naming whose it is, and declares every other column the feat
  check suspects (a name, an email, a phone, an address, a salary, a
  receipt) not personal, with a column comment. `cella check feats`
  refuses a suspect column declared neither way.
- **What the log keeps.** A handler marks each personal value in its
  payload; `cella.submit` replaces it with a commitment, the BLAKE3 under
  its own domain of a fresh 256-bit salt and the value, and seals the
  value and the salt in the vault under the subject's key for the class
  and the year. The entry's digest and its stored payload hold the
  commitment, never the value ([signatures](signatures.md#digests)). The
  request the member signs is hashed with a fresh salt of its own, so its
  digest in the receipt confirms no guess either.
- **The keys.** A vault key is 32 random bytes per subject, class and
  year, sealed (XChaCha20-Poly1305) under a wrap key derived from the
  vault's own key file, kept apart from the notary's seed, so the
  database alone, without that file, opens nothing, and either key
  rotates without the other ([operations](operations.md#keys)).
  Destroying a key makes every value it sealed unreadable.
- **The classes and their clocks**, `cella.retention`: `profile`
  and `contact`, erased when asked; `payroll`, kept five years (Code du
  travail, art. L3243-4, the employer's copy of each payslip);
  `expense-receipt` and `books`, kept ten years (Code de commerce, art.
  L123-22, accounting documents and supporting vouchers). A clock runs
  in whole years past the end of the year it starts in, as the books'
  runs from the close of the financial year.
- **A file is personal data whole.** A receipt, an employment record or
  a member's record is kept in the file feat's part for its class, its
  name and bytes registered there; the log holds commitments to its name
  and its BLAKE3, never the bytes, and erasure empties them. Who may open
  one is a rule, the file feat's and the grafts' that see a power over
  what it records.
- **Erasure** is a write: `membership:member:erase`, decided, for a former
  member's whole profile, the person's; `person:person:forget`, the
  person's own, for their optional contact fields; `client:client:erase`, under the
  `erase-personal-data` power, for a person among the clients. Each
  erases the subject's erasable classes at once, keys, salts and values,
  and redacts their columns in the read models; the restricted classes
  stay until `cella vault sweep` finds their clock out. A tombstone
  refuses any later value of an erased class (EDPB guidelines 02/2025 on
  processing personal data through blockchain technologies: erasure
  must remain possible, so the ledger holds no personal data, only what
  cannot be linked once its key is gone).

## Current limits

What the build does not yet do, and what lifts each:

- **The host can write state outside a verdict.** At rung 1 a state
  change is bound to its verdict only by the handler calling
  `cella.submit` in the same transaction. Nothing in the database
  requires that it did: the app role holds write grants on the feats'
  tables, and no trigger knows during the state phase which op is
  writing. A handler's bug, an import or a `psql` session can change
  state with no entry, and the log still verifies; a rule checks that a
  write did what its payload names, never that it did nothing else. The
  feats' triggers hold the invariants whoever writes; authorisation and
  logging hold only for writes through `submit`. The operator's ruling
  on enforcing the binding (review A2) lifts this, and until then the
  pilot trusts its host for it, as the ratchet's first rung does.

- **The host serves the signing code and says what to sign.** The browser
  signs the request the server asks it to, its own write's and each
  reaction's, such as carrying out the suspension a passing decision asks
  once its close settles, and shows none of it to the member; until the
  native client (rung 4) nothing stops a host serving code that signs
  something else with the keys it serves code to.
- **The host sets the reader.** The app role may set `cella.actor` and
  `cella.writing` itself, so the policies hold the server's own code to
  what each person may read, not a hostile host; the native client
  (rung 4) and the host's trust (A2) lift this.
- **Some of what concerns a person is every member's.** The register of
  members, who holds how many shares, and the journal's entries with
  their lines on the co-op's own accounts are read by every member, so
  a colleague's capital paid in shows on the bank's line as an amount;
  an expense, an invoice and a draw's amount the same. A page that sums
  rows shows the sum of those its reader reads, but for the statements,
  an entry's amount, the burn, the divisions and the return to the
  federation, which sum the whole.
- **The log says who wrote what, and lets a guess be checked.** Every
  member reads each entry's op, actor, date and receipt, and its
  payload's digest, which is not salted: the journal's receipt names
  who drew an amount, and a payload with no value marked personal, a
  time entry's or a capital payment's, is confirmed by guessing it
  against its digest. Marking pay, time and capital as personal in
  their payloads, or the log read by role, lifts this.
- **A write's run lives in one server process.** It waits for each
  signature up to a minute, holding a database connection, and goes with
  the process; sessions outlive a restart only when `CELLA_SESSION_KEY_FILE`
  names the key, as `cella serve` does.
- **A backup carries its keys.** `cella backup` writes the notary's and
  the vault's key files beside the dump, owner-only but not encrypted, so
  whoever holds a backup can open the vault and sign as the notary; a
  host keeps backups as it keeps the keys
  ([operations](operations.md#backups)). Sealing a backup to the scope's
  guardians lifts this.
- **`cella import` signs with the fixture devices too.** It imports as a
  member through their TEST-ONLY fixture key, as the dev server signs, so
  it imports into the mock co-ops alone; a member's own device signing the
  import's writes, as for any write, lifts this.
- **A mandate's budget is enforced only on expenses.** A power's limit per
  write is checked everywhere; a budget only where a graft tracks the
  spend it caps, so far `approve-expense`'s. A budget over another power
  needs that power's spend summed by the graft that sees it.
- **Confluent writes are single-entry log entries, not batches.** Each
  confluent write is submitted on its own and takes its own signed entry.
  Signed batches come with the offline queue at rung 2, which syncs a
  device's confluent writes together.
- **Entries balance and periods are open by triggers in their owners'
  schemas**, PL/pgSQL in `transaction` and `account_transaction`, not yet
  `cella.*` trigger functions.

## Open

- Whether personal data enters the log only for ordered writes.
- The late-write rules for offline writes (rung 2).
