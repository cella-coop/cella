use std::collections::BTreeMap;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::thread;
use std::time::Instant;

use crate::cli::Test;
use crate::db::{self, Dev};
use crate::fold;
use crate::overlap;
use crate::pruned;
use crate::reach;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, quiet};
use crate::shell;

/// The database each slice test file runs on, fresh each time.
const DB: &str = "cella_test";
const TEMPLATE: &str = "cella_test_lanterne";
const FOLD_TEMPLATE: &str = "cella_test_fold_template";

/// A worker of the e2e run, by what each scenario it runs writes: its
/// database, `cella_test_<w>`, fresh for each, and the one its log is
/// folded into after it and dropped, `cella_test_fold_<w>`. A scenario
/// reads neither name but through the `PGDATABASE` it is handed.
struct Worker {
    db: String,
    fold: String,
}

impl Worker {
    fn new(w: usize) -> Self {
        Self {
            db: format!("{DB}_{w}"),
            fold: format!("{DB}_fold_{w}"),
        }
    }
}

pub fn run(repo: &Repo, steps: &Steps, only: Option<Test>, since: Option<&str>) -> Result {
    match only {
        None => {
            rust(repo, steps, "guards", "cella-guards")?;
            rust(repo, steps, "cli", "cella-cli")?;
            notary(repo, steps)?;
            tools(repo, steps)?;
            pruned::serve(repo, steps)?;
            slices(repo, steps, None)?;
            e2e(repo, steps, None, None, since, false)
        }
        Some(Test::Guards) => rust(repo, steps, "guards", "cella-guards"),
        Some(Test::Cli) => rust(repo, steps, "cli", "cella-cli"),
        Some(Test::Notary) => notary(repo, steps),
        Some(Test::Tools) => tools(repo, steps),
        Some(Test::Pruned) => pruned::serve(repo, steps),
        Some(Test::Slice { name }) => slices(repo, steps, name.as_deref()),
        Some(Test::E2e {
            name,
            jobs,
            since,
            overlap,
        }) => e2e(
            repo,
            steps,
            name.as_deref(),
            jobs,
            since.as_deref(),
            overlap,
        ),
        Some(Test::Scale {
            members,
            years,
            keep,
        }) => scale(repo, steps, members, years, keep),
    }
}

fn rust(repo: &Repo, steps: &Steps, name: &str, package: &str) -> Result {
    let mut cmd = repo.cmd("cargo");
    cmd.args(["test", "--quiet", "-p", package]);
    steps.run(name, &mut [cmd], passed)
}

/// The scale tier's databases, which it renews each run.
const SCALE: [&str; 2] = ["cella_scale", "cella_scale_fold"];

/// The scale tier's size on disk: the entries a member makes a year, read
/// from the run at full size (10 532 395 entries of ten thousand members
/// over twenty years), and the bytes its two databases take an entry at
/// their end, 4 208 in that run, with room for the write-ahead log
/// (architecture.md, "Tests").
const ENTRIES_A_MEMBER_YEAR: u64 = 54;
const BYTES_AN_ENTRY: u64 = 4_500;

/// What the scale tier leaves free on the cluster's disk at its peak, at
/// least, since the lanes share it.
const SPARE_GB: u64 = 20;

const GB: u64 = 1_000_000_000;

/// The fold's scale tier, `tests/scale.rs`, which `cella test cli` leaves
/// out: a release build, since its generator signs millions of entries, on
/// the dev cluster, sized by its arguments; it says what it measured. It
/// refuses to start where its estimate would leave under [`SPARE_GB`] free
/// on the cluster's disk, and drops its databases when it ends, passed or
/// failed, unless it keeps them.
fn scale(repo: &Repo, steps: &Steps, members: usize, years: u32, keep: bool) -> Result {
    let dev = Dev::new(repo);
    dev.up()?;
    let entries = members as u64 * u64::from(years) * ENTRIES_A_MEMBER_YEAR;
    let needs = entries * BYTES_AN_ENTRY / GB;
    let free = free_gb(&repo.data())?;
    if free < needs + SPARE_GB {
        return Err(Fail::new(format!(
            "the scale tier at {members} members over {years} years makes about {entries} entries, about {needs} GB at {BYTES_AN_ENTRY} bytes an entry, and the cluster's disk has {free} GB free, which would leave under {SPARE_GB} GB; free some, or run it smaller"
        )));
    }
    drop_scale(&dev, steps)?;
    let mut cmd = repo.cmd("cargo");
    cmd.args([
        "test",
        "--release",
        "--quiet",
        "-p",
        "cella-cli",
        "--test",
        "scale",
        "--",
        "--ignored",
        "--nocapture",
    ])
    .env("CELLA_PGPORT", &dev.port)
    .env("CELLA_SCALE_MEMBERS", members.to_string())
    .env("CELLA_SCALE_YEARS", years.to_string());
    let ran = steps.run("scale", &mut [cmd], measured);
    if keep {
        return ran;
    }
    let dropped = drop_scale(&dev, steps);
    ran.and(dropped)
}

