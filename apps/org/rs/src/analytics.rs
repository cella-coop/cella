use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use crate::cli::Analytics;
use crate::db::Dev;
use crate::key;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps};

/// The extensions the shell loads: `httpfs`, whose crypto quack serves
/// with, `quack`, its server, and `postgres_scanner`, its attach.
const EXTENSIONS: [&str; 3] = ["httpfs", "quack", "postgres_scanner"];

/// How long a starting shell has to answer.
const READY: Duration = Duration::from_secs(30);

/// The analytics shell: a DuckDB 2.0 server per scope that attaches its
/// database read-only as `cella_analytics` and serves it over quack on
/// localhost, behind a token. Its state lives in `.data/analytics/<port>`:
/// the token, the SQL it starts with and a client attaches with, its pid
/// and its log.
pub struct Shell<'a> {
    repo: &'a Repo,
    pub port: u16,
    dir: PathBuf,
}

/// The database the shell reads: one on the dev cluster by name, or any by
/// URL, which logs in as `cella_analytics`.
pub enum Target<'a> {
    Dev(&'a str),
    Url(&'a str),
}

impl<'a> Shell<'a> {
    pub fn new(repo: &'a Repo, port: Option<u16>) -> Self {
        let port = port.or_else(|| env::var("CELLA_ANALYTICS_PORT").ok()?.parse().ok()).unwrap_or(54343);
        Self { repo, port, dir: repo.data().join("analytics").join(port.to_string()) }
    }

    pub fn url(&self) -> String {
        format!("quack:localhost:{}", self.port)
    }

    pub fn token(&self) -> PathBuf {
        self.dir.join("token")
    }

    /// The shell's pid while it runs: the pid file's, if that process is
    /// DuckDB still, so a pid another process took since is never signalled.
    fn pid(&self) -> Option<u32> {
        let pid: u32 = fs::read_to_string(self.dir.join("pid")).ok()?.trim().parse().ok()?;
        let cmdline = fs::read(Path::new("/proc").join(pid.to_string()).join("cmdline")).ok()?;
        String::from_utf8_lossy(&cmdline).contains("duckdb").then_some(pid)
    }

    pub fn running(&self) -> bool {
        self.pid().is_some()
    }

    /// Hands a server the shell: where it serves and its token's file,
    /// which the port reads with `CELLA_DUCKDB_EXTENSIONS`.
    pub fn env(&self, cmd: &mut Command) {
        cmd.env("CELLA_ANALYTICS", self.url()).env("CELLA_ANALYTICS_TOKEN_FILE", self.token());
    }

    /// Starts the shell on a database, unless it runs; waits until it
    /// answers as `cella_analytics`, and stops it if it answers as any
    /// other role.
    pub fn start(&self, target: &Target) -> Result {
        if let Some(pid) = self.pid() {
            println!("analytics shell runs already on {} (pid {pid})", self.url());
            return Ok(());
        }
        let extensions = extensions()?;
        fs::DirBuilder::new().recursive(true).mode(0o700).create(&self.dir).map_err(io(&self.dir))?;
        let token = self.token();
        if !token.exists() {
            key::token(&token)?;
        }
        let secret = fs::read_to_string(&token).map_err(io(&token))?;
        let attach = match target {
            Target::Dev(db) => format!("host=127.0.0.1 port={} dbname={db} user=cella_analytics", Dev::new(self.repo).port),
            Target::Url(url) => (*url).to_owned(),
        };
        let load = |names: &[&str]| -> String {
            names.iter().map(|e| format!("LOAD {};\n", literal(&extensions.join(format!("{e}.duckdb_extension")).to_string_lossy()))).collect()
        };
        // What the server runs before it serves: the scope attached
        // read-only, its catalog checked for a migration's changes, the
        // token it answers to, and then nothing outside: no file, no other
        // attach, no extension, no setting changed.
        let serve = format!(
            "{load}ATTACH {attach} AS scope (TYPE postgres, READ_ONLY);\n\
             SET pg_staleness_query_enabled = true;\n\
             CREATE SECRET shell (TYPE quack, TOKEN {token}, SCOPE {url});\n\
             SET enable_external_access = false;\n\
             SET lock_configuration = true;\n",
            load = load(&EXTENSIONS),
            attach = literal(&attach),
            token = literal(secret.trim()),
            url = literal(&self.url()),
        );
        let client = format!(
            "{load}ATTACH {url} AS shell (TYPE quack, TOKEN {token});\nCONNECT shell;\n",
            load = load(&EXTENSIONS[..2]),
            url = literal(&self.url()),
            token = literal(secret.trim()),
        );
        secret_file(&self.dir.join("serve.sql"), &serve)?;
        secret_file(&self.dir.join("client.sql"), &client)?;
        // The server reads its stdin until it ends: a fifo it holds open
        // for writing too never does, so it serves until stopped.
        let fifo = self.dir.join("stdin");
        if !fifo.exists() {
            Steps::read(Command::new("mkfifo").arg("-m").arg("600").arg(&fifo))?;
        }
        let stdin = OpenOptions::new().read(true).write(true).open(&fifo).map_err(io(&fifo))?;
        let log_path = self.dir.join("log");
        let log = OpenOptions::new().create(true).append(true).mode(0o600).open(&log_path).map_err(io(&log_path))?;
        let mut cmd = self.repo.cmd("duckdb");
        cmd.args(["-no-agent", "-no-init", "-cmd"])
            .arg(format!(".read {}", self.dir.join("serve.sql").display()))
            .args(["-serve", "quack:shell"])
            .stdin(stdin)
            .stdout(log.try_clone().map_err(io(&log_path))?)
            .stderr(log)
            .process_group(0);
        let mut child = cmd.spawn().map_err(|e| Fail::new(format!("duckdb: {e}; run cella inside `nix develop`")))?;
        fs::write(self.dir.join("pid"), child.id().to_string()).map_err(io(&self.dir))?;
        let start = Instant::now();
        loop {
            if let Ok(Some(status)) = child.try_wait() {
                let said = fs::read_to_string(&log_path).unwrap_or_default();
                let tail: Vec<&str> = said.lines().rev().take(12).collect();
                return Err(Fail::new(format!("the analytics shell exited ({status}):\n{}", tail.into_iter().rev().collect::<Vec<_>>().join("\n"))));
            }
            if let Some(role) = self.ask("SELECT * FROM postgres_query('scope', 'SELECT current_user::text AS role')") {
                if role != "cella_analytics" {
                    self.stop()?;
                    return Err(Fail::new(format!("the analytics shell logs in as {role}: it reads only as cella_analytics")));
                }
                break;
            }
            if start.elapsed() > READY {
                self.stop()?;
                return Err(Fail::new(format!("the analytics shell did not answer within {}s; see {}", READY.as_secs(), log_path.display())));
            }
            thread::sleep(Duration::from_millis(250));
        }
        let on = match target {
            Target::Dev(db) => format!("database {db}"),
            Target::Url(_) => "the database --url names".to_owned(),
        };
        println!("analytics shell on {}, {on} as cella_analytics, read-only", self.url());
        Ok(())
    }

    /// One value the shell answers, or none while it does not.
    fn ask(&self, sql: &str) -> Option<String> {
        let out = self.client(&["-csv", "-noheader"]).arg("-c").arg(sql).stdin(Stdio::null()).output().ok()?;
        out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_owned())
    }

    /// The DuckDB CLI as the shell's client, connected to it.
    fn client(&self, mode: &[&str]) -> Command {
        let mut cmd = self.repo.cmd("duckdb");
        cmd.args(["-no-agent", "-no-init"])
            .args(mode)
            .arg("-cmd")
            .arg(format!(".read {}", self.dir.join("client.sql").display()));
        cmd
    }

    pub fn stop(&self) -> Result {
        let Some(pid) = self.pid() else {
            println!("analytics shell stopped already");
            return Ok(());
        };
        let alive = || Path::new("/proc").join(pid.to_string()).exists();
        Steps::read(Command::new("kill").arg("-TERM").arg(pid.to_string()))?;
        let start = Instant::now();
        while alive() && start.elapsed() < Duration::from_secs(10) {
            thread::sleep(Duration::from_millis(100));
        }
        if alive() {
            Steps::read(Command::new("kill").arg("-KILL").arg(pid.to_string()))?;
        }
        let _ = fs::remove_file(self.dir.join("pid"));
        println!("analytics shell on {} stopped", self.url());
        Ok(())
    }
}

