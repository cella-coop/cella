//! A scope's backup and its restore. A backup is a directory: the database
//! as `pg_dump` writes it, the notary's and the vault's key files, the
//! previous vault key's during a rotation and each kept from an earlier
//! one, the scope's erasures, and a manifest naming the database, the
//! extension's version, the log's head, each vault key file's wrap id and
//! the settings the database and its roles carry, which a dump leaves
//! out, all read at one point of the log. A restore makes the database
//! again from it, puts the key files where the cluster reads them, refuses
//! one whose vault names a wrap key none of its key files derives, carries
//! out again every erasure made since that the newest list it is given
//! holds, and checks what it restored: the log verifies, its head is the
//! backup's, and every entry opens, or folds as its erasure left it.

use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

use cella_guards::hex::hex;
use cella_guards::vault;

use crate::data;
use crate::db::Dev;
use crate::key;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, quiet};

const DUMP: &str = "db.dump";
const MANIFEST: &str = "manifest";
const NOTARY: &str = "notary.key";
const VAULT: &str = "vault.key";
const PREVIOUS: &str = "vault.previous.key";
const KEPT: &str = "vault.kept.";

/// The file of a vault key kept from an earlier rotation, the `n`th of
/// `cella.vault_keys_kept`, from 1.
fn kept(n: usize) -> String {
    format!("{KEPT}{n}.key")
}

/// The id of the wrap key a vault key file derives, as each vault key
/// sealed under it names it, in hex.
fn wrap_id(bytes: &[u8]) -> String {
    hex(&vault::wrap_id(&vault::wrap_key(bytes)))
}
const ERASURES: &str = "erasures.json";

/// The scope's erasures as `erasures.json` holds them, one JSON line: the
/// scope, the head they were read at, and every tombstone of
/// `vault.erased`, its subject, class, date, receipt and whether it is
/// restricted, and nothing personal.
const ERASED: &str = "SELECT json_build_object(
           'scope', current_setting('cella.scope', true),
           'head', coalesce((SELECT n FROM cella.head), 0),
           'erasures', coalesce((SELECT json_agg(json_build_object(
               'subject', subject, 'class', class, 'date', date::text, 'receipt', receipt, 'restricted', restricted)
             ORDER BY subject, class) FROM vault.erased), '[]'));";

/// What a backup says of the database it holds.
struct Manifest {
    database: String,
    version: String,
    head: i64,
    hash: String,
    /// `(file, id)`: each vault key file the backup holds, and the id of
    /// the wrap key it derives.
    wraps: Vec<(String, String)>,
    /// `(role, name=value)`, the role empty for the database's own.
    settings: Vec<(String, String)>,
}

impl Manifest {
    fn write(&self) -> String {
        let mut out = String::from(
            "# cella backup: what `cella restore` reads beside the dump and the key files\n",
        );
        out.push_str(&format!(
            "database {}\nversion {}\nhead {} {}\n",
            self.database, self.version, self.head, self.hash
        ));
        for (file, id) in &self.wraps {
            out.push_str(&format!("wrap {file} {id}\n"));
        }
        for (role, setting) in &self.settings {
            out.push_str(&format!(
                "setting {} {setting}\n",
                if role.is_empty() { "-" } else { role }
            ));
        }
        out
    }

    fn read(text: &str) -> Option<Self> {
        let mut m = Self {
            database: String::new(),
            version: String::new(),
            head: 0,
            hash: String::new(),
            wraps: Vec::new(),
            settings: Vec::new(),
        };
        for line in text
            .lines()
            .filter(|l| !l.starts_with('#') && !l.is_empty())
        {
            let (word, rest) = line.split_once(' ')?;
            match word {
                "database" => rest.clone_into(&mut m.database),
                "version" => rest.clone_into(&mut m.version),
                "head" => {
                    let (n, hash) = rest.split_once(' ')?;
                    m.head = n.parse().ok()?;
                    hash.clone_into(&mut m.hash);
                }
                "wrap" => {
                    let (file, id) = rest.split_once(' ')?;
                    m.wraps.push((file.to_owned(), id.to_owned()));
                }
                "setting" => {
                    let (role, setting) = rest.split_once(' ')?;
                    m.settings.push((
                        if role == "-" {
                            String::new()
                        } else {
                            role.to_owned()
                        },
                        setting.to_owned(),
                    ));
                }
                _ => return None,
            }
        }
        (!m.database.is_empty() && !m.version.is_empty()).then_some(m)
    }
}

