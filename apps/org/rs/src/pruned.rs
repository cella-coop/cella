//! The org app of core alone: every slice above core pruned from the tree
//! and from the shell's composition root (`tools/prune.mjs`), so that a
//! core package or the shell depending on one fails to build, migrate or
//! sign in (architecture.md, "Removing a feat").

use crate::db::Dev;
use crate::repo::Repo;
use crate::run::{Result, Steps, last_line, quiet};

/// The database the pruned tree migrates, on the dev cluster, fresh each
/// time and dropped after.
const DB: &str = "cella_pruned";

/// Prunes the tree into `.data/pruned` and builds it as `cella build`
/// builds the whole: the install, svelte-check over the shell and the
/// production build. No database.
pub fn build(repo: &Repo, steps: &Steps) -> Result<Repo> {
    let tree = repo.data().join("pruned");
    let mut prune = repo.node("prune.mjs");
    prune.arg(&repo.root).arg(&tree);
    steps.run("pruned tree", &mut [prune], last_line)?;
    let pruned = Repo { root: tree };
    // The lockfile still names the pruned packages, which the install drops.
    let mut install = pruned.cmd("pnpm");
    install.args(["install", "--offline", "--silent", "--no-frozen-lockfile"]);
    let mut sync = pruned.shell("svelte-kit");
    sync.arg("sync");
    let mut check = pruned.shell("svelte-check");
    check.args([
        "--tsconfig",
        "./tsconfig.json",
        "--fail-on-warnings",
        "--output",
        "machine",
    ]);
    steps.run("pruned shell", &mut [install, sync, check], last_line)?;
    let mut vite = pruned.shell("vite");
    vite.arg("build");
    steps.run("pruned build", &mut [vite], quiet)?;
    Ok(pruned)
}

/// Builds the pruned tree, migrates a fresh database with its migrate,
/// which finds core's SQL alone, then serves it and signs in
/// (`tools/pruned.mjs`); on the dev cluster.
pub fn serve(repo: &Repo, steps: &Steps) -> Result {
    let dev = Dev::new(repo);
    dev.up()?;
    repo.install(steps)?;
    let pruned = build(repo, steps)?;
    steps.run(
        "pruned db",
        &mut Dev::new(&pruned).renew(DB, None, None),
        quiet,
    )?;
    let mut sign_in = dev.on(DB, "node");
    sign_in
        .arg(repo.root.join("tools/pruned.mjs"))
        .arg(&pruned.root);
    let served = steps.run("pruned sign-in", &mut [sign_in], last_line);
    let mut drop = dev.on("postgres", "dropdb");
    drop.args(["--if-exists", "--force", DB]);
    steps.run("unprune db", &mut [drop], quiet)?;
    served
}
