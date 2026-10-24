use std::fs;
use std::path::{Path, PathBuf};

use crate::cli::Test;
use crate::db::Dev;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, quiet};

/// The database each slice runs on, fresh each time.
const DB: &str = "cella_test";

pub fn run(repo: &Repo, steps: &Steps, only: Option<Test>) -> Result {
    match only {
        None => {
            rust(repo, steps, "rules", "cella-rules")?;
            rust(repo, steps, "cli", "cella-cli")?;
            slices(repo, steps, None)
        }
        Some(Test::Rules) => rust(repo, steps, "rules", "cella-rules"),
        Some(Test::Cli) => rust(repo, steps, "cli", "cella-cli"),
        Some(Test::Slice { name }) => slices(repo, steps, name.as_deref()),
    }
}

fn rust(repo: &Repo, steps: &Steps, name: &str, package: &str) -> Result {
    let mut cmd = repo.cmd("cargo");
    cmd.args(["test", "--quiet", "-p", package]);
    steps.run(name, &mut [cmd], passed)
}

/// Each slice's test file on a database reset, migrated and seeded with
/// Lanterne, through the handlers on the dev cluster.
fn slices(repo: &Repo, steps: &Steps, only: Option<&str>) -> Result {
    let dev = Dev::new(repo);
    dev.up()?;
    let mut files = Vec::new();
    find(&repo.root.join("apps"), &mut files);
    files.sort();
    let named: Vec<(String, PathBuf)> = files.into_iter().map(|f| (slice(&f), f)).collect();
    let chosen: Vec<&(String, PathBuf)> = named.iter().filter(|(n, _)| only.is_none_or(|o| o == n)).collect();
    if chosen.is_empty() {
        let known: Vec<&str> = named.iter().map(|(n, _)| n.as_str()).collect();
        return Err(Fail::new(format!("no slice {}; there are: {}", only.unwrap_or(""), known.join(", "))));
    }
    repo.install(steps)?;
    for (name, file) in chosen {
        let [drop, create] = dev.fresh(DB);
        let mut migrate = dev.on(DB, "node");
        migrate.arg(repo.root.join("tools/migrate.mjs"));
        let mut seed = dev.on(DB, "node");
        seed.arg(repo.root.join("tools/seed.mjs")).arg(repo.root.join("apps/org/fixtures/lanterne"));
        steps.run(&format!("fresh {name}"), &mut [drop, create, migrate, seed], quiet)?;
        let mut test = dev.on(DB, "node");
        test.arg("--test");
        if !steps.verbose {
            test.arg("--test-reporter=tap");
        }
        test.arg(file);
        steps.run(&format!("slice {name}"), &mut [test], tap)?;
    }
    Ok(())
}

fn find(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if entry.file_name() == "node_modules" {
            continue;
        }
        if path.is_dir() {
            find(&path, out);
        } else if is_slice(&path) {
            out.push(path);
        }
    }
}

fn is_slice(path: &Path) -> bool {
    let in_tests = path.parent().and_then(Path::file_name).is_some_and(|d| d == "_tests");
    in_tests && path.to_string_lossy().ends_with(".test.ts")
}

fn slice(path: &Path) -> String {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    name.trim_end_matches(".test.ts").to_owned()
}

/// The tests cargo ran, summed over its test binaries.
fn passed(out: &str) -> Option<String> {
    let counts: Vec<u64> = out
        .lines()
        .filter_map(|l| l.strip_prefix("test result: ok. "))
        .filter_map(|l| l.split_whitespace().next()?.parse().ok())
        .collect();
    if counts.is_empty() {
        return None;
    }
    Some(format!("{} passed", counts.iter().sum::<u64>()))
}

fn tap(out: &str) -> Option<String> {
    out.lines().find_map(|l| l.strip_prefix("# pass ")).map(|n| format!("{n} passed"))
}
