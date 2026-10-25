+++
title = "Operations"
updated = 2026-10-25
+++

# Operations

What a host does to run a scope and keep it: the server's settings, its
two keys and their rotation, backups and a restore, and upgrades. Every
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
co-op's names, `cella.scope_name` and `cella.scope_legal_name`, and the
mentions its invoices print: `cella.scope_form` (with "à capital variable"
where the capital varies), `cella.scope_capital` (the amount, for a fixed
capital only), `cella.scope_siren`, `cella.scope_rcs` (the town of its
registry), `cella.scope_vat` and `cella.scope_seat`, and the scope's
timezone, `cella.timezone` (an IANA zone such as `Europe/Paris`, whose
day the notary dates every verdict by; UTC when unset), all set with
`ALTER DATABASE … SET`. An invoice keeps the mentions as they stand when it
issues, so a seat that moves changes the invoices issued after the move
and never the PDF of one issued before
([invoice](../../apps/org/feats/invoice/index.md#the-pdf)). `cella migrate --url` makes
the roles `cella_app` and `cella_rules` and every schema; the server
connects as `cella_app` or as a role that is a member of it.

## Keys

The scope has two keys, kept apart so that either rotates alone
([trust](trust.md#keys-and-addresses)):

- **The notary's key** signs every receipt and log entry. `cella.signer`
  keeps every key it has signed with, by id, with the first entry each
  signed, and each entry names its own, so the log verifies from what
  the database stores: a rotated or lost key file loses nothing already
  signed.
- **The vault's key** derives the wrap key that seals every vault key.
  Without it the vault opens nothing; losing it erases every personal
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
4. Unset `cella.vault_key_previous`, reload, and destroy the old file
   once no backup that needs it is kept.

A database from before the notary's 0.2.0, whose vault keys are sealed
under a wrap key derived from the notary's seed, moves the same way: a
new vault key file, the notary's key file as the previous one, then
`cella vault rewrap`.

## Backups

`cella backup <dir> [--url URL]`, on the database's host as a user who
reads its key files, writes a new owner-only directory: the database as
`pg_dump --format=custom` writes it, the notary's and the vault's key
files, and a manifest of the database's name, the extension's version,
the log's head when the backup began, and the settings the database and
its roles carry, which a dump leaves out. Run it nightly from a timer and
copy the directory off the host. It holds the keys in the clear: keep it
as the keys are kept ([trust](trust.md#current-limits)).

A nightly dump loses up to a day. To lose less, archive the cluster's
write-ahead log as well, as [Postgres documents
it](https://www.postgresql.org/docs/18/continuous-archiving.html):
`wal_level = replica`, `archive_mode = on` and an `archive_command` that
copies each segment off the host and fails rather than overwrite one,
with a base backup (`pg_basebackup`) taken weekly. A point-in-time
recovery restores the base backup and replays the archive up to a
`recovery_target_time`; it restores the whole cluster, never the key
files, which come from the latest `cella backup`.

`cella restore <dir> [--db NAME | --url URL]` makes the scope again from a
backup, into a new database on the dev cluster or into an empty one at
`--url`, such as a new host's. It refuses unless the cluster installs the
extension at the version backed up; restore with the build that made the
backup, then [upgrade](#upgrades). It writes each key file where the
cluster's settings say, if it is missing, and refuses if a different key
is already there; makes the roles and the settings; loads the dump; then
checks that the log verifies, that it holds the backup's head, and that
every entry opens from the vault.

The restore is rehearsed by `cella test e2e restore` on every test run:
members write, personal data among it, the scope is backed up, and a
throwaway cluster whose key files do not exist yet restores it, with
every table's rows, the head and the vault as they were, and takes the
next write under the same key.

## Upgrades

Migrations are append-only by stable ids ([architecture](architecture.md#migrations)):
`cella migrate` applies those a database has not, and refuses a file
edited after it was applied. The notary changes the same way: its
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
nothing writes then. `cella test e2e upgrade` rehearses the path from
0.1.0-alpha on a throwaway cluster: a database that version kept, its
dump and the TEST-ONLY key that signed it, is migrated in place, its log
verified under that key, its vault moved to a vault key of its own, and
both keys rotated.
