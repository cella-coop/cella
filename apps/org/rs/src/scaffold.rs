//! `cella scaffold body|comments <feat>`: a feat's body or threads written
//! into its own folder by `tools/scaffold.mjs`, then the workspace
//! installed, since the feat may now depend on core body.

use crate::cli::Scaffolded;
use crate::repo::Repo;
use crate::run::{Result, Steps};

pub fn run(repo: &Repo, steps: &Steps, part: Scaffolded, feat: &str) -> Result {
    let mut cmd = repo.node("scaffold.mjs");
    cmd.arg(match part {
        Scaffolded::Body => "body",
        Scaffolded::Comments => "comments",
    })
    .arg(feat)
    .arg(&repo.root);
    Steps::exec(&mut cmd)?;
    repo.install(steps)
}
