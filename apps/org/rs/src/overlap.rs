//! What each e2e scenario reaches, and where the scenarios overlap
//! (`cella test e2e --overlap`): the commands it wrote, those its log
//! holds past the seed's and those it tried and was refused; the queries
//! it called, by the tables and views their text names; and the routes
//! the shell served it, by browser or by fetch; with its minutes. Written
//! to `apps/org/ts/_e2e/overlap.md` as a review list, never a delete list
//! ([tests](../../../../_corpus/doc/architecture.md#tests)).

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use crate::db::Dev;
use crate::fold::psql;
use crate::repo::Repo;
use crate::run::{Fail, Result};

/// The variable naming a run's trace directory to a worker's child.
pub const DIR: &str = "CELLA_E2E_OVERLAP";

/// The variable naming a scenario's trace file to `_e2e/trace.ts`.
const TRACE: &str = "CELLA_E2E_TRACE";

/// Where the list is written, from the repository's root.
const LIST: &str = "apps/org/ts/_e2e/overlap.md";

/// How much of the smaller of two scenarios they share, at least, to be
/// listed as a pair.
const SHARED: f64 = 0.9;

/// How many pairs are listed.
const PAIRS: usize = 40;

/// A run's trace directory, fresh.
pub fn dir(repo: &Repo) -> Result<PathBuf> {
    let dir = repo
        .data()
        .join(format!("e2e-overlap/{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).map_err(|e| Fail::new(format!("{}: {e}", dir.display())))?;
    Ok(dir)
}

/// Loads the trace into the scenario's node and every node it starts.
pub fn trace(repo: &Repo, test: &mut Command, dir: &Path, name: &str) {
    let module = repo.root.join("apps/org/ts/_e2e/trace.ts");
    let mut options = std::env::var("NODE_OPTIONS").unwrap_or_default();
    if !options.is_empty() {
        options.push(' ');
    }
    let _ = write!(options, "--import {}", module.display());
    test.env("NODE_OPTIONS", options).env(TRACE, dir.join(name));
}

/// The log's last entry on a database, 0 where it holds none.
pub fn last(dev: &Dev, db: &str) -> Result<i64> {
    let text = psql(dev, db, "SELECT coalesce(max(n), 0) FROM cella.log")?;
    text.trim()
        .parse()
        .map_err(|_| Fail::new(format!("the log's last entry is not a number: {text}")))
}

/// Adds to a scenario's trace the commands its log holds past the seed's,
/// and its minutes.
pub fn logged(dev: &Dev, db: &str, seeded: i64, dir: &Path, name: &str, took: Duration) -> Result {
    let ops = psql(
        dev,
        db,
        &format!("SELECT DISTINCT op FROM cella.log WHERE n > {seeded}"),
    )?;
    let mut lines = String::new();
    for op in ops.lines().filter(|l| !l.is_empty()) {
        let _ = writeln!(lines, "command {op}");
    }
    let _ = writeln!(lines, "minutes {:.2}", took.as_secs_f64() / 60.0);
    let file = dir.join(name);
    let mut text = fs::read_to_string(&file).unwrap_or_default();
    text.push_str(&lines);
    fs::write(&file, text).map_err(|e| Fail::new(format!("{}: {e}", file.display())))
}

/// A request as its route, `<method> <path>`, its path matched against the
/// shell's route tree, `routes`, as the shell matches it: a segment a static
/// directory names, or a parameter naming a kind of thing, a collection, a
/// feat, a verb or a page, kept as it is, unless it holds what only an id
/// does, a digit, `@`, `%` or `~`, as a GET's `[verb]` is an item's id; one
/// an id fills, `[id]` or `[secret]`, as `:id`; what a rest parameter takes
/// as `*`. A remote function is kept by its id, and a path the tree does
/// not match, as it came.
fn route(request: &str, routes: &Path) -> String {
    let (method, path) = request.split_once(' ').unwrap_or(("", request));
    if path.starts_with("/_app/remote/") {
        return request.to_owned();
    }
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let matched = matched(routes, &segments)
        .unwrap_or_else(|| segments.iter().map(|s| (*s).to_owned()).collect());
    format!("{method} /{}", matched.join("/"))
}

/// The segments as the first route under `dir` that takes them all names
/// them: a static directory before a parameter, an optional one after, a
/// rest last.
fn matched(dir: &Path, segments: &[&str]) -> Option<Vec<String>> {
    let Some((s, rest)) = segments.split_first() else {
        return Some(Vec::new());
    };
    let named = |name: String, rest: Vec<String>| {
        let mut out = vec![name];
        out.extend(rest);
        out
    };
    if !s.starts_with('[')
        && dir.join(s).is_dir()
        && let Some(m) = matched(&dir.join(s), rest)
    {
        return Some(named((*s).to_owned(), m));
    }
    let mut params: Vec<String> = fs::read_dir(dir)
        .ok()?
        .flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with('['))
        .collect();
    params.sort_by_key(|p| (p.starts_with("[..."), p.starts_with("[["), p.clone()));
    for param in params {
        let name = param.trim_matches(|c| c == '[' || c == ']');
        if name.starts_with("...") {
            return Some(vec!["*".to_owned()]);
        }
        let id = matches!(name, "id" | "secret")
            || s.contains(|c: char| c.is_ascii_digit() || "@%~".contains(c));
        if let Some(m) = matched(&dir.join(&param), rest) {
            return Some(named(
                if id {
                    ":id".to_owned()
                } else {
                    (*s).to_owned()
                },
                m,
            ));
        }
    }
    None
}

/// What one scenario reached.
#[derive(Debug, Default, PartialEq)]
struct Reach {
    minutes: f64,
    commands: BTreeSet<String>,
    reads: BTreeSet<String>,
    routes: BTreeSet<String>,
}

/// What a trace's lines are kept against: the relations the database holds
/// and the shell's route tree.
struct Known {
    relations: BTreeSet<String>,
    routes: PathBuf,
}

impl Reach {
    /// A trace's lines: a command where it is a permission, a read where the
    /// database holds its relation, a request as its route.
    fn parse(text: &str, known: &Known) -> Self {
        let mut reach = Self::default();
        for line in text.lines() {
            let Some((kind, what)) = line.split_once(' ') else {
                continue;
            };
            match kind {
                "command" if what.split(':').count() == 3 && !what.contains('@') => {
                    reach.commands.insert(what.to_owned());
                }
                "read" if known.relations.contains(what) => {
                    reach.reads.insert(what.to_owned());
                }
                "route" => {
                    reach.routes.insert(route(what, &known.routes));
                }
                "minutes" => reach.minutes = what.parse().unwrap_or(0.0),
                _ => {}
            }
        }
        reach
    }

    /// Everything it reached, each by its kind.
    fn items(&self) -> BTreeSet<String> {
        let kinds = [
            ("command", &self.commands),
            ("query", &self.reads),
            ("route", &self.routes),
        ];
        kinds
            .iter()
            .flat_map(|(kind, set)| set.iter().map(move |s| format!("{kind} {s}")))
            .collect()
    }
}

/// The scenarios' traces, overlapped, written to the list.
pub fn write(repo: &Repo, dev: &Dev, template: &str, dir: &Path) -> Result {
    let relations: BTreeSet<String> = psql(
        dev,
        template,
        "SELECT n.nspname || '.' || c.relname FROM pg_class c \
         JOIN pg_namespace n ON n.oid = c.relnamespace \
         WHERE c.relkind IN ('r', 'p', 'v', 'm') \
         AND n.nspname NOT IN ('pg_catalog', 'information_schema')",
    )?
    .lines()
    .map(str::to_owned)
    .collect();
    let known = Known {
        relations,
        routes: repo.root.join("apps/org/ts/src/routes"),
    };
    let mut reached = BTreeMap::new();
    let entries = fs::read_dir(dir).map_err(|e| Fail::new(format!("{}: {e}", dir.display())))?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let text = fs::read_to_string(entry.path()).unwrap_or_default();
        reached.insert(name, Reach::parse(&text, &known));
    }
    let head = git_head(repo);
    let list = render(&reached, &head);
    let path = repo.root.join(LIST);
    fs::write(&path, list).map_err(|e| Fail::new(format!("{}: {e}", path.display())))?;
    println!(
        "{:<22} {} scenarios overlapped, written to {LIST}",
        "e2e overlap",
        reached.len()
    );
    Ok(())
}

