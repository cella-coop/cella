use crate::analytics::{Shell, Target};
use crate::data;
use crate::db::Dev;
use crate::key;
use crate::repo::Repo;
use crate::run::{Result, Steps, last_line, quiet};

/// The shell against the dev database, or with `prod` the built server
/// against it or the database `url` names: starts the dev cluster if it
/// is stopped, applies any new migration, then runs until stopped. Dev
/// mode is Vite's dev server, whose sign-in page offers the fixture
/// members; `prod` builds the shell and runs it as a scope's server,
/// offering no one. Either way members sign in and sign every write with
/// their own devices, and sessions are MACed with `.data/session.key`.
pub fn serve(repo: &Repo, steps: &Steps, port: u16, prod: bool, url: Option<&str>) -> Result {
    let dev = Dev::new(repo);
    if url.is_none() {
        if !dev.running()? {
            dev.start(steps)?;
        }
        Shell::new(repo, None).start(&Target::Dev(&dev.db))?;
        let mut scope = dev.cmd("psql");
        scope.args([
            "-X",
            "-q",
            "-t",
            "-A",
            "-c",
            "SELECT current_setting('cella.scope', true)",
        ]);
        data::migrate(repo, steps, None)?;
        if Steps::read(&mut scope)?.is_empty() {
            println!(
                "the dev database names no scope: seed it with `cella db reset --seed lanterne`"
            );
        }
    } else {
        data::migrate(repo, steps, url)?;
    }
    let session = repo.data().join("session.key");
    key::session(&session)?;
    let mut server = if prod {
        build(repo, steps)?;
        println!(
            "shell on http://127.0.0.1:{port}, production, behind TLS that sets x-forwarded-proto"
        );
        let mut node = dev.cmd("node");
        node.arg(repo.shell_dir().join("build"))
            .env("PORT", port.to_string())
            .env("HOST", "127.0.0.1")
            .env("PROTOCOL_HEADER", "x-forwarded-proto")
            .env("BODY_SIZE_LIMIT", "11M")
            .env_remove("CELLA_DEV");
        node
    } else {
        let mut sync = repo.shell("svelte-kit");
        sync.arg("sync");
        steps.run("sync", &mut [sync], quiet)?;
        println!(
            "shell on http://localhost:{port}, dev mode, database {}",
            dev.db
        );
        let mut vite = dev.cmd("pnpm");
        vite.current_dir(repo.shell_dir())
            .args(["exec", "vite", "dev", "--strictPort", "--port"])
            .arg(port.to_string())
            .env("CELLA_DEV", "1");
        vite
    };
    server.env("CELLA_SESSION_KEY_FILE", &session);
    Shell::new(repo, None).env(&mut server);
    if let Some(url) = url {
        server.env("DATABASE_URL", url);
    }
    Steps::exec(&mut server)
}

/// The shell built for production by adapter-node into `apps/org/ts/build`,
/// a Node server that is not in dev mode, which `serve --prod` runs.
pub fn build(repo: &Repo, steps: &Steps) -> Result {
    repo.install(steps)?;
    let mut vite = repo.shell("vite");
    vite.arg("build");
    steps.run("build", &mut [vite], last_line)?;
    println!("built {}", repo.shell_dir().join("build").display());
    Ok(())
}