/// The scale tier's databases dropped, where they exist.
fn drop_scale(dev: &Dev, steps: &Steps) -> Result {
    let mut cmds: Vec<_> = SCALE
        .iter()
        .map(|db| {
            let mut cmd = dev.on("postgres", "psql");
            cmd.args(["-X", "-q", "-v", "ON_ERROR_STOP=1", "-c"])
                .arg(format!("DROP DATABASE IF EXISTS {db} WITH (FORCE)"));
            cmd
        })
        .collect();
    steps.run("scale drop", &mut cmds, quiet)
}

/// The gigabytes free on the filesystem holding `dir`, as `df` says them.
fn free_gb(dir: &Path) -> Result<u64> {
    let out = Command::new("df")
        .args(["--output=avail", "-B1"])
        .arg(dir)
        .output()
        .map_err(|e| Fail::new(format!("df: {e}")))?;
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .nth(1)
        .and_then(|l| l.trim().parse::<u64>().ok())
        .map(|b| b / GB)
        .ok_or_else(|| Fail::new(format!("df says no free space for {}", dir.display())))
}

/// The scale tier's measurements, as its line `scale: …` says them.
fn measured(out: &str) -> Option<String> {
    out.lines()
        .rev()
        .find_map(|l| l.strip_prefix("scale: "))
        .map(str::to_owned)
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
/// The site's, `site-*.test.mjs`, which read the site, are the site's
/// check's (`cella check site`), so the org's gates read none of it.
fn tools(repo: &Repo, steps: &Steps) -> Result {
    let dev = Dev::new(repo);
    dev.up()?;
    repo.install(steps)?;
    let mut test = dev.on("postgres", "node");
    test.arg("--test");
    if !steps.verbose {
        test.arg("--test-reporter=tap");
    }
    test.args(tool_tests(repo, false)?);
    steps.run("tools", &mut [test], tap)
}

/// The tools' test files, the site's (`site-*`) or every other, sorted.
pub fn tool_tests(repo: &Repo, site: bool) -> Result<Vec<PathBuf>> {
    let dir = repo.root.join("tools/_tests");
    let read = fs::read_dir(&dir).map_err(|e| Fail::new(format!("{}: {e}", dir.display())))?;
    let mut files: Vec<PathBuf> = read
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| {
            path.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.ends_with(".test.mjs") && n.starts_with("site-") == site)
        })
        .collect();
    files.sort();
    Ok(files)
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
            &mut [node_test(&dev, steps, DB, &files)],
            tap,
        )?;
    }
    Ok(())
}

