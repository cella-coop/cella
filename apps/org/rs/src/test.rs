use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::cli::Test;
use crate::db::Dev;
use crate::fold;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, quiet};
use crate::shell;

/// The database each slice test file and each e2e scenario runs on, fresh
/// each time.
const DB: &str = "cella_test";

/// Where each e2e scenario's log is folded after it, and dropped.
const FOLD: &str = "cella_test_fold";

pub fn run(repo: &Repo, steps: &Steps, only: Option<Test>) -> Result {
    match only {
        None => {
            rust(repo, steps, "guards", "cella-guards")?;
            rust(repo, steps, "cli", "cella-cli")?;
            notary(repo, steps)?;
            tools(repo, steps)?;
            slices(repo, steps, None)?;
            e2e(repo, steps, None)
        }
        Some(Test::Guards) => rust(repo, steps, "guards", "cella-guards"),
        Some(Test::Cli) => rust(repo, steps, "cli", "cella-cli"),
        Some(Test::Notary) => notary(repo, steps),
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

/// The notary's `#[pg_test]`s, on a cluster pgrx makes for them and drops.
/// pgrx installs the extension where `pg_config` says; the Nix store is
/// read-only, so it is handed a `pg_config` naming a share and a lib
/// directory under `.data/notary-test`, which the cluster loads from as
/// the dev cluster does. Every script in the notary's `rs/sql/` is staged
/// beside the one pgrx installs, as `cella ext build` stages them, so the
/// tests install each earlier version and upgrade it. A target directory
/// of its own keeps its `pg_config` from rebuilding the workspace's
/// bindings.
fn notary(repo: &Repo, steps: &Steps) -> Result {
    let dir = repo.data().join("notary-test");
    let home = dir.join("pgrx");
    fs::create_dir_all(&home).map_err(|e| Fail::new(format!("{}: {e}", home.display())))?;
    let share = dir.join("share/extension");
    fs::create_dir_all(&share).map_err(|e| Fail::new(format!("{}: {e}", share.display())))?;
    let scripts = repo.root.join("apps/org/core/notary/rs/sql");
    for script in
        fs::read_dir(&scripts).map_err(|e| Fail::new(format!("{}: {e}", scripts.display())))?
    {
        let from = script
            .map_err(|e| Fail::new(format!("{}: {e}", scripts.display())))?
            .path();
        if let Some(name) = from.file_name() {
            fs::copy(&from, share.join(name))
                .map_err(|e| Fail::new(format!("{}: {e}", from.display())))?;
        }
    }
    let wrapper = dir.join("pg_config");
    let script = format!(
        "#!/bin/sh\ncase \"$1\" in\n  --sharedir) echo '{share}' ;;\n  --pkglibdir) echo '{lib}' ;;\n  *) exec '{real}' \"$@\" ;;\nesac\n",
        share = dir.join("share").display(),
        lib = dir.join("lib").display(),
        real = crate::db::pg_config(),
    );
    let written = fs::write(&wrapper, script).and_then(|()| {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&wrapper, fs::Permissions::from_mode(0o755))
    });
    written.map_err(|e| Fail::new(format!("{}: {e}", wrapper.display())))?;
    let mut cmd = repo.cmd("cargo");
    cmd.args(["test", "--quiet", "-p", "cella", "--features", "pg_test"])
        .env("CELLA_NOTARY_TEST", &dir)
        .env("PGRX_HOME", &home)
        .env("PGRX_PG_CONFIG_PATH", &wrapper)
        .env("CARGO_TARGET_DIR", repo.root.join("target/notary-test"));
    steps.run("notary", &mut [cmd], passed)
}

/// The node tools' own tests, `tools/_tests/*.test.mjs`, on the dev
/// cluster by the PG* variables: migrate's make a database of their own.
fn tools(repo: &Repo, steps: &Steps) -> Result {
    let dev = Dev::new(repo);
    dev.up()?;
    repo.install(steps)?;
    let mut test = dev.on("postgres", "node");
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
/// A slice that publishes an analytical contract is migrated so even with
/// no test file: the migration applies its contract on its part alone and
/// reads each view as `cella_analytics`, or fails.
fn slices(repo: &Repo, steps: &Steps, only: Option<&str>) -> Result {
    let mut found: Vec<(String, PathBuf)> = tests(repo)?
        .into_iter()
        .filter_map(|(kind, f)| match kind {
            Kind::Slice(s) => Some((s, f)),
            Kind::E2e => None,
        })
        .collect();
    found.sort();
    let published = contracts(repo);
    let mut names: Vec<&str> = found
        .iter()
        .map(|(s, _)| s.as_str())
        .chain(published.iter().map(String::as_str))
        .collect();
    names.sort_unstable();
    names.dedup();
    let chosen: Vec<&str> = names
        .iter()
        .copied()
        .filter(|n| only.is_none_or(|o| o == *n))
        .collect();
    if chosen.is_empty() {
        return Err(Fail::new(format!(
            "no slice tests for {}; slices with tests: {}",
            only.unwrap_or("any slice"),
            names.join(", ")
        )));
    }
    let dev = Dev::new(repo);
    dev.up()?;
    repo.install(steps)?;
    for slice in chosen {
        steps.run(
            &format!("db slice/{slice}"),
            &mut dev.renew(DB, Some(slice), None),
            quiet,
        )?;
        let files: Vec<&PathBuf> = found
            .iter()
            .filter(|(s, _)| s == slice)
            .map(|(_, f)| f)
            .collect();
        if files.is_empty() {
            continue;
        }
        steps.run(
            &format!("slice {slice}"),
            &mut [node_test(&dev, steps, &files)],
            tap,
        )?;
    }
    Ok(())
}

/// Each e2e scenario's file on a database migrated whole and seeded with
/// Lanterne, through the handlers on the dev cluster.
fn e2e(repo: &Repo, steps: &Steps, only: Option<&str>) -> Result {
    let mut files: Vec<PathBuf> = tests(repo)?
        .into_iter()
        .filter(|(k, _)| matches!(k, Kind::E2e))
        .map(|(_, f)| f)
        .collect();
    files.sort();
    let named: Vec<(String, PathBuf)> = files.into_iter().map(|f| (stem(&f), f)).collect();
    let chosen: Vec<&(String, PathBuf)> = named
        .iter()
        .filter(|(n, _)| only.is_none_or(|o| o == n))
        .collect();
    if chosen.is_empty() {
        let known: Vec<&str> = named.iter().map(|(n, _)| n.as_str()).collect();
        return Err(Fail::new(format!(
            "no e2e scenario {}; there are: {}",
            only.unwrap_or(""),
            known.join(", ")
        )));
    }
    let dev = Dev::new(repo);
    dev.up()?;
    // A scenario may drive the shell as a browser would, through its built
    // server; the build is the production one.
    shell::build(repo, steps)?;
    let lanterne = repo.root.join("apps/org/fixtures/lanterne");
    for (name, file) in chosen {
        steps.run(
            &format!("db e2e/{name}"),
            &mut dev.renew(DB, None, Some(&lanterne)),
            quiet,
        )?;
        steps.run(
            &format!("e2e {name}"),
            &mut [node_test(&dev, steps, &[file])],
            tap,
        )?;
        // What the scenario wrote, folded from its log into a fresh
        // database, matches it row for row, every slice folded, so a write
        // whose entry carries less than it changed fails the day it is
        // written (architecture.md, "Folds"); unless the scenario stages,
        // around the notary, state its logged writes then build on, which
        // no log can rebuild, and says so in an `// unfolded: <why>` line.
        if let Some(why) = unfolded(file)? {
            println!("{:<22} {why}", format!("unfolded e2e/{name}"));
            continue;
        }
        let folded = fold::fold(
            repo,
            steps,
            &fold::Fold {
                source: DB,
                into: FOLD,
                to: None,
                from: None,
                every: fold::EVERY,
                compare: true,
            },
        );
        let mut drop = dev.on("postgres", "dropdb");
        drop.args(["--if-exists", "--force", FOLD]);
        steps.run(&format!("unfold e2e/{name}"), &mut [drop], quiet)?;
        folded?;
    }
    Ok(())
}

/// Why a scenario's log does not fold, where its file says so in a line
/// `// unfolded: <why>`.
fn unfolded(file: &Path) -> Result<Option<String>> {
    let text =
        fs::read_to_string(file).map_err(|e| Fail::new(format!("{}: {e}", file.display())))?;
    Ok(text
        .lines()
        .find_map(|l| l.strip_prefix("// unfolded: "))
        .map(str::to_owned))
}

fn node_test(dev: &Dev, steps: &Steps, files: &[&PathBuf]) -> std::process::Command {
    let mut test = dev.on(DB, "node");
    // A scenario that rehearses an operation runs this binary, as a host would.
    if let Ok(me) = std::env::current_exe() {
        test.env("CELLA_BIN", me);
    }
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
/// `<app>/core/<lib>/ts/_tests/` tests that library of the app's core on
/// the core alone, as `circle`'s do; one under `<app>/ts/_e2e/` is an e2e
/// scenario.
fn classify(rel: &Path) -> Option<Kind> {
    let parts: Vec<&str> = rel
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => s.to_str(),
            _ => None,
        })
        .collect();
    let dir = parts.get(parts.len().checked_sub(2)?)?;
    let slice = parts
        .windows(2)
        .filter(|w| w[0] == "feats" || w[0] == "grafts")
        .map(|w| w[1])
        .next_back();
    match (*dir, slice) {
        ("_tests", Some(s)) => Some(Kind::Slice(s.to_owned())),
        ("_tests", None) if parts.len() == 7 && parts[2] == "core" && parts[4] == "ts" => {
            Some(Kind::Slice(parts[3].to_owned()))
        }
        ("_e2e", None) if parts.len() == 5 && parts[2] == "ts" => Some(Kind::E2e),
        _ => None,
    }
}

/// Every slice that publishes an analytical contract, by name: a feat's
/// `core/sql/analytics.sql`, a graft's `sql/analytics.sql`, or a core
/// library's but the analytics port's, `core/<lib>/sql/analytics.sql`.
fn contracts(repo: &Repo) -> Vec<String> {
    let mut files = Vec::new();
    walk(&repo.root.join("apps"), &mut files, &|p| {
        p.ends_with("sql/analytics.sql")
    });
    let mut out: Vec<String> = files
        .iter()
        .filter_map(|f| contract(f.strip_prefix(&repo.root).unwrap_or(f)))
        .collect();
    out.sort();
    out
}

/// The slice whose contract a file is, by where it sits.
fn contract(rel: &Path) -> Option<String> {
    let parts: Vec<&str> = rel
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => s.to_str(),
            _ => None,
        })
        .collect();
    match parts.as_slice() {
        [.., "feats", feat, "core", "sql", "analytics.sql"] => Some((*feat).to_owned()),
        [.., "grafts", graft, "sql", "analytics.sql"] => Some((*graft).to_owned()),
        ["apps", _, "core", lib, "sql", "analytics.sql"] if *lib != "analytics" => {
            Some((*lib).to_owned())
        }
        _ => None,
    }
}

