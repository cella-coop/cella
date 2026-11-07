+++
title = "Trust"
updated = 2026-11-07
+++

# Trust

Each scope — a co-op, a joint circle of co-ops, or a federation — runs its
own server, with its own Postgres database, log and notary. Every piece of
data has exactly one owning scope; anything shared gets a scope of its own.
There is no consensus between servers and nothing to resolve: other scopes
keep signed copies of what concerns them.

Cella is single-tenant and federated, and both protect privacy. No server
holds two scopes, so a co-op's records sit beside no other co-op's: no
query, bug or operator of another scope reaches them through a shared
database. Federation (rung 5 of [the ratchet](ratchet.md)) joins scopes by
signed events between their servers, never by pooling their data: a
record leaves its scope only as the signed copy another scope keeps of
what concerns it, and never with the personal data behind its
commitments.

## Three kinds of action

Every change to the records is an action: an actor, a person today, signs
an attempt, and the notary runs the guards on it before it takes effect.
Each action declares one of three labels, which says how it contends:

| Label | Path | Examples |
|---|---|---|
| confluent | merges in any order; never waits | edits, comments, votes cast, deposits, time entries |
| bounded | spends a right granted in advance; waits only when the right runs out | budget shares, invoice series, draws |
| ordered | waits for the notary's verdict, and shows Pending until it comes | admissions, adoptions, voids, closing a period |

Until rung 2 every action goes through the server, and nothing reads the
label yet to run an action differently: `write`, `cella.begin` and
`cella.submit` take the same synchronous path whatever an action's label.
The label is in the type from the start, in the feat's
`models/actions.ts`, so that later rungs move confluent and bounded
actions to the clients without a rewrite. On the server a confluent or
bounded action still meets its feat's triggers and guards, so its outcome
may be `Refused` as well as `Settled`; only an ordered action may also be
`Pending`.

