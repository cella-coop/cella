+++
title = "Operations"
updated = 2026-11-16
+++

# Operations

What a host does to run a scope and keep it: the server's settings, its
analytics shell, its two keys and their rotation, backups and a restore,
and upgrades. Every
task is a `cella` command ([the CLI](../../apps/org/rs/index.md)) or a
Postgres one. A NixOS host runs its scopes by the flake's module
([packaging](#packaging)); the rest of its configuration, its proxy, its
TLS and its own backup, lives with the host, not here.

## A scope's server

One Postgres 18 cluster holds the scope's database, with the `cella`
extension installed and preloaded. Its `postgresql.conf` sets:

- `shared_preload_libraries = 'cella'`, so the extension's settings exist
  before any session sets them;
- `cella.key_file`, the notary's 32-byte Ed25519 seed (`cella key init`);
- `cella.vault_key_file`, the vault's own 32 random bytes (`cella key init
  --vault`), never the same file;
- for archiving, the settings under [backups](#backups).

Both key files are readable by the server's user alone. The database
carries `cella.scope`, the scope's address every signature names, and the
scope's timezone, `cella.timezone` (an IANA zone such as `Europe/Paris`,
whose day the notary dates every verdict by; UTC when unset), both set
with `ALTER DATABASE … SET`. Nothing else of the co-op is a host's: its
name, its legal name and the mentions its invoices print are its
particulars, a policy its assembly adopts by motion, which `cella seed`
carries in by the founding motion from the fixture's `scope.toml`
([the co-op's particulars](../../apps/org/core/circle/index.md#the-co-ops-particulars)).
An invoice keeps the mentions as they stand when it issues, so a seat
that moves changes the invoices issued after the move and never the PDF
of one issued before
([invoice](../../apps/org/feats/invoice/index.md#the-pdf)). `cella migrate --url` makes
the roles `cella_app`, `cella_guards` and `cella_analytics` and every
schema, and grants the analytics role the views the slices' analytical
contracts publish ([trust](trust.md#the-analytics-role)); the server
connects as `cella_app` or as a role that is a member of it. A host
never sets `cella.unbound` on a scope's database or role: it lets a
session write state outside a write, which the migrations alone do, for
the file they run ([the notary](../../apps/org/core/notary/index.md#bound)).

## The analytics shell

A scope's reports are read by its analytics shell, a DuckDB 2.0 server
beside Postgres on the same host
([architecture](architecture.md#the-analytics-shell)). It logs in to the
scope's database as `cella_analytics`, which `cella migrate` makes and
grants the published views, so the host lets that role connect from
localhost (`pg_hba.conf`) and the server's own user nothing more. `cella
analytics start --url URL` runs it, the URL logging in as
`cella_analytics`, and keeps its token in `.data/analytics/<port>/token`,
readable by its user alone; the shell's server reads that file as
`CELLA_ANALYTICS_TOKEN_FILE`, so both run as one user, or the token is
copied to the server's with the same care as a key. It listens on
localhost alone and is never exposed: the org app's server is its one
client.

On a NixOS host the flake's module runs it as `cella-<name>-analytics`
([the module](#the-module)), started after the scope's setup and before
its server, as the `cella` user, which logs in as `cella_analytics` over
Postgres's socket; the shell backgrounds itself, so the unit forks, and
its token and pid are in the scope's `<stateDir>/<name>/.data`.

The server's unit sets `CELLA_ANALYTICS=quack:localhost:<port>`,
`CELLA_ANALYTICS_TOKEN_FILE` and `CELLA_DUCKDB_EXTENSIONS` as `cella
serve --prod` does. The shell holds no state of its own: a restart, or a
migration that publishes the views again, loses nothing, and a backup
leaves it out.

## Keys

The scope has two keys, kept apart so that either rotates alone
([trust](trust.md#keys-and-addresses)):

- **The notary's key** signs every receipt and log entry. `cella.signer`
  keeps every key it has signed with, by id, with the first entry each
  signed, and each entry names its own, so the log verifies from what
  the database stores: a rotated or lost key file loses nothing already
  signed.
- **The vault's key** derives the wrap key that seals every vault key,
  and each vault key names the wrap key that sealed it by an id, never
  the key. Without it the vault opens nothing; losing it erases every personal
  value the vault holds, as if each subject had asked.

To rotate the notary's key:

1. `cella key init <new path>`; never write a new key over the old file,
   since a server process keeps the key it read for each path.
2. Point `cella.key_file` at the new path and reload (`SELECT
   pg_reload_conf()`).
3. The next write registers the new key as the next signer, in office
   from its entry. The old key never signs again: the notary refuses it
   if it is configured back. Destroy it.

A lost notary key is replaced the same way, from step 1.

To rotate the vault's key:

1. `cella key init --vault <new path>`.
2. Set `cella.vault_key_previous` to the old file and
   `cella.vault_key_file` to the new one, and reload. Every vault key
   still opens, under either.
3. `cella vault rewrap` seals every vault key under the new one and says
   how many moved; run again, it moves none.
4. Unset `cella.vault_key_previous`, add the old file to
   `cella.vault_keys_kept`, and reload. Keep it there until no restore
   point older than step 3 is kept: no backup taken before it, and no
   base backup or archived segment of the write-ahead log from before it.
   Then drop it from `cella.vault_keys_kept`, reload, and destroy it.

A database from before the notary's 0.2.0, whose vault keys are sealed
under a wrap key derived from the notary's seed, moves the same way: a
new vault key file, the notary's key file as the previous one, then
`cella vault rewrap`.

## Backups

`cella backup <dir> [--url URL]`, on the database's host as a user who
reads its key files, writes a new owner-only directory: the database as
`pg_dump --format=custom` writes it, the notary's and the vault's key
files, the previous vault key's where `cella.vault_key_previous` is set
and each kept in `cella.vault_keys_kept`, the scope's erasures, and a
manifest of the database's name, the extension's version, the log's
head, each vault key file's wrap id and the settings the database and
its roles carry, which a dump leaves out. So a backup holds every wrap
key still kept, and a restore point older than the last rotation finds
its key in any backup taken since. The erasures, `erasures.json`,
are every tombstone of `vault.erased`: its subject, its class, its date,
its receipt's number and whether the class is restricted, and nothing
personal. Run it nightly from a timer and copy the directory off the
host. It holds the keys in the clear: keep it as the keys are kept
([trust](trust.md#current-limits)).

Everything a backup holds is read at one point of the log, so writes
need not stop for it. It opens a repeatable-read transaction, reads the
head, the settings and the key files' paths in it, exports its snapshot
and has `pg_dump --snapshot` dump that snapshot, so the dump holds
exactly the manifest's head. It reads the key files while the
transaction is open, and the key settings once more after the dump; if a
path changed while it ran, a rotation was under way, and it refuses and
removes the directory rather than keep a backup whose keys may not open
its dump. Taken between a vault rotation's steps 2 and 4, it holds both
vault keys, and its restore opens every vault key under either.

What a scope is promised is what its nightly backups give: a restore
loses at most the day since the last one. A point-in-time recovery from
the cluster's archived write-ahead log is not supported: no command
restores to a point, re-applies the erasures after it, nor rehearses
it.

`cella restore <dir> [--db NAME | --url URL] [--erasures PATH]` makes the
scope again from a backup, into a new database on the dev cluster or
into an empty one at `--url`, such as a new host's. It refuses unless
the cluster installs the extension at the version backed up; restore
with the build that made the backup, then [upgrade](#upgrades). It
writes each key file where the cluster's settings say, if it is missing,
and refuses if a different key is already there; a backup that holds
the previous vault key needs `cella.vault_key_previous` set as well, and
the rotation is finished after it with `cella vault rewrap`; one that
keeps vault keys of earlier rotations writes each into a path of the
cluster's `cella.vault_keys_kept` that holds it or is free, and refuses,
naming its wrap id, where none is. It makes the roles and the settings and loads the dump, and refuses if a vault
key in it names a wrap key none of the backup's key files derives,
saying the id it lacks and how many vault keys it seals, rather than
fail on the first entry that will not open. Then, before the
database opens to the app's role, it re-applies the newest list of
erasures it is given, `--erasures` naming a later backup's directory or
its `erasures.json`, the backup's own where none is named, and refuses
a list older than the backup's own, or another scope's: every erasure the restored vault
lacks is carried out again by `cella.vault_reerase`, as the erasure
did, so a person erased after the backup stays erased. Last it checks
that the log verifies, that its head is the backup's, and that every
entry opens from the vault, or folds to `redacted` or `restricted` as
its erasure left it. Restore with the newest erasures the host keeps:
an older backup's dump holds every vault key erased since it was
taken.

The restore is rehearsed by `cella test e2e restore` on every test run:
members write, personal data among it, the scope is backed up, and a
throwaway cluster whose key files do not exist yet restores it, with
every table's rows, the head and the vault as they were, and takes the
next write under the same key. It rehearses as well a backup taken in
the middle of a vault rotation, before `cella vault rewrap`, whose
restore opens every entry, and one during which the notary's key path
changes, which refuses. It rehearses a backup taken after a completed
rotation, whose manifest names both wrap ids and whose key files
include the kept one, and a backup whose vault names a key file it does
not hold, which refuses naming that key's id. And it rehearses an erasure after a backup: a
former member's personal data is backed up, they erase it, the scope is
backed up again, and the first backup restored with the second's
erasures opens none of that data, folds every entry of it to
`redacted`, refuses a later value of the erased class, and keeps the
former member's tombstone with the class and the date it was erased on.

## Upgrades

Until launch no scope is live, and a database is rebuilt, not upgraded:
`cella db reset` drops it, migrates it anew and seeds it from its
fixture ([architecture](architecture.md#migrations)). From launch,
migrations are append-only by stable ids: `cella migrate` applies those
a database has not, and refuses a file edited after it was applied. The
notary changes the same way: its
version is its own, each new version ships its upgrade script, and a
migration runs `ALTER EXTENSION cella UPDATE`, so its log, receipts and
vault stay where they are ([the notary](../../apps/org/core/notary/index.md#build)).

To upgrade a scope:

1. `cella backup`.
2. Stop the server, so no write arrives.
3. Install the new build, and restart Postgres, which loads the
   preloaded library only at start.
4. `cella migrate --url …`: the extension updated in place and every new
   migration applied.
5. `cella log verify --url …`, then start the server.

Between steps 3 and 4 the library is newer than the extension's SQL, so
nothing writes then. The path starts at launch, from the initial
migrations. `cella test e2e upgrade`, which rehearsed it from
0.1.0-alpha's dump, retires until then, and returns with the launch's
dump as its baseline: migrated in place, its log verified under the
TEST-ONLY key that signed it, its vault moved to a vault key of its own,
and both keys rotated.

## Packaging

A host installs a scope from the flake, never from a checkout. The
flake's `cella-pg` is the notary as a Postgres 18 extension, built by
cargo-pgrx in the sandbox: its shared library and its control and SQL
files, every version's upgrade script among them, laid out as nixpkgs'
`postgresql.withPackages` takes an extension, so a host's Postgres is
`postgresql_18.withPackages (p: [ cella-pg ])` and its
`shared_preload_libraries` names `cella`.

The flake's `cella-org` is the org app as one derivation: the shell
built with adapter-node, its node modules (a fixed-output fetch of the
pnpm store the lockfile names, whose hash the flake holds and a change
to the lockfile changes), the tree it migrates and seeds from, and the
`cella` CLI, which runs from that tree as from a checkout built already
([the CLI](../../apps/org/rs/index.md#on-the-path)), with Postgres 18's
client binaries, node and DuckDB with the extensions the analytics shell
loads. Its `cella-server` runs the built server as `cella serve --prod`
does. Its closure holds no key, no session key and no database: those
are the host's, and its state is in `CELLA_DATA`.

### The module

The flake's `nixosModules.cella`, `services.cella`, runs a host's
scopes on its one Postgres 18 cluster: `cella-pg` preloaded, the
notary's and the vault's key files at the paths the host names, and for
each scope under `scopes.<name>` a database and three units of its own.
The module never makes a notary's or a vault's key, and none is in the
store: `cella key init` makes each, once, by hand, owned by `postgres`,
which reads them. A NixOS test, `checks.module`, boots it with test
keys, migrates, founds Lanterne in the scope, signs in as a fixture
member and signs a write, takes the night's backup and restores it into
a database whose log verifies at the same head.

| Option | What |
|---|---|
| `enable` | the module |
| `package`, `extension` | the flake's `cella-org` and `cella-pg` unset |
| `keyFile`, `vaultKeyFile` | `cella.key_file` and `cella.vault_key_file`, set in `postgresql.conf`; every scope on the cluster is signed by its one notary key |
| `vaultKeyPrevious`, `vaultKeysKept` | `cella.vault_key_previous` and `cella.vault_keys_kept`, for a [rotation](#keys) |
| `stateDir` | `/var/lib/cella` unset; each scope's `<stateDir>/<name>` holds its session key and its analytics shell's `.data`, the `cella` user's alone |
| `backup.enable`, `.dir`, `.at`, `.keep` | the nightly `cella backup` of every scope that is no demo, as `postgres`, into `<dir>/<name>/<UTC time>` (`/var/backup/cella`, 03:00, the newest 7 kept unset) |
| `scopes.<name>.database` | its database, `<name>` unset |
| `scopes.<name>.address`, `.timezone` | `cella.scope` and `cella.timezone`, set on its database; unset, left to its founding |
| `scopes.<name>.port`, `.analyticsPort` | its server's port on 127.0.0.1 and its analytics shell's on localhost, each the host's own |
| `scopes.<name>.environment` | more of its server's settings, such as `CELLA_PATIENCE` |
| `scopes.<name>.demo.enable`, `.scenario` | a demo's scope ([the demo](#the-demo)), its template played with `authority-walk` unset |

Each scope is three units. `cella-<name>-setup`, a oneshot as
`postgres`, makes its database if it is missing, sets its address and
timezone, and migrates it with `cella migrate --url`, so a restart after
an upgrade migrates it; a demo's builds its template and its copy
instead. `cella-<name>-analytics` runs its [analytics
shell](#the-analytics-shell). `cella-<name>`, its server, runs
`cella-server` as the `cella` user, which logs in as `cella_app` over
Postgres's socket (`pg_hba` maps the `cella` user to `cella_app` and
`cella_analytics` on the scopes' databases alone), on `127.0.0.1:<port>`,
with a session key it makes on first start and keeps. The host serves
each port behind its own proxy, which terminates TLS and sets
`x-forwarded-proto`; the module opens no port.

Since the notary's key is the cluster's, every scope on a host is signed
by one key: the module refuses a host mixing a demo's scope with a
co-op's, so a demo's keys are the demo's own.

## The demo

The demo is a production build serving Lanterne, the mock co-op, and
nothing else: never a pilot co-op's data. `cella serve --prod --demo`
runs it, and so does the module's `demo.enable`, each setting the
server's `CELLA_DEMO`: its sign-in offers Lanterne's fixture members by
name, each marked as a demo member, whose TEST-ONLY keys anyone can
derive from their address and their device's label, as the dev
server's are, where a production sign-in offers no one; every page, the
sign-in's and each signed-in one, wears the demo's banner, saying the
co-op is a mock that anyone may sign in to and nothing in it is real.
The demo's scope carries its own keys, never a real scope's: its host's
notary and vault keys are the demo's, made by `cella key init`, and the
module refuses a host mixing a demo with a co-op's scope. The e2e
scenario `demo` asserts a demo build's sign-in, its banner and a demo
member's write, and that the same build without it offers no one.

`cella demo template --url URL [--scenario NAME]` builds the demo's
template from nothing, in the database `URL` names, logging in as the
cluster's superuser: the database dropped if it is there and made
afresh, migrated, Lanterne founded in it, then the story of an e2e
scenario played on it through the notary and the guards, as `cella seed
--scenario` plays it, `authority-walk` unset, which leaves Lanterne on
31 October 2026 with its four motions open, its bills, invoices,
meetings and mandates as its year left them ([the authority
walk](../../apps/org/fixtures/lanterne/index.md#the-authority-walk)).
The story's clock is the app role's in that database (`cella.clock`), so
the demo lives on the story's last day. The template is then marked a
template and closed to every connection (`IS_TEMPLATE`, no
`ALLOW_CONNECTIONS`), so nobody is served it, and labelled, as its
database's comment, with the tree that built it and its story: run
again by the same build with the same story it does nothing, and
`--again` builds it anew. The module's demo builds it as
`<database>_template` each time its setup starts, so it is built at the
first start and again after each upgrade, and no copy is older than the
build that serves it.

### A copy of the template

A demo scope is served from a copy of the template, never from the
template, and a host makes as many as it serves, each a database of its
own: `cella demo copy NAME --url TEMPLATE_URL [--replace]`. The copy is
`CREATE DATABASE NAME TEMPLATE <template>`, Postgres copying the
template's files, with no migration, seed or story run again, then the
settings the template's database and roles carry there, which a copy
does not take by itself: the scope's address and timezone the founding
set and the story's clock. Its comment names the template and the label
the template had, `a copy of <template>: <label>`, so a host knows a
copy made before the template was built again. Every copy is signed by
the cluster's demo key, as its template was, and its log verifies; what
a visitor writes in one changes no other and never the template.

This is how a host starts many scopes from one template: per scope, a
copy made by `cella demo copy`, a server on it, `cella-server` with
`PGDATABASE` naming the copy, `CELLA_DEMO=1`, a port of its own and a
session key, and, to end it, the server stopped and the copy dropped
(`DROP DATABASE … WITH (FORCE)`). The module's demo serves one copy, the
scope's own `database`, made afresh by its setup whenever the template
was built since, so an upgrade resets it and a restart keeps what was
written. `checks.demo` boots a demo host: its template is built at the
first start, its copy served, its sign-in offering Lanterne's members,
each marked, under the banner, and a member signs in and signs a write;
the template, built again from nothing, holds the same log, and a copy
of each verifies.

## A visitor's scope

The demo serves each visitor a scope of their own, a copy of its
template, so what they do changes only what they see, and nobody signs
up. `cella demo serve` is its front, the one address the host serves
(`tools/demo-serve.mjs`), which the module runs for a demo in place of
its single server; `demo.shared = true` serves one copy to everyone, as
above, made afresh each night at `demo.resetAt` (04:00), the fallback
for a demo a presenter leads. A visitor arriving without a copy is
shown a page saying their co-op is being prepared, and the page's
script asks the front for one by a POST from the same origin, so a
crawler, which runs no script, makes none; refused, the page asks again
a few seconds later. The front then copies the template into a database
of its own (`CREATE DATABASE … TEMPLATE`, about 0.2 s), marks it `a copy
of <template>: <label>` as `cella demo copy` does, gives it a login role
of the same name, `<database>_v_<16 hex digits>`, and starts its server,
the built shell as `cella-server` runs it, with `CELLA_DEMO`, on a Unix
socket of its own in the unit's runtime directory; the page goes on to
it once it answers. The cookie, `__Host-cella-visitor`, always `Secure`,
is 32 random bytes and nothing else, never the copy's name; the front
keeps in memory alone which copy it names, when its visitor was last
seen and the address it was made for, and records nothing about a
visitor, no address, no name. It brings the visitor back to the same
copy, and the front passes each of their requests to that copy's server
and to no other, the cookie itself stripped from what the server is
handed.

The front is a single process, not a unit per visitor: one unit's
limits hold every copy, and the front needs no right to start units.
Each copy is still a process of its own, so what one visitor's server
holds, its memory, its pools, its sessions, is no other's, and the
server is the same one every scope runs. What keeps a copy to its own
database is Postgres, not the front:

- A copy's role logs in only by a password its server alone is handed,
  over the socket, to its own database: the cluster's `pg_hba.conf`
  lets `<database>_v_…` reach the database of its own name and refuses
  it everywhere else and over TCP. Its database grants `CONNECT` to it
  alone, never to `PUBLIC`. It is no superuser, makes no database or
  role, and may act as `cella_app`, so the row-level policies hold.
- The front logs in as `<database>_front` to `postgres` alone, a role
  that may make databases and roles and grant `cella_app`, but is never
  `cella_app` itself, nor a superuser: it drops a database only where
  it owns it, a copy it made, and checks the name and the copy's mark
  before it does. The setup makes the role and grants it, after the
  template is built.
- The front's unit, as a user of its own (`cella-visitors`), reaches no
  address but localhost and holds no capability: no copy sends mail or
  calls anything outside the host.

### Its limits

Each limit is an option of the module's `demo`, its default set for a
room full of people arriving at once behind one NAT address:

- **How many copies** (`visitors`): unset, the front derives it from the
  host's memory as it starts, (RAM − `reserve`) / `footprint`, the
  reserve 1536 MiB for Postgres's shared buffers, the proxy, the site
  and the rest, and the footprint 160 MiB, a copy's server (127 MiB
  resident, measured on the demo's sign-in and a write) and its
  Postgres connections. That is **6 copies per GiB of RAM** past the
  reserve: about 15 on a cx23 (4 GiB, of which the kernel keeps a
  little), 40 on a cx33 (8 GiB), 90 on a cx43 (16 GiB). Twenty to forty people arriving at once want 8 GiB.
- **How long a copy lives**: two hours with no request (`idle`), and two
  hours after it was made however busy (`lifetime`), so no visitor
  holds one for good; the banner counts down to whichever comes first.
  At the cap, a newcomer ends the copy idle longest if idle 5 minutes
  (`evictAfter`), else the oldest if 10 minutes old (`minAge`), and is
  otherwise asked to come back in a minute.
- **What one address may take**: 40 copies held at once (`perAddress`)
  and 80 made in ten minutes (`perAddressRate`), an IPv6 address
  counted by its /64; 60 made a minute across the host (`perMinute`),
  4 at once (`concurrent`). Only a copy made counts: a refused or
  failed attempt costs the address nothing, so a page asking again
  locks no one out. A public demo with no room to host lowers
  `perAddress`, to 2 say, so no one client holds every copy.
- **What a copy may hold**: its server 192 MiB resident (`memory`),
  past which it ends; 10 connections (`connections`) and 128 MB of
  temporary files; a request's body 2 MB (`upload`), so a file too,
  answered 413 past it, with a length or without; 64 MiB stored past
  its template (`storage`), by `pg_database_size`, past which it takes
  no write and says so, *Your copy holds as much as a demo copy may;
  Reset now for a fresh one*, and past twice which it ends. While the
  disk holding `/var/lib` has less than 1 GiB free (`diskFloor`), no
  copy is made and the copy storing most ends, one each check.

The front checks every copy each 30 s, or a quarter of `idle` where
that is shorter, and a copy's storage again before a write once its
last reading is two seconds old.

The address is the last hop of `X-Forwarded-For`, so the host's proxy
must **set** that header to the client's address, never append to what
the client sent (Caddy: `header_up X-Forwarded-For {remote_host}`);
else a client names any address it likes. A CDN or another proxy in
front of the host makes every visitor its own few addresses, which the
per-address limits then count together: with one, raise `perAddress`
or take the client's address from the CDN's own header in the proxy.

A visitor's copy is a scope spawned on demand, the first form of how a
host spawns a scope per co-op: a database made from a template, a role
and a server of its own, and an end.

A copy that ends has its server stopped and its database dropped with
its role. A visitor whose copy ended is prepared a fresh one, the page
saying their earlier copy was reset. Reset now ends a visitor's copy
and prepares a fresh one at once, under a new cookie; a copy less than
20 s old is kept. The front starts by ending every copy an earlier run
left, and a stopped front ends its copies before it goes, so an
upgrade, which builds the template again, leaves no copy older than it.

Every page of a visitor's copy wears the demo's banner, never
dismissed, at the content's foot as every demo page does and atop the
sign-in's panel: the operator's notice, "This is a prototype
environment for demo purposes and can't be used for real work.", that
its co-op is Lanterne, a mock, and this copy is the visitor's own, that
it resets after two hours idle or when its time runs out and how long
is left (`CELLA_DEMO_IDLE` and `CELLA_DEMO_ENDS`, which the front hands
each server), and its Reset now, a form posting to the front. A demo
that is no visitor's copy carries the same notice. Nobody signs up or
sets a password: the sign-in offers Lanterne's members, as the demo's
always does. The org app sends no mail, in a demo or a scope, and a
demo's unit reaches nothing outside its host.

`checks.visitors` boots a demo serving each visitor a copy, the cap at
two, the idle span 90 s, the lifetime 150 s, storage 4 MiB and one copy
to an address. A request with no cookie makes no copy; two visitors get
two, and one's write reaches neither the other's nor the template; a
copy's role reaches its own database alone, over the socket; the unit
reaches no address but localhost; an address past its copies is
refused, and its refusals cost it nothing; Reset now drops a copy for a
fresh one with the template's log; at the cap the idlest ends; a body
past 2 MB is refused, with a length or without; a copy past its storage
refuses a write, saying why, and past twice it ends; an IPv6 address
counts by its /64; an idle copy ends leaving no database, role, server
or socket; a copy kept busy ends at its lifetime; and a front killed
outright has its copies ended by the next. `checks.demo` serves a
shared demo.
