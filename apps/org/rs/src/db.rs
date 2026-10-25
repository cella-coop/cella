use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::cli::Db;
use crate::data;
use crate::key;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, last_line, quiet};

/// The dev cluster: Postgres 18 in .data/pg, owned by the user, on
/// 127.0.0.1 at `CELLA_PGPORT` (54342), its database `CELLA_DB` (cella).
pub struct Dev<'a> {
    pub repo: &'a Repo,
    pub port: String,
    pub db: String,
}

impl<'a> Dev<'a> {
    pub fn new(repo: &'a Repo) -> Self {
        Self {
            repo,
            port: env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()),
            db: env::var("CELLA_DB").unwrap_or_else(|_| "cella".into()),
        }
    }

    fn pg(&self) -> PathBuf {
        self.repo.data().join("pg")
    }

    /// A command connecting to a database on the cluster by the PG* variables.
    pub fn on(&self, db: &str, program: &str) -> Command {
        let mut cmd = self.repo.cmd(program);
        cmd.env("PGHOST", "127.0.0.1")
            .env("PGPORT", &self.port)
            .env("PGUSER", "postgres")
            .env("PGDATABASE", db)
            .env_remove("DATABASE_URL");
        cmd
    }

    pub fn cmd(&self, program: &str) -> Command {
        self.on(&self.db, program)
    }

    pub fn running(&self) -> Result<bool> {
        let mut cmd = self.repo.cmd("pg_ctl");
        cmd.arg("-D").arg(self.pg()).arg("status");
        Steps::ok(&mut cmd)
    }

    /// Fails unless the cluster runs, saying how to start it.
    pub fn up(&self) -> Result {
        if self.running()? {
            return Ok(());
        }
        Err(Fail::new("the dev cluster is stopped; run `cella db start`"))
    }

    /// Drops a database if it exists, creates it and migrates it: the whole
    /// tree, or one slice's part of it, unbound; then seeds it from a
    /// fixture's directory, if one is given. Never an unmigrated database.
    pub fn renew(&self, db: &str, slice: Option<&str>, fixture: Option<&Path>) -> Vec<Command> {
        let mut drop = self.on(db, "dropdb");
        drop.args(["--if-exists", "--force", db]);
        let mut create = self.on(db, "createdb");
        create.arg(db);
        let mut migrate = self.on(db, "node");
        migrate.arg(self.repo.root.join("tools/migrate.mjs"));
        if let Some(slice) = slice {
            migrate.args(["--slice", slice]);
        }
        let mut cmds = vec![drop, create, migrate];
        if slice.is_some() {
            // A slice's tests test its SQL below the notary, writing its
            // rows as they need them, so its database is unbound.
            let mut unbind = self.on(db, "psql");
            unbind.args(["-qc", &format!("ALTER DATABASE {db} SET cella.unbound = on")]);
            cmds.push(unbind);
        }
        if let Some(dir) = fixture {
            let mut seed = self.on(db, "node");
            seed.arg(self.repo.root.join("tools/seed.mjs")).arg(dir);
            cmds.push(seed);
        }
        cmds
    }

    pub fn start(&self, steps: &Steps) -> Result {
        let dir = ext_build(self.repo, steps)?;
        let pg = self.pg();
        let data = self.repo.data();
        if !pg.exists() {
            let mut initdb = self.repo.cmd("initdb");
            initdb.arg("-D").arg(&pg).args(["-U", "postgres", "--auth=trust"]);
            steps.run("initdb", &mut [initdb], quiet)?;
            let mut conf = OpenOptions::new().append(true).open(pg.join("postgresql.conf")).map_err(io(&pg))?;
            writeln!(conf, "include_if_exists = 'cella.conf'").map_err(io(&pg))?;
        }
        let key = data.join("notary.key");
        if !key.exists() {
            key::create(&key)?;
        }
        let vault = data.join("vault.key");
        if !vault.exists() {
            key::vault(&vault)?;
        }
        // Rewritten each time: the paths follow the Nix store. Postgres 18
        // loads the extension from outside the read-only store.
        let config = pg_config();
        let share = staged(&dir, &Steps::read(Command::new(&config).arg("--sharedir"))?);
        let lib = staged(&dir, &Steps::read(Command::new(&config).arg("--pkglibdir"))?);
        let conf = format!(
            "port = {port}\n\
             listen_addresses = '127.0.0.1'\n\
             unix_socket_directories = '{data}'\n\
             extension_control_path = '$system:{share}'\n\
             dynamic_library_path = '$libdir:{lib}'\n\
             shared_preload_libraries = 'cella'\n\
             cella.key_file = '{key}'\n\
             cella.vault_key_file = '{vault}'\n",
            port = self.port,
            data = data.display(),
            share = share.display(),
            lib = lib.display(),
            key = key.display(),
            vault = vault.display(),
        );
        fs::write(pg.join("cella.conf"), conf).map_err(io(&pg))?;
        let verb = if self.running()? { "restart" } else { "start" };
        let mut ctl = self.repo.cmd("pg_ctl");
        ctl.arg("-D").arg(&pg).arg("-l").arg(data.join("pg.log")).args(["-w", verb]);
        steps.run(verb, &mut [ctl], quiet)?;
        let mut exists = self.on("postgres", "psql");
        exists.args(["-X", "-q", "-t", "-A", "-c"]).arg(format!(
            "SELECT 1 FROM pg_database WHERE datname = '{}'",
            self.db.replace('\'', "''")
        ));
        if Steps::read(&mut exists)? != "1" {
            let mut create = self.cmd("createdb");
            create.arg(&self.db);
            steps.run("createdb", &mut [create], quiet)?;
        }
        println!("postgres 18 on 127.0.0.1:{}, database {}", self.port, self.db);
        Ok(())
    }
}

