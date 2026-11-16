use crate::cli::Demo;
use crate::data;
use crate::repo::Repo;
use crate::run::{Result, Steps, last_line};

/// The mock co-op every demo is founded as.
const FIXTURE: &str = "lanterne";

/// The demo: its template, built from nothing on a cluster whose keys are
/// the demo's own, and the copies of it each served scope is made from
/// (`tools/demo.mjs`). Nobody is served the template itself: it is closed
/// to every connection once built, and a copy is a database of its own,
/// made from it by `CREATE DATABASE … TEMPLATE` with the settings the
/// template's database and roles carry there.
pub fn run(repo: &Repo, steps: &Steps, command: Demo) -> Result {
    match command {
        Demo::Template {
            url,
            scenario,
            again,
        } => template(repo, steps, &url, &scenario, again),
        Demo::Copy { name, url, replace } => {
            let mut cmd = tool(repo, &url);
            cmd.args(["copy", &name]);
            if replace {
                cmd.arg("--replace");
            }
            steps.run(&format!("copy {name}"), &mut [cmd], last_line)
        }
    }
}

/// The template made afresh at `url`: dropped if it is there, created,
/// migrated, Lanterne founded in it and the scenario's story played on it
/// through the notary and the guards, as `cella seed --scenario` plays it;
/// then marked a template, closed to connections and labelled with the
/// build and the story that made it. A template this build made with this
/// story already is left as it is, unless `again`.
fn template(repo: &Repo, steps: &Steps, url: &str, scenario: &str, again: bool) -> Result {
    let made = made_by(repo, scenario);
    if !again {
        let mut label = tool(repo, url);
        label.arg("label");
        if Steps::read(&mut label)?.trim() == made {
            println!("the template is built already, by this build with the {scenario} story");
            return Ok(());
        }
    }
    let mut renew = tool(repo, url);
    renew.arg("renew");
    steps.run("renew template", &mut [renew], last_line)?;
    data::migrate(repo, steps, Some(url))?;
    data::seed(repo, steps, FIXTURE, Some(url), &[scenario.to_owned()])?;
    let mut close = tool(repo, url);
    close.args(["close", "--made-by"]).arg(made);
    steps.run("close template", &mut [close], last_line)
}

/// What a template is labelled with: the tree that built it and the story
/// it plays, so a new build or another story is a template to build again.
fn made_by(repo: &Repo, scenario: &str) -> String {
    format!(
        "cella demo template: {} {FIXTURE} {scenario}",
        repo.root.display()
    )
}

fn tool(repo: &Repo, url: &str) -> std::process::Command {
    let mut cmd = repo.node("demo.mjs");
    cmd.env("DATABASE_URL", url);
    cmd
}