pub fn run(repo: &Repo, command: Analytics) -> Result {
    match command {
        Analytics::Start { db, url, port } => {
            let shell = Shell::new(repo, port);
            match url.as_deref() {
                Some(url) => shell.start(&Target::Url(url)),
                None => {
                    let dev = Dev::new(repo);
                    dev.up()?;
                    shell.start(&Target::Dev(db.as_deref().unwrap_or(&dev.db)))
                }
            }
        }
        Analytics::Stop { port } => Shell::new(repo, port).stop(),
        Analytics::Status { port } => {
            let shell = Shell::new(repo, port);
            if let Some(pid) = shell.pid() {
                println!("running on {} (pid {pid})", shell.url());
                return Ok(());
            }
            println!("stopped");
            Err(Fail { code: 3, msg: None })
        }
        Analytics::Query { sql, report, json, port } => {
            let shell = Shell::new(repo, port);
            if !shell.running() {
                return Err(Fail::new("the analytics shell is stopped; run `cella analytics start`"));
            }
            if let Some(file) = report {
                let mut node = repo.node("report.mjs");
                node.arg(file);
                shell.env(&mut node);
                return Steps::exec(&mut node);
            }
            let sql = sql.ok_or_else(|| Fail::new("give the SQL to run, or --report FILE"))?;
            Steps::exec(shell.client(&[if json { "-json" } else { "-box" }]).arg("-c").arg(sql))
        }
    }
}

/// The directory DuckDB's extensions are in, for this DuckDB's version and
/// platform: the one under `CELLA_DUCKDB_EXTENSIONS` that holds them.
fn extensions() -> Result<PathBuf> {
    let root = env::var("CELLA_DUCKDB_EXTENSIONS").map_err(|_| Fail::new("CELLA_DUCKDB_EXTENSIONS is unset; run cella inside `nix develop`"))?;
    let versions = fs::read_dir(&root).map_err(|e| Fail::new(format!("{root}: {e}")))?;
    versions
        .flatten()
        .filter_map(|v| fs::read_dir(v.path()).ok())
        .flatten()
        .flatten()
        .map(|p| p.path())
        .find(|p| EXTENSIONS.iter().all(|e| p.join(format!("{e}.duckdb_extension")).is_file()))
        .ok_or_else(|| Fail::new(format!("{root} holds no {}", EXTENSIONS.join(", "))))
}

/// A SQL string literal.
fn literal(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

/// Writes a file only its owner reads, as one holding the token.
fn secret_file(path: &Path, text: &str) -> Result {
    let mut file = OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(path).map_err(io(path))?;
    file.write_all(text.as_bytes()).map_err(io(path))
}

fn io(path: &Path) -> impl Fn(std::io::Error) -> Fail + '_ {
    move |e| Fail::new(format!("{}: {e}", path.display()))
}