/// The commit the run stands at, and whether the tree held changes beside it.
fn git_head(repo: &Repo) -> String {
    let git = |args: &[&str]| {
        Command::new("git")
            .current_dir(&repo.root)
            .args(args)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned())
            .unwrap_or_default()
    };
    let head = git(&["rev-parse", "--short=9", "HEAD"]);
    if git(&["status", "--porcelain", "--untracked-files=no"]).is_empty() {
        format!("`{head}`")
    } else {
        format!("`{head}` with changes uncommitted")
    }
}

/// A scenario held whole by others: its items all in each of theirs.
struct Held<'a> {
    name: &'a str,
    by: Vec<&'a str>,
}

/// Two scenarios sharing most of the smaller's items.
struct Pair<'a> {
    smaller: &'a str,
    larger: &'a str,
    shared: usize,
    of: usize,
}

/// The overlaps: each scenario held whole by another, and the pairs
/// sharing at least `SHARED` of the smaller's, those held whole left out;
/// each ranked by the minutes of the one that could go, most first.
fn overlaps(reached: &BTreeMap<String, Reach>) -> (Vec<Held<'_>>, Vec<Pair<'_>>) {
    let items: BTreeMap<&str, BTreeSet<String>> = reached
        .iter()
        .map(|(n, r)| (n.as_str(), r.items()))
        .collect();
    let minutes = |n: &str| reached.get(n).map_or(0.0, |r| r.minutes);
    let mut held = Vec::new();
    for (a, ia) in &items {
        if ia.is_empty() {
            continue;
        }
        let by: Vec<&str> = items
            .iter()
            .filter(|(b, ib)| b != &a && ia.is_subset(ib))
            .map(|(b, _)| *b)
            .collect();
        if !by.is_empty() {
            held.push(Held { name: a, by });
        }
    }
    let whole: BTreeSet<&str> = held.iter().map(|h| h.name).collect();
    let mut pairs = Vec::new();
    let names: Vec<&str> = items.keys().copied().collect();
    for (i, a) in names.iter().enumerate() {
        for b in &names[i + 1..] {
            let (ia, ib) = (&items[a], &items[b]);
            let (smaller, larger) = if ia.len() <= ib.len() { (a, b) } else { (b, a) };
            let of = items[smaller].len();
            if of == 0 || whole.contains(smaller) {
                continue;
            }
            let shared = ia.intersection(ib).count();
            #[allow(clippy::cast_precision_loss)]
            if shared as f64 / of as f64 >= SHARED {
                pairs.push(Pair {
                    smaller,
                    larger,
                    shared,
                    of,
                });
            }
        }
    }
    held.sort_by(|x, y| minutes(y.name).total_cmp(&minutes(x.name)));
    pairs.sort_by(|x, y| minutes(y.smaller).total_cmp(&minutes(x.smaller)));
    pairs.truncate(PAIRS);
    (held, pairs)
}

