use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::cli::Test;
use crate::db::Dev;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, quiet};

/// The database each slice test file and each e2e scenario runs on, fresh
/// each time.
const DB: &str = "cella_test";

pub fn run(repo: &Repo, steps: &Steps, only: Option<Test>) -> Result {
    match only {
        None => {
            rust(repo, steps, "rules", "cella-rules")?;
            rust(repo, steps, "cli", "cella-cli")?;
            tools(repo, steps)?;
            slices(repo, steps, None)?;
            e2e(repo, steps, None)
        }
        Some(Test::Rules) => rust(repo, steps, "rules", "cella-rules"),
        Some(Test::Cli) => rust(repo, steps, "cli", "cella-cli"),
        Some(Test::Tools) => tools(repo, steps),
        Some(Test::Slice { name }) => slices(repo, steps, name.as_deref()),
        Some(Test::E2e { name }) => e2e(repo, steps, name.as_deref()),
    }
}

fn rust(repo: &Repo, steps: &Steps, name: &str, package: &str) -> Result {
    let mut cmd = repo.cmd("cargo");
    cmd.args(["test", "--quiet", "-p", package]);
    steps.run(name, &mut [cmd], passed)
}

/// The node tools' own tests, `tools/_tests/*.test.mjs`; no database.
fn tools(repo: &Repo, steps: &Steps) -> Result {
    repo.install(steps)?;
    let mut test = repo.cmd("node");
    test.arg("--test");
    if !steps.verbose {
        test.arg("--test-reporter=tap");
    }
    test.arg(repo.root.join("tools/_tests/*.test.mjs"));
    steps.run("tools", &mut [test], tap)
}

/// What a test file is, by where it sits.
enum Kind {
    /// In a feat's or graft's package, under `_tests/`: it tests that one
    /// slice, named here, on a database holding only its part of the tree.
    Slice(String),
    /// In an app root's package, under `_e2e/`: a scenario across slices,
    /// on a database migrated whole and seeded with Lanterne.
    E2e,
}

/// Each slice's test files, slice by slice, each on a database migrated
/// with the app's core and that slice's part of the tree alone, unseeded.
fn slices(repo: &Repo, steps: &Steps, only: Option<&str>) -> Result {
    let mut found: Vec<(String, PathBuf)> = tests(repo)?
        .into_iter()
        .filter_map(|(kind, f)| match kind {
            Kind::Slice(s) => Some((s, f)),
            Kind::E2e => None,
        })
        .collect();
    found.sort();
    let mut names: Vec<&str> = found.iter().map(|(s, _)| s.as_str()).collect();
    names.dedup();
    let chosen: Vec<&str> = names.iter().copied().filter(|n| only.is_none_or(|o| o == *n)).collect();
    if chosen.is_empty() {
        return Err(Fail::new(format!("no slice tests for {}; slices with tests: {}", only.unwrap_or("any slice"), names.join(", "))));
    }
    let dev = Dev::new(repo);
    dev.up()?;
    repo.install(steps)?;
    for slice in chosen {
        steps.run(&format!("db slice/{slice}"), &mut dev.renew(DB, Some(slice), None), quiet)?;
        let files: Vec<&PathBuf> = found.iter().filter(|(s, _)| s == slice).map(|(_, f)| f).collect();
        steps.run(&format!("slice {slice}"), &mut [node_test(&dev, steps, &files)], tap)?;
    }
    Ok(())
}

/// Each e2e scenario's file on a database migrated whole and seeded with
/// Lanterne, through the handlers on the dev cluster.
fn e2e(repo: &Repo, steps: &Steps, only: Option<&str>) -> Result {
    let mut files: Vec<PathBuf> = tests(repo)?.into_iter().filter(|(k, _)| matches!(k, Kind::E2e)).map(|(_, f)| f).collect();
    files.sort();
    let named: Vec<(String, PathBuf)> = files.into_iter().map(|f| (stem(&f), f)).collect();
    let chosen: Vec<&(String, PathBuf)> = named.iter().filter(|(n, _)| only.is_none_or(|o| o == n)).collect();
    if chosen.is_empty() {
        let known: Vec<&str> = named.iter().map(|(n, _)| n.as_str()).collect();
        return Err(Fail::new(format!("no e2e scenario {}; there are: {}", only.unwrap_or(""), known.join(", "))));
    }
    let dev = Dev::new(repo);
    dev.up()?;
    repo.install(steps)?;
    let lanterne = repo.root.join("apps/org/fixtures/lanterne");
    for (name, file) in chosen {
        steps.run(&format!("db e2e/{name}"), &mut dev.renew(DB, None, Some(&lanterne)), quiet)?;
        steps.run(&format!("e2e {name}"), &mut [node_test(&dev, steps, &[file])], tap)?;
    }
    Ok(())
}