fn find(dir: &Path, out: &mut Vec<PathBuf>) {
    walk(dir, out, &|p| p.to_string_lossy().ends_with(".test.ts"));
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>, keep: &dyn Fn(&Path) -> bool) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if entry.file_name() == "node_modules" {
            continue;
        }
        if path.is_dir() {
            walk(&path, out, keep);
        } else if keep(&path) {
            out.push(path);
        }
    }
}

fn stem(path: &Path) -> String {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
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
    out.lines()
        .find_map(|l| l.strip_prefix("# pass "))
        .map(|n| format!("{n} passed"))
}

#[cfg(test)]
mod tests {
    use super::{Kind, classify, contract};
    use std::path::Path;

    fn kind(p: &str) -> Option<String> {
        classify(Path::new(p)).map(|k| match k {
            Kind::Slice(s) => format!("slice {s}"),
            Kind::E2e => "e2e".into(),
        })
    }

    #[test]
    fn a_test_file_is_placed_by_where_it_sits() {
        assert_eq!(
            kind("apps/org/feats/transaction/core/ts/_tests/journal.test.ts").as_deref(),
            Some("slice transaction")
        );
        assert_eq!(
            kind("apps/org/grafts/membership-motion/ts/_tests/procedure.test.ts").as_deref(),
            Some("slice membership-motion")
        );
        assert_eq!(
            kind("apps/org/core/circle/ts/_tests/mandate.test.ts").as_deref(),
            Some("slice circle")
        );
        assert_eq!(
            kind("apps/org/feats/a/feats/b/core/ts/_tests/x.test.ts").as_deref(),
            Some("slice b")
        );
        assert_eq!(
            kind("apps/org/ts/_e2e/admission.test.ts").as_deref(),
            Some("e2e")
        );
    }

