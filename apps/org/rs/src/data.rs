use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::db::Dev;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, last_line};

/// A command for a database: the dev cluster's by the PG* variables, or
/// any by URL through `DATABASE_URL`, which the node tools read.
fn on(dev: &Dev, url: Option<&str>, program: &str) -> Result<Command> {
    let Some(url) = url else {
        dev.up()?;
        return Ok(dev.cmd(program));
    };
    let mut cmd = dev.repo.cmd(program);
    cmd.env("DATABASE_URL", url);
    Ok(cmd)
}

pub fn migrate(repo: &Repo, steps: &Steps, url: Option<&str>) -> Result {
    repo.install(steps)?;
    let mut cmd = on(&Dev::new(repo), url, "node")?;
    cmd.arg(repo.root.join("tools/migrate.mjs"));
    steps.run("migrate", &mut [cmd], last_line)
}

/// A mock co-op's directory under `apps/org/fixtures`, by its name.
pub fn fixture(repo: &Repo, name: &str) -> Result<PathBuf> {
    let fixtures = repo.root.join("apps/org/fixtures");
    let dir = fixtures.join(name);
    if name.contains('/') || !dir.is_dir() {
        let known: Vec<String> = fs::read_dir(&fixtures)
            .map(|d| d.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect())
            .unwrap_or_default();
        return Err(Fail::new(format!("no fixture {name}; there are: {}", known.join(", "))));
    }
    Ok(dir)
}

pub fn seed(repo: &Repo, steps: &Steps, fixture: &str, url: Option<&str>) -> Result {
    let dir = self::fixture(repo, fixture)?;
    repo.install(steps)?;
    let mut cmd = on(&Dev::new(repo), url, "node")?;
    cmd.arg(repo.root.join("tools/seed.mjs")).arg(dir);
    steps.run(&format!("seed {fixture}"), &mut [cmd], last_line)
}

/// Runs `cella.verify_log()`; a broken log fails, with the notary's
/// warnings saying where it breaks.
pub fn verify(repo: &Repo, url: Option<&str>) -> Result {
    let mut cmd = on(&Dev::new(repo), url, "psql")?;
    if let Some(url) = url {
        cmd.args(["-d", url]);
    }
    cmd.args(["-X", "-q", "-t", "-A", "-F", " ", "-v", "ON_ERROR_STOP=1", "-c"]).arg(
        "SELECT cella.verify_log(), (SELECT n FROM cella.head), encode(cella.notary_key(), 'hex')",
    );
    let out = Steps::read(&mut cmd)?;
    let mut fields = out.split_whitespace();
    let (Some(verified), Some(head), Some(public)) = (fields.next(), fields.next(), fields.next()) else {
        return Err(Fail::new(format!("unexpected answer from cella.verify_log(): {out}")));
    };
    if verified != "t" {
        return Err(Fail::new(format!("the log does not verify; its head is at {head}")));
    }
    println!("log verifies: {head} entries, signed by {public}");
    Ok(())
}
