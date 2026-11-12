use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::cli::{Site, SitePhoto};
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, last_line};
use crate::secret;

/// The landing site, `apps/site`: Astro's dev server, its static build
/// into `apps/site/dist`, or its release, which puts what main holds live
/// at cella.coop.
pub fn run(repo: &Repo, steps: &Steps, command: Site) -> Result {
    // A release judges its commit before it installs anything, so one
    // refused or with nothing to release costs nothing
    let command = match command {
        Site::Release { to } => return release(repo, steps, &to),
        other => other,
    };
    repo.install(steps)?;
    match command {
        Site::Release { .. } => unreachable!("released above"),
        Site::Dev { port } => {
            println!("site on http://localhost:{port}, dev mode");
            let mut dev = astro(repo);
            dev.args(["dev", "--port"]).arg(port.to_string());
            Steps::exec(&mut dev)
        }
        Site::Build { release } => {
            let mut build = astro(repo);
            build.arg("build");
            if release {
                build.env("CELLA_SITE_RELEASE", "1");
            }
            steps.run("site", &mut [build], last_line)?;
            println!("built {}", repo.site_dir().join("dist").display());
            Ok(())
        }
        Site::Screenshots => {
            let out = repo
                .data()
                .join(format!("site-screenshots-{}", std::process::id()));
            let mut shoot = repo.node("site-figures.mjs");
            shoot.arg("--screenshots").arg(repo.site_dir()).arg(&out);
            let result = steps.run("site screenshots", &mut [shoot], last_line);
            remove(&out)?;
            result
        }
        Site::Fmt { check } => {
            // The operator runs it on their own text; its settings are the
            // site's `.prettierrc.json`, which an editor formatting on save
            // reads too
            let mut fmt = Command::new("pnpm");
            fmt.current_dir(repo.site_dir())
                .args([
                    "exec",
                    "prettier",
                    if check { "--check" } else { "--write" },
                ])
                .args(["src/content", "src/drafts"]);
            Steps::exec(&mut fmt)
        }
        Site::Photo {
            command: SitePhoto::Add { urls, name },
        } => {
            if name.is_some() && urls.len() > 1 {
                return Err(Fail::new("--name names one photo; give one URL with it"));
            }
            let mut add = repo.node("site-photo.mjs");
            add.arg("--site").arg(repo.site_dir());
            // The environment's key wins; else the development secrets'
            if std::env::var_os("UNSPLASH_ACCESS_KEY").is_none()
                && let Some(key) = secret::get(repo, "unsplash_access_key")?
            {
                add.env("UNSPLASH_ACCESS_KEY", key.as_str());
            }
            if let Some(name) = name {
                add.args(["--name", &name]);
            }
            add.args(&urls);
            Steps::exec(&mut add)
        }
    }
}

/// `cella check site`: the copy check (`tools/site-copy.mjs`: no word of
/// copy outside the content collections), `astro check`, then a build
/// into a directory of its own, removed after, so the check leaves `dist`
/// as it found it, then the figure fixture's two builds there
/// (`tools/site-figures.mjs`), which refuse an icon Phosphor lacks. It
/// sits in `.data`, on the checkout's filesystem, since Astro moves its
/// assets there by rename, which cannot cross to another.
pub fn check(repo: &Repo, steps: &Steps) -> Result {
    let mut copy = repo.node("site-copy.mjs");
    copy.arg(repo.site_dir());
    steps.run("site copy", &mut [copy], last_line)?;
    let mut diagrams = repo.node("site-diagrams.mjs");
    diagrams
        .arg(repo.root.join("packages/diagrams"))
        .arg(repo.site_dir());
    steps.run("site diagrams", &mut [diagrams], last_line)?;
    let mut photos = repo.node("site-photo.mjs");
    photos.args(["--check"]).arg(repo.site_dir());
    steps.run("site photos", &mut [photos], last_line)?;
    let out = repo
        .data()
        .join(format!("site-check-{}", std::process::id()));
    let mut check = astro(repo);
    check.arg("check");
    let mut build = astro(repo);
    build.arg("build").arg("--outDir").arg(&out);
    let mut figures = repo.node("site-figures.mjs");
    figures.arg(repo.site_dir()).arg(&out);
    let result = steps
        .run("site", &mut [check, build], last_line)
        .and_then(|()| steps.run("site figures", &mut [figures], last_line));
    remove(&out)?;
    result
}