fn node_test(dev: &Dev, steps: &Steps, files: &[&PathBuf]) -> std::process::Command {
    let mut test = dev.on(DB, "node");
    test.arg("--test");
    if !steps.verbose {
        test.arg("--test-reporter=tap");
    }
    test.args(files);
    test
}

/// Every `.test.ts` file under `apps/`, placed: a slice test in a feat's or
/// graft's `_tests/`, an e2e scenario in an app root's `_e2e/`. A test file
/// anywhere else fails, so no test runs unclassified.
fn tests(repo: &Repo) -> Result<Vec<(Kind, PathBuf)>> {
    let mut files = Vec::new();
    find(&repo.root.join("apps"), &mut files);
    let mut out = Vec::new();
    let mut stray = Vec::new();
    for file in files {
        let rel = file.strip_prefix(&repo.root).unwrap_or(&file).to_path_buf();
        match classify(&rel) {
            Some(kind) => out.push((kind, file)),
            None => stray.push(rel.display().to_string()),
        }
    }
    if !stray.is_empty() {
        return Err(Fail::new(format!(
            "test files outside a slice's _tests/ or an app's _e2e/: {}",
            stray.join(", ")
        )));
    }
    Ok(out)
}

/// A file under `<app>/feats/<feat>/…/_tests/` or `<app>/grafts/<graft>/…/_tests/`
/// tests that slice, the innermost one for a nested feat; one under
/// `<app>/ts/_e2e/` is an e2e scenario.
fn classify(rel: &Path) -> Option<Kind> {
    let parts: Vec<&str> = rel
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => s.to_str(),
            _ => None,
        })
        .collect();
    let dir = parts.get(parts.len().checked_sub(2)?)?;
    let slice = parts.windows(2).filter(|w| w[0] == "feats" || w[0] == "grafts").map(|w| w[1]).next_back();
    match (*dir, slice) {
        ("_tests", Some(s)) => Some(Kind::Slice(s.to_owned())),
        ("_e2e", None) if parts.len() == 5 && parts[2] == "ts" => Some(Kind::E2e),
        _ => None,
    }
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
        } else if path.to_string_lossy().ends_with(".test.ts") {
            out.push(path);
        }
    }
}

fn stem(path: &Path) -> String {
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

#[cfg(test)]
mod tests {
    use super::{Kind, classify};
    use std::path::Path;

    fn kind(p: &str) -> Option<String> {
        classify(Path::new(p)).map(|k| match k {
            Kind::Slice(s) => format!("slice {s}"),
            Kind::E2e => "e2e".into(),
        })
    }

    #[test]
    fn a_test_file_is_placed_by_where_it_sits() {
        assert_eq!(kind("apps/org/feats/transaction/core/ts/_tests/journal.test.ts").as_deref(), Some("slice transaction"));
        assert_eq!(kind("apps/org/grafts/circle-member/ts/_tests/may.test.ts").as_deref(), Some("slice circle-member"));
        assert_eq!(kind("apps/org/feats/a/feats/b/core/ts/_tests/x.test.ts").as_deref(), Some("slice b"));
        assert_eq!(kind("apps/org/ts/_e2e/admission.test.ts").as_deref(), Some("e2e"));
    }

    #[test]
    fn a_test_file_elsewhere_is_refused() {
        assert_eq!(kind("apps/org/ts/_tests/admission.test.ts"), None);
        assert_eq!(kind("apps/org/feats/transaction/core/ts/_e2e/x.test.ts"), None);
        assert_eq!(kind("apps/org/core/db/ts/_tests/x.test.ts"), None);
        assert_eq!(kind("apps/org/feats/transaction/core/ts/src/x.test.ts"), None);
    }
}
