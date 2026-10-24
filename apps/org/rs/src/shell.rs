use crate::data;
use crate::db::Dev;
use crate::repo::Repo;
use crate::run::{Result, Steps, last_line, quiet};

/// The shell's dev server against the dev database: starts the cluster if
/// it is stopped, applies any new migration, then runs Vite in dev mode,
/// where the server may sign as a fixture member. It runs until stopped.
pub fn serve(repo: &Repo, steps: &Steps, port: u16) -> Result {
    let dev = Dev::new(repo);
    if !dev.running()? {
        dev.start(steps)?;
    }
    data::migrate(repo, steps, None)?;
    let mut scope = dev.cmd("psql");
    scope.args(["-X", "-q", "-t", "-A", "-c", "SELECT current_setting('cella.scope', true)"]);
    if Steps::read(&mut scope)?.is_empty() {
        println!("the dev database names no scope: seed it with `cella db reset --seed lanterne`");
    }
    let mut sync = repo.shell("svelte-kit");
    sync.arg("sync");
    steps.run("sync", &mut [sync], quiet)?;
    println!("shell on http://localhost:{port}, dev mode, database {}", dev.db);
    let mut vite = dev.cmd("pnpm");
    vite.current_dir(repo.shell_dir())
        .args(["exec", "vite", "dev", "--strictPort", "--port"])
        .arg(port.to_string())
        .env("CELLA_DEV", "1");
    Steps::exec(&mut vite)
}

/// The shell built for production by adapter-node into `apps/org/ts/build`,
/// a Node server that is not in dev mode and so signs for no one.
pub fn build(repo: &Repo, steps: &Steps) -> Result {
    repo.install(steps)?;
    let mut vite = repo.shell("vite");
    vite.arg("build");
    steps.run("build", &mut [vite], last_line)?;
    println!("built {}", repo.shell_dir().join("build").display());
    Ok(())
}