/// What a release build is given: the endpoints the production host's
/// Caddy hands to its Listmonk and its contact form, and the ids of the
/// lists its Listmonk makes (the workshop's `hosts/prod/production/`).
const PRODUCTION: [(&str, &str); 4] = [
    ("PUBLIC_SIGNUP_URL", "/subscription/form"),
    ("PUBLIC_SIGNUP_LIST", "085b5a17-eea1-419c-8fe4-b355a1b8a082"),
    ("PUBLIC_PILOT_LIST", "ba4e58be-9e62-49eb-a737-e7612466b520"),
    ("PUBLIC_CONTACT_URL", "/message"),
];

/// The paths a build of the site reads from the repository: a commit
/// that changes none of them since the one served releases nothing.
const SITE_PATHS: [&str; 3] = ["apps/site", "packages/brand", "packages/diagrams"];

/// The builds a host keeps, the one it serves among them.
const KEPT: usize = 3;

/// Where a release goes: the production host by ssh, whose forced command
/// answers `served` and takes `release <commit>`, or a local directory
/// standing in for one, laid out as the host's `/var/www/cella.coop/`.
enum Host {
    Ssh(String),
    Dir(PathBuf),
}

impl Host {
    fn parse(to: &str) -> Result<Self> {
        if to.starts_with('/') {
            return Ok(Self::Dir(PathBuf::from(to)));
        }
        let named = !to.is_empty()
            && to
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '@'));
        if !named {
            return Err(Fail::new(format!(
                "--to {to:?} is neither an ssh host nor an absolute path: name the host, as `production`, or a directory standing in for it"
            )));
        }
        Ok(Self::Ssh(to.to_owned()))
    }

    fn ssh(host: &str) -> Command {
        let mut ssh = Command::new("ssh");
        ssh.args(["-o", "BatchMode=yes", host]);
        ssh
    }

    /// The commit the `current` link serves, where it names one.
    fn served(&self) -> Result<Option<String>> {
        let name = match self {
            Self::Dir(dir) => match fs::read_link(dir.join("current")) {
                Ok(target) => target.file_name().map(|n| n.to_string_lossy().into_owned()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
                Err(e) => return Err(Fail::new(format!("{}/current: {e}", dir.display()))),
            },
            Self::Ssh(host) => {
                let mut ask = Self::ssh(host);
                ask.arg("served");
                Some(Steps::read(&mut ask)?)
            }
        };
        Ok(name.filter(|n| is_commit(n)))
    }

    /// Puts the build in a directory of its own named by its commit,
    /// swaps the `current` link to it, and keeps the newest builds alone.
    fn release(&self, commit: &str, build: &Path) -> Result {
        match self {
            Self::Dir(dir) => {
                let part = dir.join(format!(".{commit}.part"));
                let into = dir.join(commit);
                for stale in [&part, &into] {
                    remove(stale)?;
                }
                fs::create_dir_all(&part)
                    .map_err(|e| Fail::new(format!("{}: {e}", part.display())))?;
                let mut copy = Command::new("cp");
                copy.arg("-a").arg(build.join(".")).arg(&part);
                Steps::read(&mut copy)?;
                rename(&part, &into)?;
                let link = dir.join(".current.new");
                let _ = fs::remove_file(&link);
                std::os::unix::fs::symlink(commit, &link)
                    .map_err(|e| Fail::new(format!("{}: {e}", link.display())))?;
                rename(&link, &dir.join("current"))?;
                prune(dir, commit)
            }
            Self::Ssh(host) => {
                let mut tar = Command::new("tar");
                tar.arg("-C")
                    .arg(build)
                    .args(["-cf", "-", "."])
                    .stdout(Stdio::piped());
                let mut packed = tar.spawn().map_err(|e| Fail::new(format!("tar: {e}")))?;
                let mut send = Self::ssh(host);
                send.args(["release", commit]);
                if let Some(out) = packed.stdout.take() {
                    send.stdin(out);
                }
                let delivered = Steps::read(&mut send);
                let tarred = packed.wait().map_err(|e| Fail::new(format!("tar: {e}")))?;
                delivered?;
                if !tarred.success() {
                    return Err(Fail::new(format!("tar of {} failed", build.display())));
                }
                Ok(())
            }
        }
    }
}