/// psql on a database: the dev cluster's by name, or any by URL.
fn psql(dev: &Dev, db: &Target, sql: &str) -> Result<String> {
    let mut cmd = db.cmd(dev, "psql")?;
    cmd.args([
        "-X",
        "-q",
        "-t",
        "-A",
        "-F",
        "\t",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ]);
    Steps::read(&mut cmd)
}

/// A database a backup reads or a restore writes.
enum Target<'a> {
    Dev(String),
    Url(&'a str),
}

impl Target<'_> {
    /// A command on it, naming it by `-d`, as psql, `pg_dump` and
    /// `pg_restore` each take it.
    fn cmd(&self, dev: &Dev, program: &str) -> Result<Command> {
        let (mut cmd, db) = match self {
            Self::Dev(name) => (dev.on(name, program), name.as_str()),
            Self::Url(url) => (data::on(dev, Some(url), program)?, *url),
        };
        cmd.args(["-d", db]);
        Ok(cmd)
    }
}

fn io(path: &Path) -> impl Fn(std::io::Error) -> Fail + '_ {
    move |e| Fail::new(format!("{}: {e}", path.display()))
}

/// Backs a database up into `dir`, which it creates, owner-only. Run it on
/// the database's host, as a user who reads the key files. A backup that
/// fails, or during which a key setting changed, leaves no directory.
pub fn backup(repo: &Repo, dir: &Path, url: Option<&str>) -> Result {
    let dev = Dev::new(repo);
    let db = match url {
        Some(url) => Target::Url(url),
        None => {
            dev.up()?;
            Target::Dev(dev.db.clone())
        }
    };
    fs::create_dir(dir).map_err(|e| {
        Fail::new(format!(
            "{}: {e}; a backup goes to a new directory",
            dir.display()
        ))
    })?;
    let made = fs::set_permissions(dir, fs::Permissions::from_mode(0o700))
        .map_err(io(dir))
        .and_then(|()| back_up(&dev, &db, dir));
    if made.is_err() {
        let _ = fs::remove_dir_all(dir);
    }
    made
}

/// The paths of the notary's key, the vault's, the vault's previous and
/// those it keeps, `-` where unset, as a select list.
const KEYS: &str = "coalesce(nullif(current_setting('cella.key_file', true), ''), '-'),
                coalesce(nullif(current_setting('cella.vault_key_file', true), ''), '-'),
                coalesce(nullif(current_setting('cella.vault_key_previous', true), ''), '-'),
                coalesce(nullif(current_setting('cella.vault_keys_kept', true), ''), '-')";

/// The paths `cella.vault_keys_kept` names, in order.
fn kept_paths(setting: &str) -> Vec<&str> {
    if setting == "-" {
        return Vec::new();
    }
    setting
        .split(',')
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect()
}

