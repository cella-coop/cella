use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::db::Dev;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, last_line};

/// A command for a database: the dev cluster's by the PG* variables, or
/// any by URL through `DATABASE_URL`, which the node tools read.
pub fn on(dev: &Dev, url: Option<&str>, program: &str) -> Result<Command> {
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

/// Runs `cella.vault_rewrap()` as the cluster's superuser: every vault key
/// sealed under the current vault key file, those still under the previous
/// one moved; then the previous file may go.
pub fn rewrap(repo: &Repo, url: Option<&str>) -> Result {
    let mut cmd = on(&Dev::new(repo), url, "psql")?;
    if let Some(url) = url {
        cmd.args(["-d", url]);
    }
    cmd.args(["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c"])
        .arg("SELECT cella.vault_rewrap(), (SELECT count(*) FROM vault.key)");
    let out = Steps::read(&mut cmd)?;
    let (moved, all) = out.trim().split_once('|').unwrap_or((out.trim(), "?"));
    println!(
        "rewrapped: {moved} of {all} vault keys moved to cella.vault_key_file; the previous file now seals none"
    );
    Ok(())
}

/// A mock co-op's directory under `apps/org/fixtures`, by its name.
pub fn fixture(repo: &Repo, name: &str) -> Result<PathBuf> {
    let fixtures = repo.root.join("apps/org/fixtures");
    let dir = fixtures.join(name);
    if name.contains('/') || !dir.is_dir() {
        let known: Vec<String> = fs::read_dir(&fixtures)
            .map(|d| {
                d.flatten()
                    .map(|e| e.file_name().to_string_lossy().into_owned())
                    .collect()
            })
            .unwrap_or_default();
        return Err(Fail::new(format!(
            "no fixture {name}; there are: {}",
            known.join(", ")
        )));
    }
    Ok(dir)
}

pub fn seed(
    repo: &Repo,
    steps: &Steps,
    fixture: &str,
    url: Option<&str>,
    scenarios: &[String],
) -> Result {
    if scenarios.len() > 1 {
        return Err(Fail::new(
            "seed one story at a time; run cella db reset before seeding another",
        ));
    }
    let dir = self::fixture(repo, fixture)?;
    repo.install(steps)?;
    let mut cmd = on(&Dev::new(repo), url, "node")?;
    cmd.arg(repo.root.join("tools/seed.mjs")).arg(dir);
    if let Some(name) = scenarios.first() {
        cmd.arg("--scenario").arg(name);
    }
    steps.run(&format!("seed {fixture}"), &mut [cmd], last_line)
}

/// Runs `cella.vault_sweep()` as the cluster's superuser, on the verdict
/// date: erases what the law kept once its clock has run out, and says
/// what for each subject and class.
pub fn sweep(repo: &Repo, url: Option<&str>) -> Result {
    let mut cmd = on(&Dev::new(repo), url, "psql")?;
    if let Some(url) = url {
        cmd.args(["-d", url]);
    }
    cmd.args([
        "-X",
        "-q",
        "-t",
        "-A",
        "-F",
        " ",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
    ])
    .arg("SELECT subject, class, keys, redacted FROM cella.vault_sweep()");
    let out = Steps::read(&mut cmd)?;
    let lines: Vec<&str> = out.lines().filter(|l| !l.trim().is_empty()).collect();
    for line in &lines {
        let f: Vec<&str> = line.split(' ').collect();
        if let [subject, class, keys, redacted] = f[..] {
            let done = if redacted == "t" {
                ", redacted"
            } else {
                ", restricted still"
            };
            println!("{subject} {class}: {keys} keys destroyed{done}");
        }
    }
    println!("swept: {} subject classes past their clock", lines.len());
    Ok(())
}

/// Runs `cella.verify_log()`; a broken log fails, with the notary's
/// warnings saying where it breaks.
pub fn verify(repo: &Repo, url: Option<&str>) -> Result {
    let mut cmd = on(&Dev::new(repo), url, "psql")?;
    if let Some(url) = url {
        cmd.args(["-d", url]);
    }
    cmd.args([
        "-X",
        "-q",
        "-t",
        "-A",
        "-F",
        " ",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
    ])
    .arg(
        "SELECT cella.verify_log(), (SELECT n FROM cella.head), encode(cella.notary_key(), 'hex')",
    );
    let out = Steps::read(&mut cmd)?;
    let mut fields = out.split_whitespace();
    let (Some(verified), Some(head), Some(public)) = (fields.next(), fields.next(), fields.next())
    else {
        return Err(Fail::new(format!(
            "unexpected answer from cella.verify_log(): {out}"
        )));
    };
    if verified != "t" {
        return Err(Fail::new(format!(
            "the log does not verify; its head is at {head}"
        )));
    }
    println!("log verifies: {head} entries, signed by {public}");
    Ok(())
}

/// A file from another tool to import, as whom, and whether only as a dry
/// run.
pub struct Import<'a> {
    pub kind: &'a str,
    pub file: &'a Path,
    pub actor: &'a str,
    pub dry: bool,
}

/// Imports a file from another tool as a member (`tools/import.mjs`): each
/// record a signed write, or in a dry run every write made and undone;
/// prints what each line came to and records the run.
pub fn import(repo: &Repo, steps: &Steps, import: &Import<'_>, url: Option<&str>) -> Result {
    let file = std::path::absolute(import.file)
        .map_err(|e| Fail::new(format!("{}: {e}", import.file.display())))?;
    if !file.is_file() {
        return Err(Fail::new(format!("no file {}", file.display())));
    }
    repo.install(steps)?;
    let mut cmd = on(&Dev::new(repo), url, "node")?;
    cmd.arg(repo.root.join("tools/import.mjs"))
        .arg(import.kind)
        .arg(&file)
        .arg(import.actor);
    if import.dry {
        cmd.arg("--dry-run");
    }
    Steps::exec(&mut cmd)
}