A member signs a decision once, and what it carries is persisted with
it. A close carries its effects in the same transaction: every action
the motion passed is written in the close's transaction, in the order
proposed, each an effect citing the close and the action's number, its
actor the member who closed the motion, and judged by its own guards,
by `membership-motion`'s that the motion it cites closed and passed,
and by the motion feat's that the motion's circle holds, on the verdict
date, a collective mandate for the action's power. The graft that
registers a cited action binds it to its subject where the motion's own
action names one: a subscription, a withdrawal or a freeze of capital
is accepted only on a motion that admitted or excluded the member it
names, as terms are copied only from the rule their motion adopted.
What follows a carried action, such as the freeze and the withdrawal of capital that
follow an exit, is an effect in the same transaction citing it, five
deep at most. Each has its own log entry. A motion's admissions are
effects of its close like its other actions, each with the seats it
gives, and each requires the subscription of the member it admits, an
effect citing it. What reacts to any other write, such as an approval's
posting, is the same: an effect committed with the write it follows. A
refused effect is rolled back to its savepoint and recorded as refused
with its reason, and an effect that requires it is forgone with it, its
own reason naming the refusal; the rest stand. So the motion stays
passed, and an admission whose subscription is refused, as under the
statutes' minimum or into a closed month, is forgone with it: no one is
admitted without the capital the statutes ask, and the outcome says
what would fix it. The transaction commits whole or not at all, so a
restart or an abandoned signature never leaves a decision committed
without its effects, and the notary refuses a commit that settles an
effect without one it requires. A scenario kills the server between a
close and what it carries, and between an admission and its
subscription, and finds nothing of either committed, the motion still
open to close ([tests](architecture.md#tests)).

## One server

The notary is software with no legal force: it runs the guards on every
action and alone appends to the log, and a record holds because the co-op
agreed to it, never because the notary signed it. It lives inside Postgres
as the `cella` extension, built with pgrx
on the pure Rust guards crate (`apps/org/core/notary/rs` over
`apps/org/core/guards/rs`). The pgrx
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
    A->>N: begin; select cella.begin(op, actor, device)
    A->>P: state change, which only a begun transaction may write
    A->>N: select cella.submit(op, payload, actor, signed request)
    N->>N: signature, device and nonce checked; guards; receipt and verdict signed and appended
    N-->>A: verdict, or a refusal raised
    A->>P: commit if Settled, which only a settled write may; roll back if Refused
  end
  A-->>D: Settled or Refused
```

- **The member signs every decision on their device** (WebCrypto Ed25519):
  a domain-separated message naming the scope, the action, the actor, the
  device, the digest of the request and a single-use nonce
  ([signatures](signatures.md)). `submit` checks it before any guard runs:
  the signature, then, under the log's head lock, that the device is a
  current key of the actor (the keyring, the `person` feat's) and that its
  nonce was never counted. A forged signature, a revoked or another
  member's device, a reused nonce, a request swapped under a valid
  signature or a payload restating the request otherwise is refused, and
  no verdict number is used. Each receipt keeps the request's salt for
  the owner, so what a member signed can be checked against the payload
  later.
- **An effect's authority is the entry it cites, never a signature of
  its own.** What a decision carries and what reacts to it are effects,
  written in the decision's transaction after its `submit`, each its own
  entry, which names the entry it follows by number and hash in place of
  a receipt. The notary appends one only when the entry it cites was
  appended by the same transaction and `cella.follows` lets its op
  follow that entry's, and runs its guards as for any write
  ([the notary](../../apps/org/core/notary/index.md#effects)). An effect
  its cause requires, refused, forgoes the cause with it, each recorded
  with its reason, and the notary refuses a commit in which a settled
  entry lacks a settled effect it requires
  ([required effects](../../apps/org/core/notary/index.md#required-effects)).
  An auditor checks it from the log alone: the cited entry exists, is of
  the same write and settled, and names the action, a passed motion's
  close and the action's number, or the write a reaction follows; and no
  settled entry lacks an effect it requires.
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
  handler opens it and begins its write, writes the state, calls
  `cella.submit` last and commits once. It opens it only once the
  member's device has signed, on a connection borrowed for the
  transaction alone, so a write waiting on a person holds none. Two of
  the server's eight connections are kept for reading sessions, the
  session read every request makes first, a proof's post among them,
  and the sign-in's; every other borrow shares the other six, so however
  many pages and writes hold those, a person still signs in and a
  device's proof still reaches the run it answers in time. What the
  handler read before the signature binds nothing: the guards read again
  inside the transaction, and `submit` checks the signature, the keyring
  and the nonce under the head lock, so a state changed in between is
  refused, never committed stale. A refusal raises inside `submit`
  (SQLSTATE `09000`), so the transaction cannot commit it: both roll back
  and no number is used. `submit` holds the log's head lock until
  commit, so calling it last keeps ordered writes from queueing behind slow
  transactions. Entries are numbered from that locked head, so an aborted
  write leaves no gap. The log is hash-chained (BLAKE3) and signed
  (Ed25519), so anyone holding it checks that no entry was changed,
  dropped or reordered, and computes an outcome again from its signed
  votes. It folds, too: each action says how its entry applies to the
  state before it, so the log folded entry by entry into an empty
  database rebuilds the scope's non-personal state exactly, every row of
  every feat and graft, the founding's carried rows among them. The fold
  rebuilds structure, never personal values: a personal value is a
  commitment in the log and its value stays in the vault, so a folded
  scope holds each commitment and opens none. The fold streams the log,
  its memory bounded whatever the log's length. Each action's fold is
  versioned as a guard is: an entry folds by the version in force when it
  was written, so two engines at different versions fold one log to the
  same state. Every so many entries the fold records a checkpoint, the
  hash of the non-personal state at that entry, so a verification, a move
  to another host or a witness starts from a trusted checkpoint, never
  from the first entry. `cella test e2e fold` runs Lanterne's year, folds
  its log into a fresh database and compares the two, which must match
  exactly, so a write that changes state its entry does not carry fails
  the day it is written; its scale tier folds a generated scope of ten
  million entries and fails on memory that grows with the log or a
  re-fold from the latest checkpoint over its bound. A scope still comes
  back from its backup and its keys ([operations](operations.md)), never
  by folding its log, and the log proves the history of what came back.
  A Merkle tree over the log (RFC 9162), giving inclusion and consistency
  proofs, is not built: it arrives with federation, when a scope must let
  another check its copy without replaying the whole log, its signed tree
  heads naming the checkpoints' state hashes at the entries they cover.
- **State changes only inside a write.** The handler opens its
  transaction with `cella.begin(op, actor, device)` before any state, and
  `submit` settles only the write begun, by the same action, actor and
  device. Every table a feat or a graft makes is registered in
  `cella.state` as it is made, and the notary's constraint trigger on it
  refuses (SQLSTATE `09000`) a row inserted, updated or deleted, or a
  truncate, in a transaction no `begin` opened. A begun transaction
  commits only with its verdict, so a handler that skips `submit`, or
  rolls its verdict back to a savepoint, commits nothing, and a `psql`
  session, as the app's role or as a superuser, writes no state. The
  migrations, which change the schema and its registries, and the slice
  tests, which test a slice's SQL below the notary, write with
  `cella.unbound`, which only a superuser may set; erasure's redactions
  are the notary's own. What a co-op is when its log begins comes in as
  a write too: the founding, below.
- **The first entry founds the co-op.** One write, the founding
  (`membership-motion:scope:found`), settles on an empty log alone, so a scope is
  founded once and a second founding is refused. It names the legal
  form the co-op chose, one cella offers, and brings in its founders, as
  persons with their devices and their memberships; the assembly,
  with each founder seated in it; and the root's founding motion, which
  its founders decided and which adopts the first policies, each taking
  a default of that form and none of another's, among them the
  procedure the root decides by. Its guards hold it, once its state is
  written, to one assembly that decides by a procedure a policy in
  force there makes; to every founder, each member whose membership
  began by the day the founding motion closed, seated in the root with
  a vote that day; to a founding motion, which the founding names,
  closed in the root, carried by its procedure with a stance from every
  founder, and adopting the policies that take the form's defaults; and
  to a signer who is a founder, enrolled by a device the founding
  brings. A founding with no procedure for its root, no founding
  motion, a motion its founders did not decide, a founder with no seat,
  or a signer with no vote there, is refused, saying which, and leaves
  the log empty. A mock co-op's founding
  also carries the state it held before its log, as Lanterne's seed
  does, and its entry carries every row of it, each personal value as
  its commitment, so the fold rebuilds what it founded
  ([folds](architecture.md#folds)); a real co-op's books come in after it, by the import of each
  kind under the importer's mandates. Every later entry passes the
  guards the founding's policies set: none is allowed because the
  founding allowed it. What a founding must carry is not yet ruled:
  the operator's ruling of 1 November 2026 makes it the one first
  entry, on an empty log, that brings in the founders, the root circle,
  its procedure and the first policies from the chosen form, and leaves
  what it must carry to be worked out, so the rest of what it carries
  and every guard that holds it is the building lane's reading, as the
  legal sources of [legal forms](forms.md) are.
- **Order comes from receipts, never from clocks.** A member's latest stance
  is the one with the highest receipt number, not the latest date.
- **The scope's key** is read from a file only the database's superuser can
  read; the scope's address, which every write signature names, is the
  `cella.scope` setting.
- **A fault in the extension stays bounded.** A Rust panic becomes an
  ordinary error that aborts the transaction. A hard crash makes Postgres
  restart every connection in the scope, in about 0.2 s, and lose nothing
  committed.
- **A scope's database is the unit** that moves, backs up and restores: state,
  log, guards and the notary's key together. The notary is a layer under
  every feat, not a feat, and has no writes of its own; moving it is moving
  the database to another host, which arrives at rung 6
  ([ratchet](ratchet.md#moving-a-notary)).
- **Circles, roles, tenures and mandates are core**, as groups are in
  standard RBAC: every feat builds on them, and the notary knows none of
  them. Whether a seat counts on a day is the membership feat's to say,
  so the guard on every power is that feat's
  ([architecture](architecture.md#circles-are-core)).
- **Who may write is checked by a guard like any other.** Each op that needs a power
  names it in `cella.power`, registered by its feat or by core's circles;
  the membership feat, which says whether a seat counts, attaches a guard
  to every such op that the actor holds, on the verdict date, a seat
  (core's, read from the circles' members and the roles' tenures) whose role has a mandate granting the power,
  whose scope covers the owning circle of the record the write's
  payload names, the root's where it names none, within its limit for
  the write's amount, or a right granting it, which reaches the whole
  co-op: every person,
  every member or every employee, as person's core says the actor is one
  that day. It is the one guard that reads a permission's scope; a
  record's owning circle grants nothing by itself, and a seat in it
  nothing without a mandate. What is the actor's own (a profile, a device, their time, a
  claim) needs a right's power, and the feat's guard that the record is
  theirs; a right opens no one else's rows to read. A write a passed motion carries (an
  admission, an adoption, a seat) names its power in `motion.cites`
  instead, registered by the graft that cites the motion, and needs a
  collective mandate: the motion feat attaches a guard to every such op
  that the cited motion's circle holds, on the verdict date, a mandate
  on the circle itself granting the power, as it checked when the
  motion was proposed. A stance needs `vote`, the power a motion's
  procedure gives the seats on its roll, in `motion.stance_power`:
  `membership-motion`'s guard holds it to someone on the roll
  whose seat counts on the verdict date. The one write with no power is
  the log's first entry, the founding, since no policy is adopted
  before it: its label declares the check `first` and a guard
  enforces it, and `cella check feats` refuses an action that names
  neither, so nothing is allowed by omission. Money leaves a cash account only through writes with their
  own right and a guard that checks the entry is exactly what they say:
  `transaction.pay` and `expense.reimburse` within their power's limit,
  `payslip:run.pay` and `account:capital.repay` under their power, and
  `account.draw` within the member's own draw limit. A mandate's budget, a total over a month or a
  year, is checked by the graft that sees what spends it:
  `expense-membership` sums an approver's approvals.
- **Who may read is a row-level policy in the database.** Every
  connection the server lends reads as the session's person: each borrow
  is a transaction that sets `cella.actor` from the session for itself
  alone before any query, so it clears itself at commit or rollback and
  no connection goes back to the pool reading as anyone; a write's
  transaction is its borrow's, and `write` sets the actor again in it
  with `cella.writing` (`cella.reader()`). Reading follows the mandates: every
  record table keeps row-level security for the app role, core's
  row-level policy by its owning circle, and a person reads a record
  only by a mandate whose scope covers that circle, for `read`, the
  read group's power, or for a power the record's feat names as reading
  its rows in `cella.reading`, as its actions name theirs in
  `cella.power`; the membership feat, as `cella.authority`, says which
  circles a power's mandates cover for a person on the verdict date,
  on seats that count (`membership.covered`). Ownership grants nothing,
  and a seat in a circle nothing without a mandate: Lanterne's
  participants hold `read` on their own circle and on the assembly, so
  Inès, in Web and no member, reads Web's expenses and the assembly's,
  and not Marketing's, while every member reads every circle's by open
  books, `read` on the member role. Each
  table holding a person's pay, time, capital, personal files or a
  capital account's lines has a row-level policy of its own in place
  of core's, which `read` opens nothing of. The person reads their own
  rows. The powers its feat names read those of the circles their
  mandates cover: the payroll powers read pay, `approve-time` time, so
  Web's lead reads Web's time alone, the books' and capital's powers
  capital. What the law gives every member to read, the year's accounts
  and the activity report, needs no mandate: the statements sum the
  whole for every reader, below. A graft that knows whose a row is opens it further
  (`cella.reach`): `account-transaction` opens the lines on the co-op's
  own accounts to every member and a capital account's to its holder, and
  `file-membership` a class of personal files to the powers over
  what they record. No one signed in reads none of it. A view the app reads
  reads as its reader, so these policies hold through it, or is
  declared shared and shows only what every member reads
  ([SQL](architecture.md#sql)). A stance on a
  secret ballot is read by its member alone, under no power; a
  motion's tally, read by everyone, stays sealed until its close
  ([ballots](../../apps/org/feats/motion/index.md#ballots)). A write's
  transaction reads the whole state, whoever asked for it (`cella.writing()`):
  the notary judges whether they may, and a write's state must not depend
  on who wrote it. The guards role reads everything. The statements,
  rubric by rubric, an entry's amount, a project's burn, a
  distribution's divisions, a motion's tally and the year's return to the federation sum
  the whole for every reader, as functions running as their owner; the
  figures behind them read as their rows do. The server acts as
  `cella_app` whatever role it logs in as, so an owner's or a
  superuser's login reads no further. The log's `form` is the owner's alone, and the vault opens only
  through `cella.disclosed(n)`: to the entry's writer, to the person
  every commitment in it is about, or to a holder of the power its action
  needs.
- **Confluent writes are logged in signed batches** once devices queue
  them offline (rung 2); until then each goes through the server's guards
  on its own.

## Guards

The extension is cella core's semantics exposed as SQL, wrapping the Rust
guards crate, which also compiles to WASM for browsers, devices and auditors:

- types: `cella.amount`, positive cents; balances are signed and derived;
- aggregates: `cella.consent`, `cella.majority`, …; an outcome is folded from
  the votes, never stored;
- the action being judged: `cella.action()`, its id, `cella.actor()` and
  `cella.device()`;
  whether the actor may use a power is not a primitive but the
  membership feat's composed guard, `membership.may(actor, power,
  cents, about, day)`, since only that feat sees both mandates and
  whether a seat counts, over a record of the circle `about`;
- trigger functions that feats and grafts attach: entries balance, periods
  are open;
- time: `cella.verdict_date()`, never `now()`;
- the notary: `cella.submit`, log verification, proofs.

Guards come in four layers:

| Layer | Who changes it | Written as |
|---|---|---|
| Primitives | us, by release | Rust: the `cella.*` types, aggregates and functions |
| Composed guards | power users and module developers, adopted by motion | `LANGUAGE sql` functions over the primitives, in the declared subset |
| Parameters | circles and the assembly, by motion | policies, whose values guards read from the rows they are copied into: mandates, limits, the procedure each circle uses |
| Members' view | members | forms that read back as sentences |

The law for each legal form is ours to write, as primitives and composed
guards. A co-op's own guards live in custom feats, each with its own schema,
enabled by motion.

Composed guards are written in a declared subset of SQL: `SELECT`, joins
over the scope's tables, `FILTER`, a closed list of aggregates and the
`cella.*` primitives; no `now()` or `random()`, no recursion, no DDL, no
writes. Each guard is written as a `BEGIN ATOMIC` body. At rung 1 no one
place holds the whole subset. `cella check feats` parses each guard's SQL
with libpg_query at commit time and refuses a reference outside the
schemas its feat or graft may read, a write to a table outside its own
schema or to `cella.*` but to register, a call to the clock or to
randomness, and a `DO` block; it holds no list of statements, aggregates
or functions, so a guard that writes its own schema, or is outside the
subset in any other way, passes it. At run time a guard runs as
`cella_guards`, which can write nothing (below), so any write fails when
it runs. Recursion, the closed list of aggregates and the
`BEGIN ATOMIC` form are held by review alone, and nothing checks a guard
again once a motion adopts it. Resolving a guard's dependencies against
Postgres's catalogue, which would see the casts and operators the parser
cannot, is research only (`research/pgrx/`), not yet part of the check. No
timeout bounds a guard's evaluation yet. The log records the text and
version of every guard that decided a verdict.

A guard runs as `cella_guards`, never with the extension owner's rights:
`submit` switches to that role in a security-restricted operation around
each guard, as Postgres does for a security-definer function. The role
reads only what each feat and graft grants it, its own schema, and can
write nothing, take no receipt, call no `submit`, and read neither the key
file nor its setting. A guard declared `SECURITY DEFINER` is refused.

SQL is the source of truth for guards. The browser may preview a guard
through the WASM primitives but never re-implements one in TypeScript.

PGlite, Postgres compiled to WASM, cannot load a pgrx extension. On a device
the primitives first run beside it, as WASM in JavaScript, and composed guards
wait. To bring them onto devices, the same pure crate is compiled for
PGlite's toolchain and wrapped in a thin C binding that registers the same
`cella.*` surface; that binding is research for rung 7.

Five catches keep local-first (rung 7) open, so that composed guards can run
without the server's Postgres on a later runtime:

- the declared subset;
- the primitives in a pure Rust crate with no pgrx in it, so devices get
  them as WASM;
- the extension's SQL surface declared in one place: a fixed list of types,
  functions, aggregates and operators, each a thin wrapper over the crate
  with no logic of its own, so a second binding only wraps the list;
- each guard's text and version in the log;
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
- Thresholds are policies a motion adopted, signed in the log, never
  flags or unsigned config. No one holds a group's key alone.
- Lost keys are recovered from guardian shares.
- **A person signs in with a device, and the browser signs every write.**
  The browser keeps each device's key in IndexedDB, made by WebCrypto and
  not exportable. To sign in, the device signs the server's single-use
  challenge ([signatures](signatures.md#a-sessions-opening)); the server
  keeps the session in a cookie it MACs, and every route but the sign-in
  and an invitation's link needs one whose device is still current. A
  write from a page runs on the server while the browser signs: each
  time a handler signs, the post is answered with what to sign, the action,
  the request made plain and the scope, actor and device, and the browser
  signs it with that device and posts the proof back to the run it
  answers, which only the session that started it may. The server holds
  no member's key.

## What a motion adopts

A motion that adopts a document names its content, not a row: the
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
and `document-motion`'s guard refuses to adopt a version that hashes
otherwise than the motion names.

A motion that adopts a policy names its sentence: the legal wording,
which binds, each value marked once in it, and perhaps a friendly one
beside it, which never binds ([policies](architecture.md#policies)). The
register keeps both, and the BLAKE3 of the two as a JSON array
(`policy.hash`); the adoption's log entry names the policy, and the
motion feat's guard refuses a policy whose wordings hash otherwise than
the motion carries them. The guards role reads a policy's values and
never its wording: a guard reads the values the feat that reads a kind of
policy copied into its own rows, so what binds is the sentence the
members adopted, and what a guard checks is a column.

The statutes are no text a motion names: they are the assembly's
policies in order, generated from the register
([policies](architecture.md#policies)). Each adoption or ending of one
of them is followed by a write citing the motion that generates them
anew, saves them as a version and adopts it; its log entry commits to
the version's hash, as any adoption's does, and the document feat's
guard holds the version to the register: every policy of the circle in
force that day reads in it, as it reads, and no other of its policies.
Anyone holding the version computes the hash again, and no hand edits a
generated version or saves one.

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
- **Who reads a row is its table's policy.** Every table a slice makes
  is under row-level security, enabled and forced, and every policy that
  reads it is of a pattern the check knows: the owning circle's, the
  reader's own row, a graft's reach, or a row of a table of its own; one
  that opens rows to every reader is declared, with its why. A table of
  pay, time, capital, files or a capital account's lines replaces core's
  policy with the personal row's, which `read` opens nothing of
  ([reading](architecture.md#reading)). A test generated for every feat
  and graft reads each of its tables, views and definer functions as a
  person signed in with no mandate, on a seeded Lanterne, and sees
  nothing but what is declared shared ([tests](architecture.md#tests)).
- **A secret ballot's stances.** A stance on a secret ballot is logged
  as a commitment, its member the subject, so the log says who gave a
  stance and when, as every entry names its actor, and never which; an
  open ballot's are logged as given. A motion's procedure says which
  ballot it takes, and a proposal may name the other
  ([ballots](../../apps/org/feats/motion/index.md#ballots)).
- **Pay, time and capital.** A time entry's minutes, as it is logged and
  as it is corrected, and its note; each payslip's figures and minutes, in
  the payload of the run that prepares them; each worker's part of a
  year's work share, in the payload that approves it; and the amount of
  a capital payment in and of a draw, and a spread's instalment, are
  logged as commitments, their member the subject. So an entry's digest
  confirms no guess at a colleague's pay, time or capital, and the vault
  opens the figure to whoever `cella.disclosed` lets read it. A guard reads such a figure from
  the row its write made, since the commitment is all the payload gives
  it; that the two hold the same figure is the handler's to keep, and
  the vault shows it to an audit. The books stay every member's: the
  journal still shows a payment's amount on the bank's line, and the
  write that posts it keeps the entry's lines in its payload, as the
  journal shows them, so its fold posts it again; and the register of
  members who holds how many shares
  ([current limits](#current-limits)).
- **The keys.** A vault key is 32 random bytes per subject, class and
  year, sealed (XChaCha20-Poly1305) under a wrap key derived from the
  vault's own key file, kept apart from the notary's seed, so the
  database alone, without that file, opens nothing, and either key
  rotates without the other ([operations](operations.md#keys)).
  Each vault key names the wrap key that sealed it, and a rotated wrap
  key is kept, and carried by every backup, until no restore point older
  than its rotation is kept, so a restore opens what it restores.
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
  one is a guard, the file feat's and the grafts' that see a power over
  what it records.
- **Erasure** is a write: `membership:member:erase`, a former member's
  own, by every person's right `erase-own-data`, for all their personal
  data, the person's profile with it; `person:person:forget`, the
  person's own, for their optional contact fields; `contact:contact:erase`, under the
  `erase-personal-data` power, for a person among the contacts. No one
  erases another member, and no motion decides it: erasure is the
  person's right (GDPR art. 17), within the holds the law keeps, art.
  17(3)(b), a legal obligation, and (e), legal claims. So a member who
  has not left is not erased, since the co-op keeps its register of
  members, and their payroll, receipts and books are restricted, not
  erased. That reading of the law waits on a lawyer, as every default's
  does ([legal forms](forms.md)). Each
  erases the subject's erasable classes at once, keys, salts and values,
  and redacts their columns in the read models; the restricted classes
  stay until `cella vault sweep` finds their clock out. A tombstone
  refuses any later value of an erased class (EDPB guidelines 02/2025 on
  processing personal data through blockchain technologies: erasure
  must remain possible, so the ledger holds no personal data, only what
  cannot be linked once its key is gone). A restore keeps it: every backup
  carries the scope's tombstones, and a restore re-applies the newest list
  it is given before the database opens, so a backup taken before an
  erasure brings no one erased back
  ([operations](operations.md#backups)).

## The analytics role

Analytics read the scope through `cella_analytics`, a role apart from the
app's and the guards': it logs in, every transaction it opens is
read-only (`default_transaction_read_only`), it owns nothing and runs
past no row-level security. `cella migrate` grants it SELECT on each
view a slice publishes in its analytical contract, and USAGE on that
slice's schema, and nothing else
([analytical contracts](architecture.md#analytical-contracts)); no
migration may grant it more, and the SQL check refuses one that tries.
It may not use `cella` or a slice's schema beyond those views, so it
calls no write, opens no vault entry and reads no log but its head,
which the analytics port publishes as a view of its own. What every
role reads, the notary's `vault.erased`, it reads too.

A contract's view reads as its owner, so what the role sees is what the
slice agreed to share, not what the row-level policies would show a member:
a personal column only where the view declares it, which erasure redacts
in its table and so in the view, and from a table under row-level
security only sums over everyone or the rows its row-level policy opens to all.
The role reads a declared personal column as it is, so whatever reads
through the role decides whom it shows it to. No view a report reads
shows a figure that is one member's pay, time or capital: a counted
view's contributions do, each person's part of each cell, and the port
alone reads them, inside the run, to withhold a cell, and no report
reads them.

The analytics shell is the role's one client
([architecture](architecture.md#the-analytics-shell)). It attaches the
scope's database read-only as the role, so whatever reaches the shell
reads what the role reads and writes nothing: a statement that would
write is refused by the attach, then by the role's read-only
transactions, then by its grants. It serves on localhost alone, to
whoever holds its token, a secret file owner-only beside the cluster's
data, and before it serves it shuts every door but the attach: it reads
and writes no file, attaches no other database, loads no extension and
locks its settings. So a token's holder runs SQL over the published
views, and nothing else on the host.

A page reads it only through the port, which takes a report, never SQL,
checks every view, field, join and value against the catalog of what the
role reads, and refuses a personal field the report does not declare
([the port](../../apps/org/core/analytics/index.md#the-check)). A report on a scoped view
reads for its reader alone: the server asks Postgres which circles the
reader's mandates cover, by the row-level policies' own test, and the
port filters the view to those circles' rows and the reader's own, and
refuses a report on a scoped view that names no reader
([the reader](../../apps/org/core/analytics/index.md#the-reader)). A
custom report a member saves names no reader: it is a definition, and
each run of it on its page asks Postgres again as whoever opens it, so a member whose mandate to read a circle ends reads no more
of that circle's rows through a report they saved under it, and their
own still (the e2e scenario `report-reader`). A
shared total of members' own figures is read only as the cells open
books' disclosure values share with every member and those the reader's
own permission opens, each other cell left out before the report sums
it, so no total a run shows is had less a withheld cell
([what is withheld](../../apps/org/core/analytics/index.md#what-is-withheld));
suppression stops that arithmetic, not a difference across two views
over the same people or across time, nor inference from what a reader
knows outside the books. Each run
reads on one snapshot, its Postgres transaction repeatable read, and is
stamped with the log's head it read: the port's `analytics.head`, the
entry's number and hash, is the role's only reach into the notary.

## Current limits

What the build does not yet do, and what lifts each:

- **A superuser can still write state outside a verdict, and a write can
  do more than it says.** The notary binds every state change to a
  verdict against the app's role, a handler, an import and any session
  that does not unbind, but a superuser can set `cella.unbound`, drop the
  trigger or replicate around it, as a host can do anything to a database
  it runs. Within a write, a guard checks that it did what its payload
  names, never that it did nothing else, so a handler's bug can change
  more under its verdict than its payload says. The feats' triggers hold
  the invariants whoever writes. Nothing at rung 1 lifts either: the
  pilot trusts its host for both, as the ratchet's first rung does.

- **The host serves the signing code and says what to sign.** The browser
  signs the request the server asks it to, one per decision, the close
  of a motion that carries a suspension among them, and shows none of it
  to the member; until the
  native client (rung 4) nothing stops a host serving code that signs
  something else with the keys it serves code to.
- **The host sets the reader.** The app role may set `cella.actor` and
  `cella.writing` itself, so the row-level policies hold the server's own code to
  what each person may read, not a hostile host; the native client
  (rung 4) and the host's trust (A2) lift this.
- **Some of what concerns a person is every member's.** The register of
  members, who holds how many shares, and the journal's entries with
  their lines on the co-op's own accounts are read by every member, so
  a colleague's capital paid in shows on the bank's line as an amount;
  an expense, an invoice and a draw's amount the same. A page that sums
  rows shows the sum of those its reader reads, but for the statements,
  an entry's amount, a project's burn, spend and invoicing, the
  divisions and the return to the federation, which sum the whole.
- **The tables' owner reads past their policies.** Forced row-level
  security binds a table's owner, but Postgres exempts a superuser from
  every policy, and the cluster's superuser runs the migrations and owns
  what they make, so a view that reads as its owner and a `SECURITY
  DEFINER` function read every row. A tool checks the tables' policies,
  and refuses a definer function that returns rows, and a view, unless
  it reads as its reader or is declared shared, summing the whole or
  filtering its rows by its reader's test, or a function keyed by a
  secret its caller holds; that a declared share's why is true, that the powers a feat names in
  `cella.reading` are the right ones and that a graft's reach opens no
  more than it says are left to review
  ([reading](architecture.md#reading)). The denial test proves on rows
  only what Lanterne seeds: a table it leaves empty, such as a payroll
  plan's or a capital call's, is named unproven, not passed.
- **A member of the scope is read from the seat alone.** Core's
  structure is its members' ([circle](../../apps/org/core/circle/index.md#who-reads-the-structure)):
  a member holds the member role, seated in the assembly by a tenure
  running on the verdict date. Core knows no feat, so it asks no
  membership whether the seat counts: a suspended member whose tenure
  of the member role stands reads the structure until a motion ends
  it, though their seat grants no power. And core's analytical
  contract shares the structure by id to the analytics shell, read as
  its owner, as the shared-view rules allow.
- **A published part is published whole.** What the co-op publishes by
  motion ([what the co-op publishes](../../apps/org/core/circle/index.md#what-the-co-op-publishes))
  every person signed in reads, every row of the part, never a chosen
  circle's: a co-op that publishes its seats shows who sits where by
  the address each seat keeps, and no name or other value the person
  feat holds. The rule says which parts; whether to publish the seats
  at all is the assembly's motion, which no tool judges.
- **The log says who wrote what.** Every member reads each entry's op,
  actor, date and receipt, and its payload's digest. Pay, time and
  capital are committed to with a salt the vault keeps, so their digests
  confirm no guess; a payload with no value marked personal, such as an
  invoice's or a period's close, is confirmed by guessing it against its
  digest, and the journal's receipt still names who drew an amount. A
  write that posts keeps its entry's lines in its payload, as the journal
  shows them, so its fold posts them again: a draw's or a payment in's
  bank line shows its amount in the log as in the books, whatever the
  commitment beside it. The log read by role lifts this.
- **A write's run lives in one server process.** It waits for each
  signature up to a minute (`CELLA_PATIENCE`), holding no database
  connection while it waits, and goes with the process; sessions outlive
  a restart only when `CELLA_SESSION_KEY_FILE` names the key, as `cella
  serve` does. A person has at most three runs pending, across their
  devices and sessions, and the server at most `CELLA_PENDING`, 64
  unset, so neither one person's abandoned writes nor a crowd's grow the
  process without bound; a write past either is failed, never queued,
  and a run frees its place as it ends.
- **The analytics shell knows no reader.** Its token opens every
  published view, declared personal columns among them, to whoever holds
  it; the org app's server holds it, and the port, in the server, is
  what filters a scoped view to its reader and withholds a counted
  view's cells. A host or a bug in the server that skips the port reads
  every circle's rows and every person's part of a shared total; the
  analytics role reading as the reader lifts this.
- **Suppression stops arithmetic within a report, not inference.** Open
  books' disclosure values withhold a small or dominated cell, and the
  cells that would give it back, inside each report a run reads; no run
  checks its totals against another view's or another period's, so a
  member who reads two reports over the same people, or the same report
  before and after someone joins, may subtract one from the other. Nor
  does any value stop inference from what a reader knows outside the
  books, a colleague's pay or who left a team: a co-op that shares such
  totals consents to that residual risk, which the assembly's Open books
  page says beside every value it proposes
  ([the circles in the shell](../../apps/org/feats/motion/index.md#the-circles-in-the-shell)).
  A release checked as one set across related views and periods, as the
  [disclosure study](../review/2026-11-05/disclosure.md) recommends,
  lifts the first; nothing lifts the second.
- **A backup carries its keys.** `cella backup` writes the notary's and
  the vault's key files beside the dump, owner-only but not encrypted, so
  whoever holds a backup can open the vault and sign as the notary; a
  host keeps backups as it keeps the keys
  ([operations](operations.md#backups)). Sealing a backup to the scope's
  guardians lifts this.
- **A restore loses up to a day, and the erasures of that day.** A scope
  is restored from its last nightly backup, so the writes since it are
  lost, and an erasure among them is in no list of erasures the restore
  is given: the person's data that backup holds comes back, until they
  ask again. Restoring to a point in time from the archived write-ahead
  log, which replays every erasure up to that point, lifts both.
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
- The late-write guards for offline writes (rung 2).
