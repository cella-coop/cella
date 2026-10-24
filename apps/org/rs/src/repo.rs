use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::run::{Fail, Result, Steps, quiet};

/// The repository: the Cargo workspace root that holds the org app.
pub struct Repo {
    pub root: PathBuf,
}

impl Repo {
    /// Walks up from the working directory to the workspace root, falling
    /// back to the checkout this binary was built from, so cella runs the
    /// same from any directory.
    pub fn find() -> Result<Self> {
        let here = env::current_dir().ok();
        let found = here.iter().flat_map(|d| d.ancestors()).find(|d| is_root(d));
        if let Some(root) = found {
            return Ok(Self { root: root.to_path_buf() });
        }
        let built = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        if is_root(&built) {
            let root = built.canonicalize().map_err(|e| Fail::new(format!("{}: {e}", built.display())))?;
            return Ok(Self { root });
        }
        Err(Fail::new("no cella workspace here or above, nor where this binary was built"))
    }

    /// A command run from the workspace root.
    pub fn cmd(&self, program: &str) -> Command {
        let mut cmd = Command::new(program);
        cmd.current_dir(&self.root);
        cmd
    }

    /// A node tool from tools/.
    pub fn node(&self, tool: &str) -> Command {
        let mut cmd = self.cmd("node");
        cmd.arg(self.root.join("tools").join(tool));
        cmd
    }

    /// The shell, the org app's SvelteKit root.
    pub fn shell_dir(&self) -> PathBuf {
        self.root.join("apps/org/ts")
    }

    /// A binary of the shell's npm dependencies, run from the shell's directory.
    pub fn shell(&self, bin: &str) -> Command {
        let mut cmd = Command::new("pnpm");
        cmd.current_dir(self.shell_dir()).args(["exec", bin]);
        cmd
    }

    /// The npm workspace, installed from the lockfile without the network.
    pub fn install(&self, steps: &Steps) -> Result {
        let mut cmd = self.cmd("pnpm");
        cmd.args(["install", "--offline", "--silent"]);
        steps.run("install", &mut [cmd], quiet)
    }

    pub fn data(&self) -> PathBuf {
        self.root.join(".data")
    }
}

fn is_root(dir: &Path) -> bool {
    let manifest = fs::read_to_string(dir.join("Cargo.toml")).unwrap_or_default();
    manifest.contains("[workspace]") && dir.join("apps/org/feat.toml").is_file()
}
