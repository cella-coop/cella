use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::db::{analytics_port, pg_port};
use crate::run::{Fail, Result, Steps, quiet};

/// The repository: the Cargo workspace root that holds the org app, or
/// the copy of it the flake's `cella-org` installs, which `CELLA_PACKAGE`
/// names: read-only, its shell built and its npm workspace installed
/// already, its state where `CELLA_DATA` says.
pub struct Repo {
    pub root: PathBuf,
    pub packaged: bool,
}

impl Repo {
    /// The package `CELLA_PACKAGE` names, else walks up from the working
    /// directory to the workspace root, falling back to the checkout this
    /// binary was built from, so cella runs the same from any directory.
    pub fn find() -> Result<Self> {
        if let Some(root) = env::var_os("CELLA_PACKAGE").filter(|r| !r.is_empty()) {
            let root = PathBuf::from(root);
            if !is_root(&root) {
                return Err(Fail::new(format!(
                    "CELLA_PACKAGE names {}, which holds no cella workspace",
                    root.display()
                )));
            }
            return Ok(Self {
                root,
                packaged: true,
            });
        }
        let here = env::current_dir().ok();
        let found = here.iter().flat_map(|d| d.ancestors()).find(|d| is_root(d));
        if let Some(root) = found {
            return Ok(Self {
                root: root.to_path_buf(),
                packaged: false,
            });
        }
        let built = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        if is_root(&built) {
            let root = built
                .canonicalize()
                .map_err(|e| Fail::new(format!("{}: {e}", built.display())))?;
            return Ok(Self {
                root,
                packaged: false,
            });
        }
        Err(Fail::new(
            "no cella workspace here or above, nor where this binary was built",
        ))
    }

    /// A command run from the workspace root, handed the dev cluster's and
    /// the analytics shell's ports, so a test it runs meets the cluster
    /// this cella started.
    pub fn cmd(&self, program: &str) -> Command {
        let mut cmd = Command::new(program);
        cmd.current_dir(&self.root)
            .env("CELLA_PGPORT", pg_port().to_string())
            .env("CELLA_ANALYTICS_PORT", analytics_port().to_string());
        cmd
    }

    /// A node tool from tools/.
    pub fn node(&self, tool: &str) -> Command {
        let mut cmd = self.cmd("node");
        cmd.arg(self.root.join("tools").join(tool));
        cmd
    }

    /// The shell, the org app's `SvelteKit` root.
    pub fn shell_dir(&self) -> PathBuf {
        self.root.join("apps/org/ts")
    }

    /// The landing site, an Astro site outside the feat tree.
    pub fn site_dir(&self) -> PathBuf {
        self.root.join("apps/site")
    }

    /// A binary of the shell's npm dependencies, run from the shell's directory.
    pub fn shell(&self, bin: &str) -> Command {
        let mut cmd = self.cmd("pnpm");
        cmd.current_dir(self.shell_dir()).args(["exec", bin]);
        cmd
    }

    /// The npm workspace, installed from the lockfile without the network;
    /// a package's was installed when it was built.
    pub fn install(&self, steps: &Steps) -> Result {
        if self.packaged {
            return Ok(());
        }
        let mut cmd = self.cmd("pnpm");
        cmd.args(["install", "--offline", "--silent"]);
        steps.run("install", &mut [cmd], quiet)
    }

    /// Where cella keeps its state: `CELLA_DATA`, else the checkout's
    /// `.data`, or, for a package, whose root is read-only, `.data` in the
    /// working directory; made absolute, since the tools cella runs start
    /// in the root.
    pub fn data(&self) -> PathBuf {
        let dir = match env::var_os("CELLA_DATA").filter(|d| !d.is_empty()) {
            Some(dir) => PathBuf::from(dir),
            None if self.packaged => PathBuf::from(".data"),
            None => return self.root.join(".data"),
        };
        std::path::absolute(&dir).unwrap_or(dir)
    }

    /// Refuses, in a package, what only a checkout does, such as building.
    pub fn checkout(&self, what: &str) -> Result {
        if self.packaged {
            return Err(Fail::new(format!(
                "{what} needs a checkout: this cella is the flake's package, built already"
            )));
        }
        Ok(())
    }
}

fn is_root(dir: &Path) -> bool {
    let manifest = fs::read_to_string(dir.join("Cargo.toml")).unwrap_or_default();
    manifest.contains("[workspace]") && dir.join("apps/org/feat.toml").is_file()
}
