//! A scope's backup and its restore. A backup is a directory: the database
//! as `pg_dump` writes it, the notary's and the vault's key files, the
//! previous vault key's during a rotation, and a manifest naming the
//! database, the extension's version, the log's head and the settings the
//! database and its roles carry, which a dump leaves out, all read at one
//! point of the log. A restore makes the database again from it, puts the
//! key files where the cluster reads them, and checks what it restored:
//! the log verifies, its head is the backup's, and every entry opens.

use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

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

/// What a backup says of the database it holds.
struct Manifest {
    database: String,
    version: String,
    head: i64,
    hash: String,
    /// `(role, name=value)`, the role empty for the database's own.
    settings: Vec<(String, String)>,
}

impl Manifest {
    fn write(&self) -> String {
        let mut out = String::from("# cella backup: what `cella restore` reads beside the dump and the key files\n");
        out.push_str(&format!("database {}\nversion {}\nhead {} {}\n", self.database, self.version, self.head, self.hash));
        for (role, setting) in &self.settings {
            out.push_str(&format!("setting {} {setting}\n", if role.is_empty() { "-" } else { role }));
        }
        out
    }

    fn read(text: &str) -> Option<Self> {
        let mut m = Self { database: String::new(), version: String::new(), head: 0, hash: String::new(), settings: Vec::new() };
        for line in text.lines().filter(|l| !l.starts_with('#') && !l.is_empty()) {
            let (word, rest) = line.split_once(' ')?;
            match word {
                "database" => rest.clone_into(&mut m.database),
                "version" => rest.clone_into(&mut m.version),
                "head" => {
                    let (n, hash) = rest.split_once(' ')?;
                    m.head = n.parse().ok()?;
                    hash.clone_into(&mut m.hash);
                }
                "setting" => {
                    let (role, setting) = rest.split_once(' ')?;
                    m.settings.push((if role == "-" { String::new() } else { role.to_owned() }, setting.to_owned()));
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
    cmd.args(["-X", "-q", "-t", "-A", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql]);
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
    fs::create_dir(dir).map_err(|e| Fail::new(format!("{}: {e}; a backup goes to a new directory", dir.display())))?;
    let made = fs::set_permissions(dir, fs::Permissions::from_mode(0o700)).map_err(io(dir)).and_then(|()| back_up(&dev, &db, dir));
    if made.is_err() {
        let _ = fs::remove_dir_all(dir);
    }
    made
}

/// The paths of the notary's key, the vault's and the vault's previous,
/// `-` where unset, as a select list.
const KEYS: &str = "coalesce(nullif(current_setting('cella.key_file', true), ''), '-'),
                coalesce(nullif(current_setting('cella.vault_key_file', true), ''), '-'),
                coalesce(nullif(current_setting('cella.vault_key_previous', true), ''), '-')";

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
    let [database, version, head, hash, notary, vault, previous] = f[..] else {
        return Err(Fail::new(format!("unexpected answer about the database: {facts}")));
    };
    let settings = at.rows(
        "SELECT coalesce(r.rolname, '-'), s
         FROM pg_db_role_setting d LEFT JOIN pg_roles r ON r.oid = d.setrole, unnest(d.setconfig) s
         WHERE d.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
         ORDER BY 1, 2;",
    )?;
    let snapshot = at.row("SELECT pg_export_snapshot();")?;
    let manifest = Manifest {
        database: database.to_owned(),
        version: version.to_owned(),
        head: head.parse().map_err(|_| Fail::new(format!("the head is not a number: {head}")))?,
        hash: hash.to_owned(),
        settings: settings
            .iter()
            .filter_map(|l| l.split_once('\t'))
            .map(|(r, s)| (if r == "-" { String::new() } else { r.to_owned() }, s.to_owned()))
            .collect(),
    };

    let keys =
        [("cella.key_file", notary, NOTARY), ("cella.vault_key_file", vault, VAULT), ("cella.vault_key_previous", previous, PREVIOUS)];
    for (setting, path, name) in keys {
        if path == "-" && name == PREVIOUS {
            continue;
        }
        if path == "-" {
            return Err(Fail::new(format!("the cluster sets no {setting}, so there is no key to back up")));
        }
        let bytes = fs::read(path)
            .map_err(|e| Fail::new(format!("{setting} {path}: {e}; back up on the database's host, as a user who reads its key files")))?;
        key::write(&dir.join(name), &bytes)?;
    }
    let mut dump = db.cmd(dev, "pg_dump")?;
    dump.args(["--format=custom", "--snapshot", &snapshot, "--file"]).arg(dir.join(DUMP));
    Steps::read(&mut dump)?;
    at.close()?;

    // A key path that moved while the backup ran is a rotation under way,
    // and the keys it read may not open what it dumped.
    let now = psql(dev, db, &format!("SELECT {KEYS}"))?;
    for ((setting, before, _), now) in keys.iter().zip(now.split('\t')) {
        if *before != now {
            return Err(Fail::new(format!(
                "{setting} moved from {before} to {now} while the backup ran: a rotation is under way, so back up again once it is done"
            )));
        }
    }
    let path = dir.join(MANIFEST);
    fs::write(&path, manifest.write()).map_err(io(&path))?;
    println!(
        "backed up {database} at entry {head} into {}: the dump, the notary's and the vault's keys{}, the manifest; keep it as you keep the keys",
        dir.display(),
        if previous == "-" { "" } else { ", the previous vault key" }
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
        let mut at = Self { child, input, output: BufReader::new(output) };
        at.send("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;")?;
        Ok(at)
    }

    fn send(&mut self, sql: &str) -> Result {
        writeln!(self.input, "{sql}").and_then(|()| self.input.flush()).map_err(|e| Fail::new(format!("psql: {e}")))
    }

    /// A query's rows, up to the marker sent after it. psql gone, it has
    /// said why on standard error.
    fn rows(&mut self, sql: &str) -> Result<Vec<String>> {
        self.send(sql)?;
        self.send(&format!("SELECT '{END}';"))?;
        let mut rows = Vec::new();
        loop {
            let mut line = String::new();
            if self.output.read_line(&mut line).map_err(|e| Fail::new(format!("psql: {e}")))? == 0 {
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
            return Err(Fail::new(format!("{} rows where one was expected, from {sql}", rows.len())));
        }
        Ok(rows.remove(0))
    }

    fn close(mut self) -> Result {
        self.send("COMMIT;")?;
        drop(self.input);
        let status = self.child.wait().map_err(|e| Fail::new(format!("psql: {e}")))?;
        if !status.success() {
            return Err(Fail::new(format!("psql left the backup's transaction: {status}")));
        }
        Ok(())
    }
}

/// Restores a backup into a new database on the dev cluster, or into an
/// empty one at `url`. The cluster must install the extension at the
/// version backed up; its key files are written from the backup where
/// they are missing and must match it where they are not.
pub fn restore(repo: &Repo, steps: &Steps, dir: &Path, name: Option<&str>, url: Option<&str>) -> Result {
    let path = dir.join(MANIFEST);
    let text = fs::read_to_string(&path).map_err(io(&path))?;
    let manifest = Manifest::read(&text).ok_or_else(|| Fail::new(format!("{} is not a cella backup's manifest", path.display())))?;
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
                    EXISTS (SELECT FROM pg_namespace WHERE nspname = 'cella'), {KEYS}"
        ),
    )?;
    let f: Vec<&str> = facts.split('\t').collect();
    let [version, taken, notary, vault, previous] = f[..] else {
        return Err(Fail::new(format!("unexpected answer about the cluster: {facts}")));
    };
    if version != manifest.version {
        return Err(Fail::new(format!(
            "the backup is of cella {}, and this cluster installs {version}: restore with the build that made it, then migrate",
            manifest.version
        )));
    }
    if taken == "t" {
        return Err(Fail::new("the database already holds a scope; a restore goes into an empty one"));
    }
    // A backup taken during a vault rotation holds the previous key too,
    // which opens the vault keys not yet sealed under the new one.
    let rotating = dir.join(PREVIOUS).exists();
    if rotating && previous == "-" {
        return Err(Fail::new(
            "the backup was taken during a vault rotation and holds the previous vault key, and the cluster sets no cella.vault_key_previous: point it where that key goes, restore, then `cella vault rewrap`",
        ));
    }
    let keys =
        [("cella.key_file", notary, NOTARY), ("cella.vault_key_file", vault, VAULT), ("cella.vault_key_previous", previous, PREVIOUS)];
    for (setting, path, name) in keys {
        if name == PREVIOUS && !rotating {
            continue;
        }
        let from = dir.join(name);
        if path == "-" {
            return Err(Fail::new(format!("the cluster sets no {setting}: point it where the key goes, then restore")));
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

    // The roles the scope's grants name, then the settings a dump leaves
    // out, both before the dump so its grants and the checks find them.
    let mut prepare = String::from(
        "DO $$ BEGIN
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
        let (key, value) = setting.split_once('=').ok_or_else(|| Fail::new(format!("a setting without a value: {setting}")))?;
        let who = if role.is_empty() { "" } else { "ROLE %I IN " };
        let alter = format!("ALTER {who}DATABASE %I SET %s = %L");
        let args = if role.is_empty() { String::new() } else { format!("{}, ", literal(role)) };
        prepare.push_str(&format!(
            "DO $$ BEGIN EXECUTE format({}, {args}current_database(), {}, {}); END $$;",
            literal(&alter),
            literal(key),
            literal(value)
        ));
    }
    psql(&dev, &db, &prepare)?;
    let mut load = db.cmd(&dev, "pg_restore")?;
    load.args(["--no-owner", "--exit-on-error", "--single-transaction"]).arg(dir.join(DUMP));
    steps.run("pg_restore", &mut [load], quiet)?;

    let checked = psql(
        &dev,
        &db,
        "SELECT cella.verify_log(), coalesce((SELECT n FROM cella.head), 0),
                coalesce((SELECT encode(hash, 'hex') FROM cella.head), '-'),
                (SELECT count(cella.opened(n)) FROM cella.log), (SELECT count(*) FROM cella.log)",
    )?;
    let f: Vec<&str> = checked.split('\t').collect();
    let [verified, head, hash, opened, entries] = f[..] else {
        return Err(Fail::new(format!("unexpected answer from the restored database: {checked}")));
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
        return Err(Fail::new(format!("{opened} of {entries} entries open from the vault")));
    }
    let name = match &db {
        Target::Dev(name) => name.clone(),
        Target::Url(_) => manifest.database.clone(),
    };
    println!("restored {name}: the log verifies, {head} entries, entry {} as backed up; every entry opens", manifest.head);
    Ok(())
}

/// A SQL string literal.
fn literal(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::Manifest;

    #[test]
    fn a_manifest_reads_back_as_written() {
        let m = Manifest {
            database: "lanterne".into(),
            version: "0.2.0".into(),
            head: 30,
            hash: "ab".repeat(32),
            settings: vec![
                (String::new(), "cella.scope=lanterne.example".into()),
                (String::new(), "cella.scope_legal_name=Lanterne SCOP SARL".into()),
                ("cella_app".into(), "cella.clock=2026-10-24".into()),
            ],
        };
        let back = Manifest::read(&m.write()).unwrap();
        assert_eq!((back.database.as_str(), back.version.as_str(), back.head), ("lanterne", "0.2.0", 30));
        assert_eq!(back.hash, m.hash);
        assert_eq!(back.settings, m.settings);
        assert!(Manifest::read("database x\nunknown y\n").is_none());
    }
}