    #[test]
    fn a_contract_is_its_slices_by_where_it_sits() {
        assert_eq!(
            contract(Path::new("apps/org/feats/account/core/sql/analytics.sql")).as_deref(),
            Some("account")
        );
        assert_eq!(
            contract(Path::new(
                "apps/org/feats/person/feats/membership/core/sql/analytics.sql"
            ))
            .as_deref(),
            Some("membership")
        );
        assert_eq!(
            contract(Path::new(
                "apps/org/grafts/account-transaction/sql/analytics.sql"
            ))
            .as_deref(),
            Some("account-transaction")
        );
        assert_eq!(
            contract(Path::new("apps/org/core/circle/sql/analytics.sql")).as_deref(),
            Some("circle")
        );
        assert_eq!(
            contract(Path::new("apps/org/core/analytics/sql/analytics.sql")),
            None
        );
        assert_eq!(
            contract(Path::new("apps/org/feats/account/core/sql/001-account.sql")),
            None
        );
    }

    #[test]
    fn a_test_file_elsewhere_is_refused() {
        assert_eq!(kind("apps/org/ts/_tests/admission.test.ts"), None);
        assert_eq!(
            kind("apps/org/feats/transaction/core/ts/_e2e/x.test.ts"),
            None
        );
        assert_eq!(kind("apps/org/core/db/_tests/x.test.ts"), None);
        assert_eq!(
            kind("apps/org/feats/transaction/core/ts/src/x.test.ts"),
            None
        );
    }
}
