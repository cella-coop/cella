//! Which e2e scenarios a diff reaches (`cella test e2e --since REV`). A
//! scenario reaches the slices whose packages it imports, itself or through
//! the helpers beside it in `_e2e/`, and those its line `// covers: <slice>
//! …` names; `// covers: all`, or an import of the shell's source, whose
//! registry holds every slice, reaches them all. A diff reaches a scenario
//! where a slice it touches shares a feat with one the scenario reaches,
//! and every scenario where it touches a file outside a slice's package
//! that a scenario may read ([tests](../../../../_corpus/doc/architecture.md#tests)).

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};

use crate::run::{Fail, Result};

/// The feats each slice of an app is made of, by the slice's name: a
/// feat's own and its ancestors', a graft's the feats it joins and those
/// of the node it sits at.
pub type Tree = BTreeMap<String, BTreeSet<String>>;

/// What a scenario reaches, or what a diff touches.
#[derive(Debug, PartialEq)]
pub enum Reach {
    /// Every slice, and why.
    All(String),
    /// These slices, by name.
    Slices(BTreeSet<String>),
}

/// The slices of the app at `app`, from its `feat.toml`s and its nodes'
/// `grafts/`, at every depth.
pub fn tree(app: &Path) -> Tree {
    let mut out = Tree::new();
    node(app, &[], &mut out);
    out
}

fn node(dir: &Path, lineage: &[String], out: &mut Tree) {
    for (name, path) in entries(&dir.join("feats")) {
        if !path.join("feat.toml").exists() {
            continue;
        }
        let mut mine = lineage.to_vec();
        mine.push(name.clone());
        out.insert(name, mine.iter().cloned().collect());
        node(&path, &mine, out);
    }
    for (name, _) in entries(&dir.join("grafts")) {
        let feats = joined(&name, lineage);
        out.insert(name, feats);
    }
}

fn entries(dir: &Path) -> Vec<(String, std::path::PathBuf)> {
    let Ok(read) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out: Vec<_> = read
        .flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| (e.file_name().to_string_lossy().into_owned(), e.path()))
        .collect();
    out.sort();
    out
}

/// A graft's feats: those its name joins and its node's lineage.
fn joined(graft: &str, lineage: &[String]) -> BTreeSet<String> {
    graft
        .split('-')
        .map(str::to_owned)
        .chain(lineage.iter().cloned())
        .collect()
}

/// What the scenario `file` reaches, its helpers read from the directory
/// it sits in.
pub fn scenario(file: &Path, tree: &Tree) -> Result<Reach> {
    let dir = file.parent().unwrap_or(Path::new("."));
    let mut slices = BTreeSet::new();
    let mut seen = BTreeSet::new();
    let mut todo = vec![file.to_path_buf()];
    while let Some(next) = todo.pop() {
        if !seen.insert(next.clone()) {
            continue;
        }
        let text =
            fs::read_to_string(&next).map_err(|e| Fail::new(format!("{}: {e}", next.display())))?;
        if next == file
            && let Some(line) = text.lines().find_map(|l| l.strip_prefix("// covers: "))
        {
            for name in line.split_whitespace() {
                if name == "all" {
                    return Ok(Reach::All("its covers line says all".into()));
                }
                // The core's alone, which every diff outside a slice reaches.
                if name == "core" {
                    continue;
                }
                if !tree.contains_key(name) {
                    return Err(Fail::new(format!(
                        "{}: covers {name}, a slice the tree lacks",
                        file.display()
                    )));
                }
                slices.insert(name.to_owned());
            }
        }
        for spec in specs(&text) {
            if let Some(helper) = spec.strip_prefix("./") {
                todo.push(dir.join(helper));
            } else if spec.starts_with("../") || spec.starts_with('#') {
                return Ok(Reach::All(format!("it imports the shell's {spec}")));
            } else if let Some(slice) = package(&spec, tree) {
                slices.insert(slice);
            }
        }
    }
    Ok(Reach::Slices(slices))
}

/// Every module a file imports, statically or by `import()`.
fn specs(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for lead in [
        "from '",
        "from \"",
        "import '",
        "import \"",
        "import('",
        "import(\"",
    ] {
        let close = lead.chars().last().unwrap_or('\'');
        let mut rest = text;
        while let Some(at) = rest.find(lead) {
            rest = &rest[at + lead.len()..];
            if let Some(end) = rest.find(close) {
                out.push(rest[..end].to_owned());
                rest = &rest[end..];
            }
        }
    }
    out
}

/// The slice a workspace package is, by its name: `@cella/<app>-graft-<g>`
/// a graft, `@cella/<app>-<f>` a feat the tree holds; a core package is
/// none.
fn package(spec: &str, tree: &Tree) -> Option<String> {
    let name = spec.strip_prefix("@cella/")?.split('/').next()?;
    let (_, rest) = name.split_once('-')?;
    let slice = rest.strip_prefix("graft-").unwrap_or(rest);
    tree.contains_key(slice).then(|| slice.to_owned())
}