/// `cella site release`: the release build of main's head, live at
/// cella.coop, unless what it serves holds the same site.
fn release(repo: &Repo, steps: &Steps, to: &str) -> Result {
    let host = Host::parse(to)?;
    let out = repo
        .data()
        .join(format!("site-release-{}", std::process::id()));
    let released = publish(&repo.root, &host, || {
        repo.install(steps)?;
        let mut build = astro(repo);
        build
            .arg("build")
            .arg("--outDir")
            .arg(&out)
            .env("CELLA_SITE_RELEASE", "1")
            .envs(PRODUCTION);
        steps.run("site release build", &mut [build], last_line)?;
        Ok(out.clone())
    });
    remove(&out)?;
    match released? {
        Released::Same(served) => println!(
            "cella.coop serves {}, whose site is main's: nothing to release",
            short(&served)
        ),
        Released::Live(commit) => println!("cella.coop serves {}, main's head", short(&commit)),
    }
    Ok(())
}

/// What a release did.
#[derive(Debug, PartialEq, Eq)]
enum Released {
    /// The commit served holds the same site as main's head.
    Same(String),
    /// Main's head is live.
    Live(String),
}

/// Releases main's head from the checkout at `root`: refused unless its
/// `HEAD` is main's head and its working tree is that commit's, skipped
/// where the host serves a commit whose site paths match it, and else
/// built by `build`, which returns the build's directory, and sent.
fn publish(root: &Path, host: &Host, build: impl FnOnce() -> Result<PathBuf>) -> Result<Released> {
    let head = git(root, &["rev-parse", "--verify", "HEAD^{commit}"])?;
    let main = git(root, &["rev-parse", "--verify", "refs/heads/main^{commit}"])?;
    if head != main {
        return Err(Fail::new(format!(
            "HEAD is {}, not main's head {}: a release builds main alone; check out main",
            short(&head),
            short(&main)
        )));
    }
    let changed = git(root, &["status", "--porcelain"])?;
    if !changed.is_empty() {
        let first = changed.lines().next().unwrap_or_default();
        return Err(Fail::new(format!(
            "the working tree is not {}, as `{first}` shows: a release builds a commit, never a working tree; commit or drop the changes",
            short(&head)
        )));
    }
    if let Some(served) = host.served()? {
        let known = git(root, &["cat-file", "-e", &format!("{served}^{{commit}}")]).is_ok();
        if known {
            let mut same = Command::new("git");
            same.current_dir(root)
                .args(["diff", "--quiet", &served, &head, "--"])
                .args(SITE_PATHS);
            if Steps::ok(&mut same)? {
                return Ok(Released::Same(served));
            }
        }
    }
    let dir = build()?;
    host.release(&head, &dir)?;
    Ok(Released::Live(head))
}

/// Removes every build but the newest `KEPT`, never the one served.
fn prune(dir: &Path, serving: &str) -> Result {
    let read = fs::read_dir(dir).map_err(|e| Fail::new(format!("{}: {e}", dir.display())))?;
    let mut builds: Vec<(std::time::SystemTime, PathBuf)> = read
        .filter_map(std::result::Result::ok)
        .filter(|e| is_commit(&e.file_name().to_string_lossy()))
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter_map(|e| Some((e.metadata().ok()?.modified().ok()?, e.path())))
        .collect();
    builds.sort_by_key(|b| std::cmp::Reverse(b.0));
    for (_, old) in builds.into_iter().skip(KEPT) {
        if old.file_name().is_some_and(|n| n != serving) {
            remove(&old)?;
        }
    }
    Ok(())
}