/// Each e2e scenario's file on a database migrated whole and seeded with
/// Lanterne, through the handlers on the dev cluster: one at a time on this
/// process at one worker, else across workers at once, each a child of
/// this binary running one scenario at a time on its own database
/// (`WORKER`). Given `since`, only those the diff from it reaches
/// ([`reach`]); given `overlaps`, every one traced and the overlaps written
/// ([`overlap`]).
fn e2e(
    repo: &Repo,
    steps: &Steps,
    only: Option<&str>,
    jobs: Option<usize>,
    since: Option<&str>,
    overlaps: bool,
) -> Result {
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
    let chosen = match since {
        Some(rev) => reached(repo, rev, chosen)?,
        None => chosen,
    };
    if chosen.is_empty() {
        println!(
            "{:<22} the diff from {} reaches no scenario",
            "e2e",
            since.unwrap_or("")
        );
        return Ok(());
    }
    let dev = Dev::new(repo);
    dev.up()?;
    // A worker's child runs the one scenario it is handed, on its worker's
    // databases, the shell its parent built.
    if let Some(w) = std::env::var(WORKER).ok().and_then(|w| w.parse().ok()) {
        let (name, file) = chosen[0];
        let trace = std::env::var_os(overlap::DIR).map(PathBuf::from);
        let worker = Worker::new(w);
        return scenario(repo, steps, &dev, &worker, name, file, trace.as_deref());
    }
    let trace = overlaps.then(|| overlap::dir(repo)).transpose()?;
    // A scenario may drive the shell as a browser would, through its built
    // server; the build is the production one.
    shell::build(repo, steps)?;
    let jobs = jobs
        .or_else(|| std::env::var("CELLA_E2E_JOBS").ok()?.trim().parse().ok())
        .unwrap_or_else(idle_jobs)
        .clamp(1, chosen.len());
    let lanterne = repo.root.join("apps/org/fixtures/lanterne");
    let prepared = Instant::now();
    let result = (|| {
        let _turn = dev.migrating()?;
        steps.run(
            "db e2e fold template",
            &mut dev.renew(FOLD_TEMPLATE, None, None),
            quiet,
        )?;
        println!(
            "e2e fold template: migrated in {:.1}s",
            prepared.elapsed().as_secs_f64()
        );
        let seeded = Instant::now();
        steps.run(
            "db e2e template",
            &mut dev.renew(TEMPLATE, None, Some(&lanterne)),
            quiet,
        )?;
        println!(
            "e2e template: migrated and seeded in {:.1}s",
            seeded.elapsed().as_secs_f64()
        );
        Ok(())
    })();
    if let Err(e) = result {
        drop_templates(&dev, steps)?;
        return Err(e);
    }
    let trace = trace.as_deref();
    let ran = if jobs == 1 {
        let worker = Worker::new(1);
        chosen
            .iter()
            .try_for_each(|(name, file)| scenario(repo, steps, &dev, &worker, name, file, trace))
    } else {
        workers(repo, steps, &chosen, jobs, trace)
    };
    // The overlaps are written only from a whole run that passed, the
    // relations a read may name read from the seeded template.
    let written = match (&ran, trace) {
        (Ok(()), Some(dir)) => overlap::write(repo, &dev, TEMPLATE, dir),
        _ => Ok(()),
    };
    if let Some(dir) = trace {
        let _ = fs::remove_dir_all(dir);
    }
    let cleaned = drop_templates(&dev, steps);
    ran.and(written).and(cleaned)
}

/// The scenarios the diff from `rev` reaches, each printed with why it
/// runs or is left out.
fn reached<'a>(
    repo: &Repo,
    rev: &str,
    chosen: Vec<&'a (String, PathBuf)>,
) -> Result<Vec<&'a (String, PathBuf)>> {
    let files = reach::diff(&repo.root, rev)?;
    let mut trees: BTreeMap<PathBuf, reach::Tree> = BTreeMap::new();
    let mut kept = Vec::new();
    let mut left = 0;
    for pair in chosen {
        let (name, file) = pair;
        // The app a scenario sits in, `<app>/ts/_e2e/<name>.test.ts`.
        let app = file.ancestors().nth(3).unwrap_or(&repo.root).to_path_buf();
        let tree = trees
            .entry(app.clone())
            .or_insert_with(|| reach::tree(&app));
        match reach::reaches(&files, &reach::scenario(file, tree)?, tree) {
            Ok(why) => {
                println!("{:<22} {why}", format!("reached e2e/{name}"));
                kept.push(pair);
            }
            Err(why) => {
                println!("{:<22} {why}", format!("left out e2e/{name}"));
                left += 1;
            }
        }
    }
    println!(
        "{:<22} {} files since {rev} reach {} scenarios, {left} left out",
        "e2e",
        files.len(),
        kept.len()
    );
    Ok(kept)
}

fn drop_templates(dev: &Dev, steps: &Steps) -> Result {
    let mut drops: Vec<_> = [TEMPLATE, FOLD_TEMPLATE]
        .iter()
        .map(|name| {
            let mut drop = dev.on("postgres", "dropdb");
            drop.args(["--if-exists", "--force", name]);
            drop
        })
        .collect();
    steps.run("db e2e templates drop", &mut drops, quiet)
}

/// The most workers that run the scenarios at once, unless `--jobs` or
/// `CELLA_E2E_JOBS` says: as many as half the box's builds slice,
/// `MemoryHigh` 11G, holds at a worker's peak measured on the box, since
/// two gates runs may share it (index.md, "Gates"). Fewer run where the
/// box's cores are busy (`jobs_for`).
const JOBS: usize = 3;