fn back_up(dev: &Dev, db: &Target, dir: &Path) -> Result {
    // One repeatable-read transaction reads the head, the settings and the
    // key paths and exports its snapshot, which pg_dump dumps; it stays open
    // until the key files are read and the dump has taken it.
    let mut at = Snapshot::open(dev, db)?;
    let facts = at.row(&format!(
        "SELECT current_database(), (SELECT extversion FROM pg_extension WHERE extname = 'cella'),
                coalesce((SELECT n FROM cella.head), 0), coalesce((SELECT encode(hash, 'hex') FROM cella.head), '-'),
                {KEYS};"
    ))?;
    let f: Vec<&str> = facts.split('\t').collect();
    let [
        database,
        version,
        head,
        hash,
        notary,
        vault,
        previous,
        kept_setting,
    ] = f[..]
    else {
        return Err(Fail::new(format!(
            "unexpected answer about the database: {facts}"
        )));
    };
    let settings = at.rows(
        "SELECT coalesce(r.rolname, '-'), s
         FROM pg_db_role_setting d LEFT JOIN pg_roles r ON r.oid = d.setrole, unnest(d.setconfig) s
         WHERE d.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
         ORDER BY 1, 2;",
    )?;
    let erasures = at.row(ERASED)?;
    let snapshot = at.row("SELECT pg_export_snapshot();")?;

    let kept_files: Vec<(String, &str)> = kept_paths(kept_setting)
        .into_iter()
        .enumerate()
        .map(|(i, p)| (kept(i + 1), p))
        .collect();
    let mut keys = vec![
        ("cella.key_file", notary, NOTARY.to_owned()),
        ("cella.vault_key_file", vault, VAULT.to_owned()),
        ("cella.vault_key_previous", previous, PREVIOUS.to_owned()),
    ];
    keys.extend(
        kept_files
            .iter()
            .map(|(name, path)| ("cella.vault_keys_kept", *path, name.clone())),
    );
    let mut wraps = Vec::new();
    for (setting, path, name) in &keys {
        if *path == "-" && name == PREVIOUS {
            continue;
        }
        if *path == "-" {
            return Err(Fail::new(format!(
                "the cluster sets no {setting}, so there is no key to back up"
            )));
        }
        let bytes = fs::read(path)
            .map_err(|e| Fail::new(format!("{setting} {path}: {e}; back up on the database's host, as a user who reads its key files")))?;
        key::write(&dir.join(name), &bytes)?;
        if name != NOTARY {
            wraps.push((name.clone(), wrap_id(&bytes)));
        }
    }
    let manifest = Manifest {
        database: database.to_owned(),
        version: version.to_owned(),
        head: head
            .parse()
            .map_err(|_| Fail::new(format!("the head is not a number: {head}")))?,
        hash: hash.to_owned(),
        wraps,
        settings: settings
            .iter()
            .filter_map(|l| l.split_once('\t'))
            .map(|(r, s)| {
                (
                    if r == "-" {
                        String::new()
                    } else {
                        r.to_owned()
                    },
                    s.to_owned(),
                )
            })
            .collect(),
    };
    let mut dump = db.cmd(dev, "pg_dump")?;
    dump.args(["--format=custom", "--snapshot", &snapshot, "--file"])
        .arg(dir.join(DUMP));
    Steps::read(&mut dump)?;
    at.close()?;

    // A key path that moved while the backup ran is a rotation under way,
    // and the keys it read may not open what it dumped.
    let now = psql(dev, db, &format!("SELECT {KEYS}"))?;
    let before = [
        ("cella.key_file", notary),
        ("cella.vault_key_file", vault),
        ("cella.vault_key_previous", previous),
        ("cella.vault_keys_kept", kept_setting),
    ];
    for ((setting, before), now) in before.iter().zip(now.split('\t')) {
        if *before != now {
            return Err(Fail::new(format!(
                "{setting} moved from {before} to {now} while the backup ran: a rotation is under way, so back up again once it is done"
            )));
        }
    }
    let path = dir.join(MANIFEST);
    let list = dir.join(ERASURES);
    fs::write(&list, format!("{erasures}\n")).map_err(io(&list))?;
    fs::write(&path, manifest.write()).map_err(io(&path))?;
    let kept_said = match kept_files.len() {
        0 => String::new(),
        1 => ", the vault key kept from an earlier rotation".to_owned(),
        n => format!(", the {n} vault keys kept from earlier rotations"),
    };
    println!(
        "backed up {database} at entry {head} into {}: the dump, the notary's and the vault's keys{}{kept_said}, the erasures, the manifest; keep it as you keep the keys",
        dir.display(),
        if previous == "-" {
            ""
        } else {
            ", the previous vault key"
        }
    );
    Ok(())
}

/// A psql session holding one repeatable-read, read-only transaction open,
/// each query's rows read back as it answers them.
struct Snapshot {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

/// The row a session's query is followed by, which marks where its rows end.
const END: &str = "-- end of rows --";

impl Snapshot {
    fn open(dev: &Dev, db: &Target) -> Result<Self> {
        let mut cmd = db.cmd(dev, "psql")?;
        cmd.args(["-X", "-q", "-t", "-A", "-F", "\t", "-v", "ON_ERROR_STOP=1"]);
        cmd.stdin(Stdio::piped()).stdout(Stdio::piped());
        let mut child = cmd.spawn().map_err(|e| Fail::new(format!("psql: {e}")))?;
        let (Some(input), Some(output)) = (child.stdin.take(), child.stdout.take()) else {
            return Err(Fail::new("psql: no pipe to its session"));
        };
        let mut at = Self {
            child,
            input,
            output: BufReader::new(output),
        };
        at.send("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;")?;
        Ok(at)
    }

    fn send(&mut self, sql: &str) -> Result {
        writeln!(self.input, "{sql}")
            .and_then(|()| self.input.flush())
            .map_err(|e| Fail::new(format!("psql: {e}")))
    }

