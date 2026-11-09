//! `cella`, the org app's root: the one entry point for development and
//! production. It orchestrates the tools where their logic lives — cargo,
//! cargo-pgrx, the Postgres binaries, pnpm and the node tools in `tools/` —
//! as subprocesses from the workspace root, one line per step.

mod analytics;
mod backup;
mod check;
pub mod cli;
mod data;
mod db;
pub mod fold;
mod key;
mod pruned;
mod repo;
pub mod run;
mod scaffold;
mod secret;
mod shell;
mod site;
mod test;

use cli::{Command, Ext, Key, Log, Vault};
use repo::Repo;
use run::{Result, Steps};

pub fn dispatch(command: Command, verbose: bool) -> Result {
    let steps = Steps { verbose };
    match command {
        Command::Key {
            command: Key::Init { path, vault: false },
        } => key::create(&path),
        Command::Key {
            command: Key::Init { path, vault: true },
        } => key::vault(&path),
        Command::Check { part, no_sql } => check::run(&Repo::find()?, &steps, part, no_sql),
        Command::Db { command } => db::run(&Repo::find()?, &steps, command),
        Command::Analytics { command } => analytics::run(&Repo::find()?, command),
        Command::Ext {
            command: Ext::Build,
        } => db::ext_build(&Repo::find()?, &steps).map(|_| ()),
        Command::Migrate { url } => data::migrate(&Repo::find()?, &steps, url.as_deref()),
        Command::Backup { dir, url } => backup::backup(&Repo::find()?, &dir, url.as_deref()),
        Command::Restore {
            dir,
            db,
            url,
            erasures,
        } => backup::restore(
            &Repo::find()?,
            &steps,
            &dir,
            db.as_deref(),
            url.as_deref(),
            erasures.as_deref(),
        ),
        Command::Seed {
            fixture,
            scenario,
            url,
        } => data::seed(&Repo::find()?, &steps, &fixture, url.as_deref(), &scenario),
        Command::Scaffold { part, feat } => scaffold::run(&Repo::find()?, &steps, part, &feat),
        Command::Import {
            kind,
            file,
            actor,
            dry_run,
            url,
        } => data::import(
            &Repo::find()?,
            &steps,
            &data::Import {
                kind: &kind,
                file: &file,
                actor: &actor,
                dry: dry_run,
            },
            url.as_deref(),
        ),
        Command::Serve { port, prod, url } => {
            shell::serve(&Repo::find()?, &steps, port, prod, url.as_deref())
        }
        Command::Build => shell::build(&Repo::find()?, &steps),
        Command::Preview { command } => shell::preview(&Repo::find()?, &steps, command),
        Command::Brand => check::brand(&Repo::find()?, &steps),
        Command::Site { command } => site::run(&Repo::find()?, &steps, command),
        Command::Test { only } => test::run(&Repo::find()?, &steps, only),
        Command::Fold {
            db,
            into,
            to,
            from,
            every,
            compare,
        } => fold::fold(
            &Repo::find()?,
            &steps,
            &fold::Fold {
                source: &db,
                into: &into,
                to,
                from,
                every,
                compare,
            },
        ),
        Command::Log {
            command: Log::Verify { url },
        } => data::verify(&Repo::find()?, url.as_deref()),
        Command::Vault {
            command: Vault::Sweep { url },
        } => data::sweep(&Repo::find()?, url.as_deref()),
        Command::Vault {
            command: Vault::Rewrap { url },
        } => data::rewrap(&Repo::find()?, url.as_deref()),
    }
}