/// What a file the diff touches reaches, by its path from the repository's
/// root: a slice's package that slice; a file no scenario reads, a
/// markdown doc, the records, the research, the agents' settings, the
/// site or the diagrams, none; anything else, such as the app's core, the
/// shell, the CLI, the fixtures, the tools, a manifest, a lockfile or the
/// flake, every slice.
pub fn touched(rel: &str) -> Reach {
    let parts: Vec<&str> = rel.split('/').collect();
    let unread = rel.ends_with(".md")
        || ["_corpus", "research", ".claude"].contains(&parts[0])
        || rel.starts_with("apps/site/")
        || rel.starts_with("packages/diagrams/");
    if unread {
        return Reach::Slices(BTreeSet::new());
    }
    let mut lineage = Vec::new();
    let mut i = 2;
    if parts.len() > 3 && parts[0] == "apps" {
        while i + 2 < parts.len() {
            match parts[i] {
                "feats" => {
                    lineage.push(parts[i + 1].to_owned());
                    i += 2;
                }
                "grafts" => {
                    return Reach::Slices([parts[i + 1].to_owned()].into());
                }
                _ => break,
            }
        }
    }
    match lineage.last() {
        Some(feat) => Reach::Slices([feat.clone()].into()),
        None => Reach::All(format!("{rel} is outside a slice's package")),
    }
}

/// The feats a slice the diff touches is made of: the tree's where it
/// holds it, else, for a slice the diff removes, its name's.
fn feats(slice: &str, tree: &Tree) -> BTreeSet<String> {
    tree.get(slice)
        .cloned()
        .unwrap_or_else(|| joined(slice, &[]))
}

/// What the diff from `rev` to the commit checked out touches, from where
/// they part (`REV...HEAD`), so a main that moved since adds nothing.
pub fn diff(root: &Path, rev: &str) -> Result<Vec<String>> {
    let out = Command::new("git")
        .current_dir(root)
        .args([
            "diff",
            "--name-only",
            "--no-renames",
            &format!("{rev}...HEAD"),
        ])
        .stderr(Stdio::inherit())
        .output()
        .map_err(|e| Fail::new(format!("git: {e}")))?;
    if !out.status.success() {
        return Err(Fail::new(format!("git diff {rev}...HEAD failed")));
    }
    Ok(String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(str::to_owned)
        .collect())
}

/// Whether the diff's files reach a scenario: `Ok` its reason to run,
/// `Err` its reason to be left out.
pub fn reaches(
    files: &[String],
    reach: &Reach,
    tree: &Tree,
) -> std::result::Result<String, String> {
    let mut touched_slices = BTreeSet::new();
    for file in files {
        match touched(file) {
            Reach::All(why) => return Ok(why),
            Reach::Slices(s) => touched_slices.extend(s),
        }
    }
    if touched_slices.is_empty() {
        return Err("the diff touches no slice".into());
    }
    let mine = match reach {
        Reach::All(why) => return Ok(why.clone()),
        Reach::Slices(s) => s,
    };
    for t in &touched_slices {
        let theirs = feats(t, tree);
        if let Some(s) = mine.iter().find(|s| !feats(s, tree).is_disjoint(&theirs)) {
            return Ok(if s == t {
                format!("it reaches {t}")
            } else {
                format!("it reaches {s}, which shares a feat with {t}")
            });
        }
    }
    let names: Vec<&str> = mine.iter().map(String::as_str).collect();
    Err(if names.is_empty() {
        "it reaches no slice".into()
    } else {
        format!("the diff reaches none of {}", names.join(", "))
    })
}

#[cfg(test)]
mod tests {
    use super::{Reach, Tree, joined, package, reaches, specs, touched};

    fn tree() -> Tree {
        let mut t = Tree::new();
        for f in ["motion", "membership", "contact", "invoice"] {
            t.insert(f.into(), [f.to_owned()].into());
        }
        for g in ["membership-motion", "contact-invoice"] {
            t.insert(g.into(), joined(g, &[]));
        }
        t
    }

    fn slices(names: &[&str]) -> Reach {
        Reach::Slices(names.iter().map(|n| (*n).to_owned()).collect())
    }

    #[test]
    fn a_file_touches_the_slice_whose_package_holds_it() {
        assert_eq!(
            touched("apps/org/feats/contact/core/sql/contact.sql"),
            slices(&["contact"])
        );
        assert_eq!(
            touched("apps/org/grafts/contact-invoice/ts/src/api/x.ts"),
            slices(&["contact-invoice"])
        );
        assert_eq!(
            touched("apps/org/feats/party/feats/membership/core/ts/x.ts"),
            slices(&["membership"])
        );
        assert_eq!(
            touched("apps/org/feats/party/grafts/a-b/sql/x.sql"),
            slices(&["a-b"])
        );
    }

