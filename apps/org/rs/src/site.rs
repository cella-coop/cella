use std::fs;
use std::process::Command;

use crate::cli::{Site, SitePhoto};
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, last_line};

/// The landing site, `apps/site`: Astro's dev server, or its static build
/// into `apps/site/dist`. It is deployed nowhere.
pub fn run(repo: &Repo, steps: &Steps, command: Site) -> Result {
    repo.install(steps)?;
    match command {
        Site::Dev { port } => {
            println!("site on http://localhost:{port}, dev mode");
            let mut dev = astro(repo);
            dev.args(["dev", "--port"]).arg(port.to_string());
            Steps::exec(&mut dev)
        }
        Site::Build => {
            let mut build = astro(repo);
            build.arg("build");
            steps.run("site", &mut [build], last_line)?;
            println!("built {}", repo.site_dir().join("dist").display());
            Ok(())
        }
        Site::Photo {
            command: SitePhoto::Add { url, name },
        } => {
            let mut add = repo.node("site-photo.mjs");
            add.arg(url).arg(repo.site_dir());
            if let Some(name) = name {
                add.args(["--name", &name]);
            }
            Steps::exec(&mut add)
        }
    }
}

/// `cella check site`: the copy check (`tools/site-copy.mjs`: no word of
/// copy outside the content collections), `astro check`, then a build
/// into a directory of its own, removed after, so the check leaves `dist`
/// as it found it. It sits in `.data`, on the checkout's filesystem, since
/// Astro moves its assets there by rename, which cannot cross to another.
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
    let result = steps.run("site", &mut [check, build], last_line);
    if out.exists() {
        fs::remove_dir_all(&out).map_err(|e| Fail::new(format!("{}: {e}", out.display())))?;
    }
    result
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
