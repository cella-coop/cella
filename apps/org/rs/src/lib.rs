//! `cella`, the org app's root: the one entry point for development and
//! production. It orchestrates the tools where their logic lives — cargo,
//! cargo-pgrx, the Postgres binaries, pnpm and the node tools in `tools/` —
//! as subprocesses from the workspace root, one line per step.

mod check;
pub mod cli;
mod data;
mod db;
mod key;
mod repo;
pub mod run;
mod shell;
mod test;

use cli::{Command, Ext, Key, Log, Vault};
use repo::Repo;
use run::{Result, Steps};

pub fn dispatch(command: Command, verbose: bool) -> Result {
    let steps = Steps { verbose };
    match command {
        Command::Key { command: Key::Init { path } } => key::create(&path),
        Command::Check { part, no_sql } => check::run(&Repo::find()?, &steps, part, no_sql),
        Command::Db { command } => db::run(&Repo::find()?, &steps, command),
        Command::Ext { command: Ext::Build } => db::ext_build(&Repo::find()?, &steps).map(|_| ()),
        Command::Migrate { url } => data::migrate(&Repo::find()?, &steps, url.as_deref()),
        Command::Seed { fixture, url } => data::seed(&Repo::find()?, &steps, &fixture, url.as_deref()),
        Command::Import { kind, file, actor, dry_run, url } => {
            data::import(&Repo::find()?, &steps, &data::Import { kind: &kind, file: &file, actor: &actor, dry: dry_run }, url.as_deref())
        }
        Command::Serve { port, prod, url } => shell::serve(&Repo::find()?, &steps, port, prod, url.as_deref()),
        Command::Build => shell::build(&Repo::find()?, &steps),
        Command::Test { only } => test::run(&Repo::find()?, &steps, only),
        Command::Log { command: Log::Verify { url } } => data::verify(&Repo::find()?, url.as_deref()),
        Command::Vault { command: Vault::Sweep { url } } => data::sweep(&Repo::find()?, url.as_deref()),
    }
}