    #[test]
    fn a_file_outside_a_slice_touches_every_one_and_a_doc_none() {
        for f in [
            "apps/org/core/circle/sql/circle.sql",
            "apps/org/core/grafts/circle-policy/sql/x.sql",
            "apps/org/ts/src/lib/server/slices.ts",
            "apps/org/ts/_e2e/lanterne.ts",
            "apps/org/fixtures/lanterne/motion.toml",
            "apps/org/rs/src/test.rs",
            "tools/feat-check.mjs",
            "pnpm-lock.yaml",
            "flake.nix",
            "packages/brand/house.json",
        ] {
            assert!(matches!(touched(f), Reach::All(_)), "{f}");
        }
        for f in [
            "_corpus/doc/architecture.md",
            "apps/org/core/circle/index.md",
            "apps/site/src/pages/index.astro",
            "packages/diagrams/src/x.ts",
        ] {
            assert_eq!(touched(f), slices(&[]), "{f}");
        }
    }

    #[test]
    fn a_scenario_names_the_slices_of_the_packages_it_imports() {
        let text = "import { a } from '@cella/org-motion/api'\nimport {\n  b,\n} from '@cella/org-graft-membership-motion/api'\nimport { c } from '@cella/org-db'\nimport x from './lanterne.ts'\nconst y = await import('#lib/slices.ts')\n";
        assert_eq!(
            specs(text),
            [
                "@cella/org-motion/api",
                "@cella/org-graft-membership-motion/api",
                "@cella/org-db",
                "./lanterne.ts",
                "#lib/slices.ts"
            ]
        );
        let t = tree();
        assert_eq!(
            package("@cella/org-motion/api", &t).as_deref(),
            Some("motion")
        );
        assert_eq!(
            package("@cella/org-graft-membership-motion/api", &t).as_deref(),
            Some("membership-motion")
        );
        assert_eq!(package("@cella/org-db", &t), None);
        assert_eq!(package("pg", &t), None);
    }

    #[test]
    fn a_diff_reaches_a_scenario_whose_slices_share_a_feat_with_it() {
        let t = tree();
        let files = |f: &[&str]| f.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>();
        let motion = files(&["apps/org/feats/motion/core/sql/motion.sql"]);
        assert!(reaches(&motion, &slices(&["motion"]), &t).is_ok());
        assert!(reaches(&motion, &slices(&["membership-motion"]), &t).is_ok());
        assert!(reaches(&motion, &slices(&["contact-invoice"]), &t).is_err());
        let graft = files(&["apps/org/grafts/membership-motion/sql/x.sql"]);
        assert!(reaches(&graft, &slices(&["membership"]), &t).is_ok());
        assert!(reaches(&graft, &slices(&["contact"]), &t).is_err());
        assert!(reaches(&motion, &slices(&[]), &t).is_err());
        assert!(reaches(&motion, &Reach::All("all".into()), &t).is_ok());
        let core = files(&["apps/org/core/db/ts/src/index.ts"]);
        assert!(reaches(&core, &slices(&[]), &t).is_ok());
        let doc = files(&["_corpus/doc/architecture.md"]);
        assert!(reaches(&doc, &slices(&["motion"]), &t).is_err());
        assert!(reaches(&doc, &Reach::All("all".into()), &t).is_err());
        let gone = files(&["apps/org/grafts/contact-motion/sql/x.sql"]);
        assert!(reaches(&gone, &slices(&["contact"]), &t).is_ok());
    }

    /// The org app's own scenarios: a diff touching one feat runs those
    /// reaching it, `contacts` among them and `editor` not, and one
    /// touching core runs every one.
    #[test]
    fn the_org_scenarios_a_feat_reaches_and_core_reaches_all() {
        let app = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
        let t = super::tree(&app);
        let mut names: Vec<_> = std::fs::read_dir(app.join("ts/_e2e"))
            .expect("the org's _e2e")
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.to_string_lossy().ends_with(".test.ts"))
            .collect();
        names.sort();
        let ran = |file: &str| -> Vec<String> {
            names
                .iter()
                .filter(|p| {
                    let Ok(reach) = super::scenario(p, &t) else {
                        panic!("{}: no reach", p.display())
                    };
                    reaches(&[file.to_owned()], &reach, &t).is_ok()
                })
                .map(|p| {
                    p.file_name()
                        .unwrap()
                        .to_string_lossy()
                        .replace(".test.ts", "")
                })
                .collect()
        };
        let contact = ran("apps/org/feats/contact/core/sql/contact.sql");
        assert!(contact.contains(&"contacts".to_owned()), "{contact:?}");
        assert!(!contact.contains(&"editor".to_owned()), "{contact:?}");
        assert!(contact.len() < names.len());
        assert_eq!(ran("apps/org/core/db/ts/src/index.ts").len(), names.len());
        assert!(ran("_corpus/doc/architecture.md").is_empty());
    }
}
