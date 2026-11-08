+++
title = "Operations"
updated = 2026-11-16
+++

# Operations

What a host does to run a scope and keep it: the server's settings, its
analytics shell, its two keys and their rotation, backups and a restore,
and upgrades. Every
task is a `cella` command ([the CLI](../../apps/org/rs/index.md)) or a
Postgres one; the host's own configuration (its NixOS module, its timers)
lives with the host, not here.

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

A unit runs it with the server, started after Postgres and stopped
before it. A sketch of one, for a NixOS host, with the flake's `cella`
on its path; the shell backgrounds itself, so the unit forks:

```nix
systemd.services.cella-analytics = {
  after = [ "postgresql.service" ];
  requires = [ "postgresql.service" ];
  before = [ "cella.service" ];
  wantedBy = [ "multi-user.target" ];
  path = [ cella ];
  serviceConfig = {
    Type = "forking";
    User = "cella";
    WorkingDirectory = "/var/lib/cella";
    ExecStart = "${cella}/bin/cella analytics start --url postgresql://cella_analytics@localhost/scope";
    ExecStop = "${cella}/bin/cella analytics stop";
    PIDFile = "/var/lib/cella/.data/analytics/54343/pid";
    Restart = "on-failure";
  };
};
```

The server's unit sets `CELLA_ANALYTICS=quack:localhost:54343`,
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
built with adapter-node, its node modules and the `cella` CLI, which
runs it as `cella serve --prod` does, with the DuckDB extensions the
analytics shell loads. Its closure holds no key, no session key and no
database: those are the host's.

The flake's `nixosModules.cella` runs one scope on a NixOS host:
Postgres 18 with `cella-pg` preloaded and the scope's settings, the
notary's and the vault's key files at the paths the host names (the
module never makes a key: `cella key init` does, once, by hand), the
server and its analytics shell as units of their own user, and a
nightly `cella backup` whose directory the host's own backup encrypts
and carries off the host. A NixOS test boots it with test keys,
migrates, signs one write and restores the night's backup.

## The demo

The demo is a production build serving Lanterne, the mock co-op, and
nothing else: never a pilot co-op's data. `cella serve --prod --demo`
runs it, its sign-in offering Lanterne's fixture members by name, each
marked as a demo member, where a production sign-in offers no one;
every page says it is a demo. The demo's scope carries its own keys,
never a real scope's.