fn is_commit(name: &str) -> bool {
    name.len() == 40
        && name
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

fn short(commit: &str) -> &str {
    commit.get(..8).unwrap_or(commit)
}

/// A git command's output in the checkout at `root`, its failure quiet.
fn git(root: &Path, args: &[&str]) -> Result<String> {
    let out = Command::new("git")
        .current_dir(root)
        .args(args)
        .stderr(Stdio::null())
        .output()
        .map_err(|e| Fail::new(format!("git: {e}")))?;
    if !out.status.success() {
        return Err(Fail::new(format!(
            "git {} failed in {}",
            args.join(" "),
            root.display()
        )));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_owned())
}

fn rename(from: &Path, to: &Path) -> Result {
    fs::rename(from, to)
        .map_err(|e| Fail::new(format!("{} → {}: {e}", from.display(), to.display())))
}

/// Removes a build directory the site's steps made, if they made it.
fn remove(out: &Path) -> Result {
    if out.exists() {
        fs::remove_dir_all(out).map_err(|e| Fail::new(format!("{}: {e}", out.display())))?;
    }
    Ok(())
}

/// The site's `astro`, run from its directory. Its telemetry is off, which
/// also keeps it from writing a config under a home that may be read-only.
fn astro(repo: &Repo) -> Command {
    let mut cmd = Command::new("pnpm");
    cmd.current_dir(repo.site_dir())
        .args(["exec", "astro"])
        .env("ASTRO_TELEMETRY_DISABLED", "1");
    cmd
}

#[cfg(test)]
mod tests {
    use super::{Host, Released, publish};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    /// A checkout of its own on `main`, its site one file, and a directory
    /// standing in for the production host, both removed when it drops.
    struct Bench {
        root: PathBuf,
        repo: PathBuf,
        host: PathBuf,
    }

    impl Bench {
        fn new(name: &str) -> Self {
            let root = std::env::temp_dir()
                .join(format!("cella-site-release-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&root);
            let (repo, host) = (root.join("repo"), root.join("host"));
            fs::create_dir_all(repo.join("apps/site")).unwrap();
            fs::create_dir_all(&host).unwrap();
            let bench = Self { root, repo, host };
            bench.git(&["init", "-q", "-b", "main"]);
            bench.commit("apps/site/index.md", "one");
            bench
        }

        fn git(&self, args: &[&str]) -> String {
            let out = Command::new("git")
                .current_dir(&self.repo)
                .env("GIT_CONFIG_GLOBAL", "/dev/null")
                .env("GIT_CONFIG_NOSYSTEM", "1")
                .args([
                    "-c",
                    "user.name=t",
                    "-c",
                    "user.email=t@t",
                    "-c",
                    "commit.gpgsign=false",
                ])
                .args(args)
                .output()
                .unwrap();
            assert!(
                out.status.success(),
                "git {args:?}: {}",
                String::from_utf8_lossy(&out.stderr)
            );
            String::from_utf8_lossy(&out.stdout).trim().to_owned()
        }

        /// Commits `text` as the file at `path`, returning the commit.
        fn commit(&self, path: &str, text: &str) -> String {
            let file = self.repo.join(path);
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(file, text).unwrap();
            self.git(&["add", "-A"]);
            self.git(&["commit", "-q", "-m", path]);
            self.git(&["rev-parse", "HEAD"])
        }

        /// Releases main's head to the host, its build one page saying `page`.
        fn release(&self, page: &str) -> (Result<Released, String>, bool) {
            let built = std::cell::Cell::new(false);
            let out = self.root.join("dist");
            let result = publish(&self.repo, &Host::Dir(self.host.clone()), || {
                built.set(true);
                let _ = fs::remove_dir_all(&out);
                fs::create_dir_all(&out).unwrap();
                fs::write(out.join("index.html"), page).unwrap();
                Ok(out.clone())
            });
            (result.map_err(|f| f.msg.unwrap_or_default()), built.get())
        }

        fn serving(&self) -> String {
            fs::read_to_string(self.host.join("current/index.html")).unwrap()
        }

        fn builds(&self) -> usize {
            fs::read_dir(&self.host)
                .unwrap()
                .filter_map(Result::ok)
                .filter(|e| e.file_type().unwrap().is_dir())
                .count()
        }
    }

    impl Drop for Bench {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn link(host: &Path) -> String {
        fs::read_link(host.join("current"))
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }

    #[test]
    fn a_release_swaps_the_link_to_main_s_head_and_keeps_three_builds() {
        let bench = Bench::new("live");
        let mut heads = vec![bench.git(&["rev-parse", "HEAD"])];
        assert_eq!(bench.release("one").0, Ok(Released::Live(heads[0].clone())));
        assert_eq!(link(&bench.host), heads[0]);
        assert_eq!(bench.serving(), "one");
        for n in ["two", "three", "four"] {
            heads.push(bench.commit("apps/site/index.md", n));
            assert_eq!(
                bench.release(n).0,
                Ok(Released::Live(heads.last().unwrap().clone()))
            );
            assert_eq!(bench.serving(), n);
        }
        assert_eq!(bench.builds(), 3);
        assert!(!bench.host.join(&heads[0]).exists());
        assert!(bench.host.join(&heads[1]).exists());
    }

    #[test]
    fn a_release_writes_nothing_where_the_site_served_is_main_s() {
        let bench = Bench::new("same");
        let first = bench.git(&["rev-parse", "HEAD"]);
        bench.release("one").0.unwrap();
        // A commit outside the site's paths leaves the site as it was
        bench.commit("apps/org/index.md", "org");
        let (result, built) = bench.release("never");
        assert_eq!(result, Ok(Released::Same(first.clone())));
        assert!(!built, "a release with nothing to release builds nothing");
        assert_eq!(link(&bench.host), first);
        // The brand is the site's, so a change to it releases
        let brand = bench.commit("packages/brand/house.json", "{}");
        assert_eq!(bench.release("brand").0, Ok(Released::Live(brand)));
    }

    #[test]
    fn a_release_refuses_a_working_tree_and_another_branch() {
        let bench = Bench::new("refuse");
        fs::write(bench.repo.join("apps/site/index.md"), "edited").unwrap();
        let (result, built) = bench.release("edited");
        let said = result.unwrap_err();
        assert!(said.contains("never a working tree"), "{said}");
        assert!(!built);
        bench.git(&["checkout", "-q", "--", "."]);
        fs::write(bench.repo.join("apps/site/new.md"), "new").unwrap();
        assert!(
            bench
                .release("new")
                .0
                .unwrap_err()
                .contains("never a working tree")
        );
        fs::remove_file(bench.repo.join("apps/site/new.md")).unwrap();
        bench.git(&["checkout", "-q", "-b", "other"]);
        bench.commit("apps/site/index.md", "other");
        let (result, built) = bench.release("other");
        assert!(result.unwrap_err().contains("builds main alone"));
        assert!(!built);
        assert!(!bench.host.join("current").exists());
    }

    #[test]
    fn a_host_is_an_ssh_name_or_an_absolute_path() {
        assert!(matches!(Host::parse("production"), Ok(Host::Ssh(h)) if h == "production"));
        assert!(matches!(Host::parse("/tmp/host"), Ok(Host::Dir(_))));
        assert!(Host::parse("prod; rm -rf /").is_err());
        assert!(Host::parse("relative/dir").is_err());
        assert!(Host::parse("").is_err());
    }
}
