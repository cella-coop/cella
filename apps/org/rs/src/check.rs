use crate::cli::Part;
use crate::pruned;
use crate::repo::Repo;
use crate::run::{Result, Steps, last_line, quiet};
use crate::site;

/// What a commit must pass, or one part of it; no database. `org` is every
/// part but the site's, so the gates run the org's check and the site's
/// apart, each kept by what it reads.
pub fn run(repo: &Repo, steps: &Steps, part: Option<Part>, no_sql: bool) -> Result {
    let org = |site: bool| {
        let mut parts = vec![
            Part::Feats,
            Part::Fixtures,
            Part::Types,
            Part::Shell,
            Part::Pruned,
            Part::Brand,
            Part::Spelling,
        ];
        if site {
            parts.push(Part::Site);
        }
        parts.push(Part::Rust);
        parts
    };
    let parts = match part {
        None => org(true),
        Some(Part::Org) => org(false),
        Some(p) => vec![p],
    };
    if parts.iter().any(|p| !matches!(p, Part::Rust)) {
        repo.install(steps)?;
    }
    for part in parts {
        match part {
            Part::Feats => {
                let mut cmd = repo.node("feat-check.mjs");
                if no_sql {
                    cmd.arg("--no-sql");
                }
                cmd.arg(&repo.root);
                steps.run("feats", &mut [cmd], last_line)?;
            }
            Part::Fixtures => {
                let mut cmd = repo.node("fixture-check.mjs");
                cmd.arg(&repo.root);
                steps.run("fixtures", &mut [cmd], last_line)?;
            }
            Part::Types => {
                let mut cmd = repo.cmd("tsc");
                cmd.args(["-p", "."]);
                steps.run("types", &mut [cmd], quiet)?;
            }
            Part::Shell => {
                // svelte-check reads the shell's tsconfig, which takes in every
                // slice's client layers; sync first writes the tsconfig it extends.
                let mut sync = repo.shell("svelte-kit");
                sync.arg("sync");
                let mut check = repo.shell("svelte-check");
                check.args([
                    "--tsconfig",
                    "./tsconfig.json",
                    "--fail-on-warnings",
                    "--output",
                    "machine",
                ]);
                steps.run("shell", &mut [sync, check], last_line)?;
            }
            Part::Pruned => {
                pruned::build(repo, steps)?;
            }
            Part::Brand => {
                let mut cmd = repo.node("brand.mjs");
                cmd.arg("--check").arg(&repo.root);
                steps.run("brand", &mut [cmd], last_line)?;
            }
            Part::Spelling => {
                let mut cmd = repo.node("spelling.mjs");
                cmd.arg(&repo.root);
                steps.run("spelling", &mut [cmd], last_line)?;
            }
            Part::Site => site::check(repo, steps)?,
            Part::Org => unreachable!("org is its parts, listed above"),
            Part::Rust => {
                let mut check = repo.cmd("cargo");
                check.args(["check", "--workspace", "--quiet"]);
                steps.run("cargo check", &mut [check], quiet)?;
                let mut clippy = repo.cmd("cargo");
                clippy.args([
                    "clippy",
                    "--workspace",
                    "--no-deps",
                    "--quiet",
                    "--",
                    "-D",
                    "warnings",
                    "-A",
                    "clippy::pedantic",
                ]);
                steps.run("clippy", &mut [clippy], quiet)?;
            }
        }
    }
    Ok(())
}

/// Writes the brand's generated files from its house.json.
pub fn brand(repo: &Repo, steps: &Steps) -> Result {
    repo.install(steps)?;
    let mut cmd = repo.node("brand.mjs");
    cmd.arg(&repo.root);
    steps.run("brand", &mut [cmd], last_line)
}