/// The workers a run takes, unless `--jobs` or `CELLA_E2E_JOBS` says: by
/// the one-minute load average at its start over the cores it may use,
/// printed with the choice; the memory bound alone where the load is
/// unreadable.
fn idle_jobs() -> usize {
    let cores = std::thread::available_parallelism().map_or(1, |n| n.get());
    let load = std::fs::read_to_string("/proc/loadavg")
        .ok()
        .and_then(|l| l.split_whitespace().next()?.parse::<f64>().ok());
    match load {
        Some(load) => {
            let jobs = jobs_for(load, cores);
            println!(
                "{:<22} load {load:.1} on {cores} cores: {jobs} workers",
                "e2e workers"
            );
            jobs
        }
        None => {
            println!("{:<22} load unreadable: {JOBS} workers", "e2e workers");
            JOBS
        }
    }
}

/// One worker for each two of the `cores` a load average of `load` leaves
/// idle, at most `JOBS` and never fewer than one, so lanes gating at once
/// on a busy box do not starve each other's scenarios into their timeouts.
fn jobs_for(load: f64, cores: usize) -> usize {
    let idle = (cores as f64 - load).max(0.0);
    ((idle / 2.0) as usize).clamp(1, JOBS)
}

/// The variable that makes this binary a worker's child: the worker it
/// runs the scenario it is handed for.
const WORKER: &str = "CELLA_E2E_WORKER";

/// The variable that makes a browser scenario drive its browsers one after
/// another (`_e2e/browser.ts`).
const APART: &str = "CELLA_BROWSERS_APART";

/// How far apart the workers' analytics ports are, past every scenario's
/// offset.
const SPREAD: u16 = 100;

/// One scenario on a worker's database cloned from the run's seeded
/// template, then its log folded into the worker's fold database and
/// compared, unless its file says why not. Given a trace directory, what
/// it reaches is traced there ([`overlap`]).
fn scenario(
    repo: &Repo,
    steps: &Steps,
    dev: &Dev,
    worker: &Worker,
    name: &str,
    file: &PathBuf,
    trace: Option<&Path>,
) -> Result {
    let cloning = Instant::now();
    {
        let _turn = dev.migrating()?;
        dev.clone_test(steps, TEMPLATE, &worker.db)?;
    }
    println!("clone e2e/{name}: {:.1}s", cloning.elapsed().as_secs_f64());
    // The seed's last entry, past which the scenario's own begin.
    let seeded = trace.map(|_| overlap::last(dev, &worker.db)).transpose()?;
    // A browser scenario drives its browsers at once, unless its file says
    // why they would meet, in a line `// browsers: one at a time: <why>`.
    let mut test = node_test(dev, steps, &worker.db, &[file]);
    if let Some(why) = marked(file, "browsers")?
        .as_deref()
        .and_then(|m| m.strip_prefix("one at a time: "))
    {
        println!("{:<22} {why}", format!("apart e2e/{name}"));
        test.env(APART, "1");
    }
    if let Some(dir) = trace {
        overlap::trace(repo, &mut test, dir, name);
    }
    let began = Instant::now();
    steps.run(&format!("e2e {name}"), &mut [test], tap)?;
    if let (Some(dir), Some(seeded)) = (trace, seeded) {
        overlap::logged(dev, &worker.db, seeded, dir, name, began.elapsed())?;
    }
    // What the scenario wrote, folded from its log into a fresh database,
    // matches it row for row, every slice folded, so a write whose entry
    // carries less than it changed fails the day it is written
    // (architecture.md, "Folds"); unless the scenario stages, around the
    // notary, state its logged writes then build on, which no log can
    // rebuild, and says so in an `// unfolded: <why>` line.
    if let Some(why) = marked(file, "unfolded")? {
        println!("{:<22} {why}", format!("unfolded e2e/{name}"));
        return Ok(());
    }
    let folded = fold::fold_test(
        repo,
        steps,
        FOLD_TEMPLATE,
        &fold::Fold {
            source: &worker.db,
            into: &worker.fold,
            to: None,
            from: None,
            every: fold::EVERY,
            compare: true,
        },
    );
    let mut drop = dev.on("postgres", "dropdb");
    drop.args(["--if-exists", "--force", &worker.fold]);
    steps.run(&format!("unfold e2e/{name}"), &mut [drop], quiet)?;
    folded
}