    /// A query's rows, up to the marker sent after it. psql gone, it has
    /// said why on standard error.
    fn rows(&mut self, sql: &str) -> Result<Vec<String>> {
        self.send(sql)?;
        self.send(&format!("SELECT '{END}';"))?;
        let mut rows = Vec::new();
        loop {
            let mut line = String::new();
            if self
                .output
                .read_line(&mut line)
                .map_err(|e| Fail::new(format!("psql: {e}")))?
                == 0
            {
                let _ = self.child.wait();
                return Err(Fail::new("psql left the backup's transaction"));
            }
            match line.trim_end_matches('\n') {
                END => return Ok(rows),
                row => rows.push(row.to_owned()),
            }
        }
    }

    fn row(&mut self, sql: &str) -> Result<String> {
        let mut rows = self.rows(sql)?;
        if rows.len() != 1 {
            return Err(Fail::new(format!(
                "{} rows where one was expected, from {sql}",
                rows.len()
            )));
        }
        Ok(rows.remove(0))
    }

    fn close(mut self) -> Result {
        self.send("COMMIT;")?;
        drop(self.input);
        let status = self
            .child
            .wait()
            .map_err(|e| Fail::new(format!("psql: {e}")))?;
        if !status.success() {
            return Err(Fail::new(format!(
                "psql left the backup's transaction: {status}"
            )));
        }
        Ok(())
    }
}

/// Restores a backup into a new database on the dev cluster, or into an
/// empty one at `url`. The cluster must install the extension at the
/// version backed up; its key files are written from the backup where
/// they are missing and must match it where they are not. Before the
/// database opens to any role but a superuser, it carries out again the
/// erasures of the newest list it is given, `erasures` naming a later
/// backup's directory or its `erasures.json`, the backup's own where none
/// is named.
pub fn restore(
    repo: &Repo,
    steps: &Steps,
    dir: &Path,
    name: Option<&str>,
    url: Option<&str>,
    erasures: Option<&Path>,
) -> Result {
    let path = dir.join(MANIFEST);
    let text = fs::read_to_string(&path).map_err(io(&path))?;
    let manifest = Manifest::read(&text).ok_or_else(|| {
        Fail::new(format!(
            "{} is not a cella backup's manifest",
            path.display()
        ))
    })?;
    let own = dir.join(ERASURES);
    let given = match erasures {
        Some(p) if p.is_dir() => p.join(ERASURES),
        Some(p) => p.to_owned(),
        None => own.clone(),
    };
    let list = fs::read_to_string(&given).map_err(io(&given))?;
    let list = list.trim();
    let own_list = fs::read_to_string(&own).map_err(io(&own))?;
    let dev = Dev::new(repo);
    let db = match url {
        Some(url) => Target::Url(url),
        None => {
            dev.up()?;
            let name = name.unwrap_or(&manifest.database).to_owned();
            let mut create = dev.on("postgres", "createdb");
            create.arg(&name);
            steps.run(&format!("createdb {name}"), &mut [create], quiet)?;
            Target::Dev(name)
        }
    };

    let facts = psql(
        &dev,
        &db,
        &format!(
            "SELECT coalesce((SELECT default_version FROM pg_available_extensions WHERE name = 'cella'), '-'),
                    EXISTS (SELECT FROM pg_namespace WHERE nspname = 'cella'),
                    (SELECT datconnlimit FROM pg_database WHERE datname = current_database()), {KEYS},
                    coalesce(o.l ->> 'scope', '-'), coalesce(g.l ->> 'scope', '-'), g.l ->> 'head'
             FROM (SELECT {}::jsonb AS l) o, (SELECT {}::jsonb AS l) g",
            literal(own_list.trim()),
            literal(list)
        ),
    )?;
    let f: Vec<&str> = facts.split('\t').collect();
    let [
        version,
        taken,
        limit,
        notary,
        vault,
        previous,
        kept_setting,
        own_scope,
        given_scope,
        given_head,
    ] = f[..]
    else {
        return Err(Fail::new(format!(
            "unexpected answer about the cluster: {facts}"
        )));
    };
    let limit: i64 = limit.parse().map_err(|_| {
        Fail::new(format!(
            "the database's connection limit is not a number: {limit}"
        ))
    })?;
    // The erasures a restore re-applies are the scope's, read no earlier
    // than its dump: an older list misses the erasures the dump holds.
    if given_scope != own_scope {
        return Err(Fail::new(format!(
            "the erasures at {} are of scope {given_scope}, and the backup is of {own_scope}: give the erasures of a later backup of the same scope",
            given.display()
        )));
    }
    let given_head: i64 = given_head
        .parse()
        .map_err(|_| Fail::new(format!("{} says no head it was read at", given.display())))?;
    if given_head < manifest.head {
        return Err(Fail::new(format!(
            "the erasures at {} were read at entry {given_head}, before this backup's entry {}: give a later backup's, or none to take the backup's own",
            given.display(),
            manifest.head
        )));
    }
    if version != manifest.version {
        return Err(Fail::new(format!(
            "the backup is of cella {}, and this cluster installs {version}: restore with the build that made it, then migrate",
            manifest.version
        )));
    }
    if taken == "t" {
        return Err(Fail::new(
            "the database already holds a scope; a restore goes into an empty one",
        ));
    }
    // A backup taken during a vault rotation holds the previous key too,
    // which opens the vault keys not yet sealed under the new one.
    let rotating = dir.join(PREVIOUS).exists();
    if rotating && previous == "-" {
        return Err(Fail::new(
            "the backup was taken during a vault rotation and holds the previous vault key, and the cluster sets no cella.vault_key_previous: point it where that key goes, restore, then `cella vault rewrap`",
        ));
    }
    let keys = [
        ("cella.key_file", notary, NOTARY),
        ("cella.vault_key_file", vault, VAULT),
        ("cella.vault_key_previous", previous, PREVIOUS),
    ];
    for (setting, path, name) in keys {
        if name == PREVIOUS && !rotating {
            continue;
        }
        let from = dir.join(name);
        if path == "-" {
            return Err(Fail::new(format!(
                "the cluster sets no {setting}: point it where the key goes, then restore"
            )));
        }
        let backed = fs::read(&from).map_err(io(&from))?;
        let target = Path::new(path);
        match fs::read(target) {
            Ok(held) if held == backed => {}
            Ok(_) => {
                return Err(Fail::new(format!(
                    "{setting} {path} holds another key than the backup's; a restore never overwrites a key, so move it aside or restore on another cluster"
                )));
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => key::write(target, &backed)?,
            Err(e) => return Err(Fail::new(format!("{setting} {path}: {e}"))),
        }
    }
    // The vault keys kept from earlier rotations open no vault key of this
    // backup's, but an older restore point's: each goes where the cluster
    // keeps one, in a path already holding it or else the first one free.
    let held = (1..)
        .map(kept)
        .take_while(|name| dir.join(name).exists())
        .collect::<Vec<_>>();
    let paths = kept_paths(kept_setting);
    for name in &held {
        let from = dir.join(name);
        let backed = fs::read(&from).map_err(io(&from))?;
        let mut free = None;
        let mut there = false;
        for path in &paths {
            match fs::read(path) {
                Ok(bytes) if bytes == backed => there = true,
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => free = free.or(Some(*path)),
                Err(e) => return Err(Fail::new(format!("cella.vault_keys_kept {path}: {e}"))),
            }
        }
        match (there, free) {
            (true, _) => {}
            (false, Some(path)) => key::write(Path::new(path), &backed)?,
            (false, None) => {
                return Err(Fail::new(format!(
                    "the backup keeps {} vault keys from earlier rotations, and cella.vault_keys_kept names no free path for {name}, the wrap key {}: add a path for it, then restore",
                    held.len(),
                    wrap_id(&backed)
                )));
            }
        }
    }

    // No role but a superuser connects until the erasures made since the
    // backup are carried out again and the checks pass: a connection limit
    // of none binds every other role. Then the roles the scope's grants
    // name, and the settings a dump leaves out, both before the dump so its
    // grants and the checks find them.
    let mut prepare = String::from(
        "DO $$ BEGIN EXECUTE format('ALTER DATABASE %I CONNECTION LIMIT 0', current_database()); END $$;
         DO $$ BEGIN
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_app') THEN CREATE ROLE cella_app LOGIN; END IF;
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_guards') THEN
             CREATE ROLE cella_guards NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
           END IF;
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_analytics') THEN
             CREATE ROLE cella_analytics LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE;
           END IF;
         END $$;
         ALTER ROLE cella_analytics SET default_transaction_read_only = on;",
    );
    for (role, setting) in &manifest.settings {
        let (key, value) = setting
            .split_once('=')
            .ok_or_else(|| Fail::new(format!("a setting without a value: {setting}")))?;
        let who = if role.is_empty() { "" } else { "ROLE %I IN " };
        let alter = format!("ALTER {who}DATABASE %I SET %s = %L");
        let args = if role.is_empty() {
            String::new()
        } else {
            format!("{}, ", literal(role))
        };
        prepare.push_str(&format!(
            "DO $$ BEGIN EXECUTE format({}, {args}current_database(), {}, {}); END $$;",
            literal(&alter),
            literal(key),
            literal(value)
        ));
    }
    psql(&dev, &db, &prepare)?;
    let mut load = db.cmd(&dev, "pg_restore")?;
    load.args(["--no-owner", "--exit-on-error", "--single-transaction"])
        .arg(dir.join(DUMP));
    steps.run("pg_restore", &mut [load], quiet)?;

    // Each vault key names the wrap key that sealed it: one that none of
    // the backup's key files derives would open nothing, so the restore
    // says which key it lacks rather than fail on the first entry.
    let mut derived = Vec::new();
    for name in [VAULT, PREVIOUS].into_iter().map(str::to_owned).chain(held) {
        let from = dir.join(&name);
        if from.exists() {
            derived.push(wrap_id(&fs::read(&from).map_err(io(&from))?));
        }
    }
    let named = psql(
        &dev,
        &db,
        "SELECT encode(wrap, 'hex'), count(*) FROM vault.key GROUP BY 1 ORDER BY 1",
    )?;
    for line in named.lines().filter(|l| !l.is_empty()) {
        let (id, count) = line
            .split_once('\t')
            .ok_or_else(|| Fail::new(format!("unexpected answer about the vault: {line}")))?;
        if !derived.iter().any(|d| d == id) {
            return Err(Fail::new(format!(
                "the restored vault seals {count} vault keys under the wrap key {id}, which none of the backup's key files derives: find the vault key file of that id, which an earlier backup's manifest names, and add it to the backup as {PREVIOUS}"
            )));
        }
    }

    // The dump holds every vault key erased since it was taken: each such
    // erasure the newest list holds is carried out again.
    let again = psql(
        &dev,
        &db,
        &format!("SELECT cella.vault_reerase({}::jsonb)", literal(list)),
    )?;

    let checked = psql(
        &dev,
        &db,
        "SELECT cella.verify_log(), coalesce((SELECT n FROM cella.head), 0),
                coalesce((SELECT encode(hash, 'hex') FROM cella.head), '-'),
                (SELECT count(cella.opened(n)) FROM cella.log), (SELECT count(*) FROM cella.log)",
    )?;
    let f: Vec<&str> = checked.split('\t').collect();
    let [verified, head, hash, opened, entries] = f[..] else {
        return Err(Fail::new(format!(
            "unexpected answer from the restored database: {checked}"
        )));
    };
    if verified != "t" {
        return Err(Fail::new("the restored log does not verify"));
    }
    if head != manifest.head.to_string() || hash != manifest.hash {
        return Err(Fail::new(format!(
            "the restored log's head is entry {head}, and the backup's is entry {}: the dump and the manifest disagree",
            manifest.head
        )));
    }
    if opened != entries {
        return Err(Fail::new(format!(
            "{opened} of {entries} entries open from the vault"
        )));
    }
    psql(
        &dev,
        &db,
        &format!(
            "DO $$ BEGIN EXECUTE format('ALTER DATABASE %I CONNECTION LIMIT {limit}', current_database()); END $$;"
        ),
    )?;
    let name = match &db {
        Target::Dev(name) => name.clone(),
        Target::Url(_) => manifest.database.clone(),
    };
    println!(
        "restored {name}: the log verifies, {head} entries, entry {} as backed up; {again} erasures made since carried out again; every entry opens, or folds as its erasure left it",
        manifest.head
    );
    Ok(())
}

/// A SQL string literal.
fn literal(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::{Manifest, kept};

    #[test]
    fn a_manifest_reads_back_as_written() {
        let m = Manifest {
            database: "lanterne".into(),
            version: "0.2.0".into(),
            head: 30,
            hash: "ab".repeat(32),
            wraps: vec![
                ("vault.key".into(), "cd".repeat(32)),
                (kept(1), "ef".repeat(32)),
            ],
            settings: vec![
                (String::new(), "cella.scope=lanterne.example".into()),
                (String::new(), "cella.timezone=Europe/Paris".into()),
                ("cella_app".into(), "cella.clock=2026-10-24".into()),
            ],
        };
        let back = Manifest::read(&m.write()).unwrap();
        assert_eq!(
            (back.database.as_str(), back.version.as_str(), back.head),
            ("lanterne", "0.2.0", 30)
        );
        assert_eq!(back.hash, m.hash);
        assert_eq!(back.wraps, m.wraps);
        assert_eq!(back.settings, m.settings);
        assert!(Manifest::read("database x\nunknown y\n").is_none());
    }
}