fn render(reached: &BTreeMap<String, Reach>, commit: &str) -> String {
    let (held, pairs) = overlaps(reached);
    let minutes = |n: &str| reached.get(n).map_or(0.0, |r| r.minutes);
    let total: f64 = reached.values().map(|r| r.minutes).sum();
    let mut out = String::new();
    let _ = writeln!(out, "# The e2e scenarios' overlap\n");
    let _ = writeln!(
        out,
        "Written by `cella test e2e --overlap` at {commit}: {} scenarios, \
         {total:.1} minutes of scenario time. Each scenario reaches the commands \
         it wrote, the queries it called, by the tables and views their text \
         names, and the routes the shell served it. This is a review list, never \
         a delete list: a scenario leaves the suite only by a change the planner \
         plans from it, which says what it covered and what covers it now \
         ([the CLI](../../rs/index.md)).\n",
        reached.len()
    );
    let _ = writeln!(out, "## Held whole\n");
    if held.is_empty() {
        let _ = writeln!(out, "No scenario's reach is all in another's.\n");
    } else {
        let _ = writeln!(
            out,
            "Each scenario whose commands, queries and routes another holds \
             whole, most minutes first.\n"
        );
        let _ = writeln!(out, "| Scenario | Minutes | Held by |\n|---|---:|---|");
        for h in &held {
            let _ = writeln!(
                out,
                "| `{}` | {:.2} | {} |",
                h.name,
                minutes(h.name),
                h.by.iter()
                    .map(|b| format!("`{b}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        let _ = writeln!(out);
    }
    let _ = writeln!(out, "## Sharing most\n");
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let at_least = (SHARED * 100.0).round() as u32;
    if pairs.is_empty() {
        let _ = writeln!(
            out,
            "No two scenarios share {at_least}% of the smaller's reach.\n"
        );
    } else {
        let _ = writeln!(
            out,
            "The pairs sharing at least {at_least}% of the smaller's reach, those \
             held whole left out, by the minutes the smaller takes, the first \
             {PAIRS}.\n"
        );
        let _ = writeln!(
            out,
            "| Smaller | Minutes | Larger | Shared |\n|---|---:|---|---:|"
        );
        for p in &pairs {
            let _ = writeln!(
                out,
                "| `{}` | {:.2} | `{}` | {} of {} |",
                p.smaller,
                minutes(p.smaller),
                p.larger,
                p.shared,
                p.of
            );
        }
        let _ = writeln!(out);
    }
    each(&mut out, reached);
    out
}

/// Each scenario's reach, and what it alone reaches.
fn each(out: &mut String, reached: &BTreeMap<String, Reach>) {
    // How many scenarios reach each item, so each one's own are those only
    // it reaches.
    let mut reaching: BTreeMap<String, usize> = BTreeMap::new();
    for r in reached.values() {
        for item in r.items() {
            *reaching.entry(item).or_default() += 1;
        }
    }
    let _ = writeln!(out, "## Each scenario\n");
    let _ = writeln!(
        out,
        "What each reaches, and what it alone reaches, which no other \
         scenario covers.\n"
    );
    let _ = writeln!(
        out,
        "| Scenario | Minutes | Commands | Queries | Routes | Its own |\n\
         |---|---:|---:|---:|---:|---|"
    );
    for (name, r) in reached {
        let own: Vec<String> = r
            .items()
            .into_iter()
            .filter(|i| reaching.get(i) == Some(&1))
            .map(|i| format!("`{i}`"))
            .collect();
        let _ = writeln!(
            out,
            "| `{name}` | {:.2} | {} | {} | {} | {} |",
            r.minutes,
            r.commands.len(),
            r.reads.len(),
            r.routes.len(),
            own.join(", ")
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A scenario reaching `items`, each `<kind> <what>` as `items` lists them.
    fn reach(minutes: f64, items: &[&str]) -> Reach {
        let mut r = Reach {
            minutes,
            ..Reach::default()
        };
        for item in items {
            let (kind, what) = item.split_once(' ').expect("a kind");
            let set = match kind {
                "command" => &mut r.commands,
                "query" => &mut r.reads,
                _ => &mut r.routes,
            };
            set.insert(what.to_owned());
        }
        r
    }

    fn known() -> Known {
        Known {
            relations: BTreeSet::from(["contact.contact".to_owned()]),
            routes: Path::new(env!("CARGO_MANIFEST_DIR")).join("../ts/src/routes"),
        }
    }

    #[test]
    fn a_trace_keeps_permissions_relations_the_database_holds_and_routes() {
        let r = Reach::parse(
            "command cella:contact:add\ncommand julien@lanterne.example\n\
             read contact.contact\nread c.name\n\
             route GET /contacts\nminutes 1.50\n",
            &known(),
        );
        assert_eq!(r.minutes, 1.5);
        assert_eq!(
            r.items(),
            BTreeSet::from([
                "command cella:contact:add".to_owned(),
                "query contact.contact".to_owned(),
                "route GET /contacts".to_owned(),
            ])
        );
    }

    #[test]
    fn a_route_is_matched_against_the_shell_s_tree() {
        let routes = known().routes;
        let cases = [
            ("GET /documents/card-10/live", "GET /documents/:id/live"),
            ("GET /contacts/ondine", "GET /contacts/:id"),
            ("GET /settings/account", "GET /settings/account"),
            ("GET /join/s3cr3t", "GET /join/:id"),
            ("GET /journal/2027/03", "GET /journal/*"),
            ("POST /api/task/create", "POST /api/task/create"),
            ("GET /api/payslips", "GET /api/payslips"),
            (
                "GET /api/payslips/2026-09~chloe%40lanterne.example",
                "GET /api/payslips/:id",
            ),
            ("GET /settings/nowhere", "GET /settings/nowhere"),
            ("GET /files/f1/content", "GET /files/:id/content"),
            ("GET /", "GET /"),
            (
                "POST /_app/remote/1v3bh7i/send",
                "POST /_app/remote/1v3bh7i/send",
            ),
        ];
        for (request, want) in cases {
            assert_eq!(route(request, &routes), want, "{request}");
        }
    }

    #[test]
    fn a_scenario_another_holds_whole_is_held_and_never_paired() {
        let reached = BTreeMap::from([
            (
                "big".to_owned(),
                reach(2.0, &["command x:y:a", "command x:y:b", "route GET /x"]),
            ),
            (
                "small".to_owned(),
                reach(1.0, &["command x:y:a", "route GET /x"]),
            ),
            ("apart".to_owned(), reach(3.0, &["command x:y:z"])),
        ]);
        let (held, pairs) = overlaps(&reached);
        assert_eq!(held.len(), 1);
        assert_eq!((held[0].name, held[0].by.clone()), ("small", vec!["big"]));
        assert!(pairs.is_empty());
    }

    #[test]
    fn pairs_sharing_most_are_ranked_by_the_smaller_s_minutes() {
        let ten = |extra: &str, minutes| {
            let mut items: Vec<String> = (0..9).map(|i| format!("command c{i}")).collect();
            items.push(format!("command {extra}"));
            let items: Vec<&str> = items.iter().map(String::as_str).collect();
            reach(minutes, &items)
        };
        let reached = BTreeMap::from([
            ("a".to_owned(), ten("a", 1.0)),
            ("b".to_owned(), ten("b", 4.0)),
            ("far".to_owned(), reach(9.0, &["command c0", "command q"])),
        ]);
        let (held, pairs) = overlaps(&reached);
        assert!(held.is_empty());
        assert_eq!(pairs.len(), 1);
        assert_eq!((pairs[0].shared, pairs[0].of), (9, 10));
        let list = render(&reached, "abc");
        assert!(
            list.contains("| `far` | 9.00 | 2 | 0 | 0 | `command q` |"),
            "{list}"
        );
    }
}