/// The scenarios across `jobs` workers: the longest first, by the times the
/// last run kept, each worker taking the next as it ends one and printing
/// its output whole; a failure is named with its worker, the others run to
/// their end, and the run fails naming each that failed. A scenario whose
/// file has a line `// alone: <why>` disturbs what every worker shares, the
/// cluster or the build, so it runs after the others, by itself.
fn workers(
    repo: &Repo,
    steps: &Steps,
    chosen: &[&(String, PathBuf)],
    jobs: usize,
    trace: Option<&Path>,
) -> Result {
    let mut times = Times::read();
    let mut order: Vec<&(String, PathBuf)> = chosen.to_vec();
    // A scenario no run has timed goes first, the largest file first.
    let size = |f: &Path| fs::metadata(f).map(|m| m.len()).unwrap_or(0);
    order.sort_by(|(a, fa), (b, fb)| match (times.of(a), times.of(b)) {
        (Some(x), Some(y)) => y.total_cmp(&x),
        (None, Some(_)) => std::cmp::Ordering::Less,
        (Some(_), None) => std::cmp::Ordering::Greater,
        (None, None) => size(fb).cmp(&size(fa)),
    });
    let mut shared = Vec::new();
    let mut alone = Vec::new();
    for (name, file) in order {
        match marked(file, "alone")? {
            Some(why) => alone.push((name, why)),
            None => shared.push(name),
        }
    }
    let me = std::env::current_exe().map_err(|e| Fail::new(format!("cella: {e}")))?;
    println!(
        "{:<22} {} scenarios on {jobs} workers, then {} alone",
        "e2e",
        shared.len(),
        alone.len()
    );
    let start = Instant::now();
    let pool = Pool {
        me: &me,
        repo,
        steps,
        trace,
        ended: Mutex::new(Vec::new()),
        failed: Mutex::new(Vec::new()),
    };
    pool.run(shared, jobs);
    for (name, why) in alone {
        println!("{:<22} {why}", format!("alone e2e/{name}"));
        pool.run(vec![name], 1);
    }
    for (name, secs) in pool.ended.into_inner().unwrap_or_default() {
        times.set(name, secs);
    }
    times.write();
    let mut failed = pool.failed.into_inner().unwrap_or_default();
    println!(
        "{:<22} {:.1} min on {jobs} workers",
        "e2e",
        start.elapsed().as_secs_f64() / 60.0
    );
    if failed.is_empty() {
        return Ok(());
    }
    failed.sort();
    Err(Fail::new(format!("e2e failed: {}", failed.join(", "))))
}

/// The workers of a run, each a child of this binary running one scenario
/// at a time, and what their scenarios came to.
struct Pool<'a> {
    me: &'a Path,
    repo: &'a Repo,
    steps: &'a Steps,
    /// Where each child traces what its scenario reaches, given `--overlap`.
    trace: Option<&'a Path>,
    /// Each scenario that passed, and the seconds it took.
    ended: Mutex<Vec<(String, f64)>>,
    failed: Mutex<Vec<String>>,
}

impl Pool<'_> {
    /// Runs the scenarios on `jobs` workers, in their order, until each ended.
    fn run(&self, names: Vec<&String>, jobs: usize) {
        let queue = Mutex::new(names.into_iter());
        thread::scope(|s| {
            for w in 1..=jobs {
                let queue = &queue;
                s.spawn(move || {
                    loop {
                        // The queue is held only to take the next, never
                        // while it runs.
                        let next = lock(queue).next();
                        let Some(name) = next else {
                            break;
                        };
                        self.one(w, name);
                    }
                });
            }
        });
    }

    fn one(&self, w: usize, name: &str) {
        let mut child = Command::new(self.me);
        // A scenario's analytics shells take the worker's port plus their
        // offset, so the same offset on two workers never meets on one.
        let analytics = db::analytics_port() + SPREAD * (w as u16 - 1);
        child
            .current_dir(&self.repo.root)
            .env(WORKER, w.to_string())
            .env("CELLA_ANALYTICS_PORT", analytics.to_string());
        if self.steps.verbose {
            child.arg("--verbose");
        }
        if let Some(dir) = self.trace {
            child.env(overlap::DIR, dir);
        }
        child.args(["test", "e2e", name]);
        let begun = Instant::now();
        let (passed, out) = output(child);
        let secs = begun.elapsed().as_secs_f64();
        let mut stdout = io::stdout().lock();
        let _ = stdout.write_all(&out);
        if passed {
            lock(&self.ended).push((name.to_owned(), secs));
        } else {
            let _ = writeln!(stdout, "{:<22} FAIL on worker {w}", format!("e2e/{name}"));
            lock(&self.failed).push(name.to_owned());
        }
        let _ = stdout.flush();
    }
}