pub fn run(repo: &Repo, steps: &Steps, command: Db) -> Result {
    let dev = Dev::new(repo);
    match command {
        Db::Start => dev.start(steps),
        Db::Stop => {
            if !dev.running()? {
                println!("stopped already");
                return Ok(());
            }
            let mut ctl = repo.cmd("pg_ctl");
            ctl.arg("-D").arg(dev.pg()).args(["-m", "fast", "stop"]);
            steps.run("stop", &mut [ctl], quiet)
        }
        Db::Status => {
            if dev.running()? {
                println!("running on 127.0.0.1:{}, database {}", dev.port, dev.db);
                return Ok(());
            }
            println!("stopped");
            Err(Fail { code: 3, msg: None })
        }
        Db::Reset { db, seed } => {
            dev.up()?;
            let fixture = seed.as_deref().map(|f| data::fixture(repo, f)).transpose()?;
            repo.install(steps)?;
            let db = db.unwrap_or_else(|| dev.db.clone());
            steps.run(&format!("reset {db}"), &mut dev.renew(&db, None, fixture.as_deref()), last_line)
        }
        Db::Psql { args } => {
            dev.up()?;
            Steps::exec(dev.cmd("psql").args(args))
        }
    }
}

/// Packages the extension into .data/ext, returning that directory, with
/// every script in the notary's `rs/sql/` beside the generated one: pgrx
/// stages the upgrade scripts alone, and an earlier version's install
/// script is what a rehearsal installs it at. The directory is emptied
/// first, so nothing an earlier build staged stays.
pub fn ext_build(repo: &Repo, steps: &Steps) -> Result<PathBuf> {
    let dir = repo.data().join("ext");
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(io(&dir))?;
    }
    let mut cmd = repo.cmd("cargo");
    cmd.args(["pgrx", "package", "-p", "cella", "--debug", "--pg-config"])
        .arg(pg_config())
        .arg("--out-dir")
        .arg(&dir);
    steps.run("ext", &mut [cmd], quiet)?;
    let share = staged(&dir, &Steps::read(Command::new(pg_config()).arg("--sharedir"))?).join("extension");
    let scripts = repo.root.join("apps/org/core/notary/rs/sql");
    for script in fs::read_dir(&scripts).map_err(io(&scripts))? {
        let from = script.map_err(io(&scripts))?.path();
        if let Some(name) = from.file_name() {
            fs::copy(&from, share.join(name)).map_err(io(&from))?;
        }
    }
    Ok(dir)
}

/// The `pg_config` pgrx builds against: the devshell's, else the one on PATH.
pub fn pg_config() -> String {
    env::var("PGRX_PG_CONFIG_PATH").unwrap_or_else(|_| "pg_config".into())
}

/// Where `cargo pgrx package` stages an installation path under its out dir.
fn staged(dir: &Path, path: &str) -> PathBuf {
    dir.join(path.trim_start_matches('/'))
}

fn io(path: &Path) -> impl Fn(std::io::Error) -> Fail + '_ {
    move |e| Fail::new(format!("{}: {e}", path.display()))
}