/// A lock's value, though a worker that held it panicked.
fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Whether a worker's child passed, and all it said, its standard output
/// and error in the order it said them.
fn output(mut child: Command) -> (bool, Vec<u8>) {
    let mut out = Vec::new();
    let spawned = io::pipe().and_then(|(mut reader, writer)| {
        child.stdout(writer.try_clone()?).stderr(writer);
        let mut running = child.spawn()?;
        // The pipe ends only once no writer is left, so this side's goes first.
        drop(child);
        reader.read_to_end(&mut out)?;
        running.wait()
    });
    match spawned {
        Ok(status) => (status.success(), out),
        Err(e) => {
            out.extend_from_slice(format!("cella: {e}\n").as_bytes());
            (false, out)
        }
    }
}

/// How long each scenario took when it last passed, in seconds, kept
/// between runs under the user's cache, since a gates run's checkout is
/// removed after it: a line `<name> <secs>` each.
struct Times(BTreeMap<String, f64>);

impl Times {
    fn path() -> Option<PathBuf> {
        let cache = std::env::var_os("XDG_CACHE_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".cache")))?;
        Some(cache.join("cella/e2e-times"))
    }

    fn read() -> Self {
        let text = Self::path()
            .and_then(|p| fs::read_to_string(p).ok())
            .unwrap_or_default();
        Self(
            text.lines()
                .filter_map(|l| {
                    let (name, secs) = l.split_once(' ')?;
                    Some((name.to_owned(), secs.trim().parse().ok()?))
                })
                .collect(),
        )
    }

    fn of(&self, name: &str) -> Option<f64> {
        self.0.get(name).copied()
    }

    fn set(&mut self, name: String, secs: f64) {
        self.0.insert(name, secs);
    }

    /// Writes the times beside their file and moves them over it, so runs
    /// at once never read half of one; a run that cannot keeps none.
    fn write(&self) {
        let Some(path) = Self::path() else {
            return;
        };
        let text: String = self
            .0
            .iter()
            .map(|(name, secs)| format!("{name} {secs:.1}\n"))
            .collect();
        let next = path.with_extension(format!("{}", std::process::id()));
        let _ = path
            .parent()
            .map_or(Ok(()), fs::create_dir_all)
            .and_then(|()| fs::write(&next, text))
            .and_then(|()| fs::rename(&next, &path));
    }
}

/// What a scenario's file says of itself in a line `// <mark>: <why>`, such
/// as why its log does not fold, `unfolded`, why it runs by itself,
/// `alone`, or why its browsers run one at a time, `browsers`.
fn marked(file: &Path, mark: &str) -> Result<Option<String>> {
    let text =
        fs::read_to_string(file).map_err(|e| Fail::new(format!("{}: {e}", file.display())))?;
    let prefix = format!("// {mark}: ");
    Ok(text
        .lines()
        .find_map(|l| l.strip_prefix(prefix.as_str()))
        .map(str::to_owned))
}

fn node_test(dev: &Dev, steps: &Steps, db: &str, files: &[&PathBuf]) -> std::process::Command {
    let mut test = dev.on(db, "node");
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

pub fn tap(out: &str) -> Option<String> {
    out.lines()
        .find_map(|l| l.strip_prefix("# pass "))
        .map(|n| format!("{n} passed"))
}

#[cfg(test)]
mod tests {
    use super::{JOBS, Kind, classify, contract, jobs_for};
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
    fn the_workers_are_what_the_idle_cores_leave_room_for() {
        assert_eq!(jobs_for(2.0, 8), 3);
        assert_eq!(jobs_for(4.0, 8), 2);
        assert_eq!(jobs_for(6.0, 8), 1);
        assert_eq!(jobs_for(45.0, 8), 1);
        assert_eq!(jobs_for(0.0, 8), JOBS);
        assert_eq!(jobs_for(0.0, 1), 1);
    }

    #[test]
    fn a_contract_is_its_slices_by_where_it_sits() {
        assert_eq!(
            contract(Path::new("apps/org/feats/account/core/sql/analytics.sql")).as_deref(),
            Some("account")
        );
        assert_eq!(
            contract(Path::new(
                "apps/org/feats/party/feats/membership/core/sql/analytics.sql"
            ))
            .as_deref(),
            Some("membership")
        );
        assert_eq!(
            contract(Path::new("apps/org/core/person/sql/analytics.sql")).as_deref(),
            Some("person")
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
