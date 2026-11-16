use std::fs;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};

use crate::analytics::{Shell, Target};
use crate::cli::Preview;
use crate::data;
use crate::db::{self, Dev};
use crate::key;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, last_line, quiet};

/// How `serve` serves: on which port, built or not, as a demo or not, and
/// against which database.
#[derive(Clone, Copy)]
pub struct Serve<'a> {
    pub port: u16,
    pub prod: bool,
    pub demo: bool,
    pub url: Option<&'a str>,
}

/// The shell against the dev database, or with `prod` the built server
/// against it or the database `url` names: starts the dev cluster if it
/// is stopped, applies any new migration, then runs until stopped. Dev
/// mode is Vite's dev server, whose sign-in page offers the fixture
/// members; `prod` builds the shell and runs it as a scope's server,
/// offering no one, or with `demo` a demo of a mock co-op, offering its
/// fixture members, each marked as a demo member. Either way members sign
/// in and sign every write with their own devices, and sessions are MACed
/// with `.data/session.key`.
pub fn serve(repo: &Repo, steps: &Steps, how: &Serve) -> Result {
    let Serve {
        port,
        prod,
        demo,
        url,
    } = *how;
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
        let mode = if demo {
            "production, a demo: its sign-in offers the fixture members"
        } else {
            "production"
        };
        println!("shell on http://127.0.0.1:{port}, {mode}, behind TLS that sets x-forwarded-proto");
        let mut node = dev.cmd("node");
        node.arg(repo.shell_dir().join("build"))
            .env("PORT", port.to_string())
            .env("HOST", "127.0.0.1")
            .env("PROTOCOL_HEADER", "x-forwarded-proto")
            .env("BODY_SIZE_LIMIT", "11M")
            .env_remove("CELLA_DEV")
            .env_remove("CELLA_DEMO");
        if demo {
            node.env("CELLA_DEMO", "1");
        }
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
    if repo.packaged {
        // A package's shell was built with it.
        return Ok(());
    }
    repo.install(steps)?;
    let mut vite = repo.shell("vite");
    vite.arg("build");
    steps.run("build", &mut [vite], last_line)?;
    println!("built {}", repo.shell_dir().join("build").display());
    Ok(())
}

/// The database a preview serves, a fresh Lanterne at each start.
const PREVIEW: &str = "cella_preview";

pub fn preview(repo: &Repo, steps: &Steps, command: Preview) -> Result {
    match command {
        Preview::Build { out } => preview_build(repo, steps, &preview_dir(repo, out)),
        Preview::Serve { port, from } => preview_serve(repo, steps, port, &preview_dir(repo, from)),
    }
}

/// Where a preview's build is copied, `.data/preview/build` unset.
fn preview_dir(repo: &Repo, dir: Option<PathBuf>) -> PathBuf {
    dir.unwrap_or_else(|| repo.data().join("preview/build"))
}

/// What a host's preview of main serves: the extension and the shell
/// built, the shell's build copied whole to `out`, beside a link to the
/// shell's `node_modules` its server imports from and a `package.json`
/// saying its files are modules, as the shell's own says of its build. The
/// copy is made beside `out` and moved into place, so a build never
/// writes under a preview that runs.
fn preview_build(repo: &Repo, steps: &Steps, out: &Path) -> Result {
    db::ext_build(repo, steps)?;
    build(repo, steps)?;
    let name = out
        .file_name()
        .ok_or_else(|| Fail::new(format!("{}: name a directory", out.display())))?
        .to_string_lossy();
    let parent = match out.parent() {
        Some(p) if !p.as_os_str().is_empty() => p.to_path_buf(),
        _ => PathBuf::from("."),
    };
    fs::create_dir_all(&parent).map_err(io(&parent))?;
    let next = parent.join(format!(".{name}.next"));
    let old = parent.join(format!(".{name}.old"));
    for dir in [&next, &old] {
        if dir.exists() {
            fs::remove_dir_all(dir).map_err(io(dir))?;
        }
    }
    copy(&repo.shell_dir().join("build"), &next)?;
    symlink(
        repo.shell_dir().join("node_modules"),
        next.join("node_modules"),
    )
    .map_err(io(&next))?;
    let manifest = next.join("package.json");
    if !manifest.exists() {
        fs::write(&manifest, "{ \"type\": \"module\" }\n").map_err(io(&manifest))?;
    }
    if out.exists() {
        fs::rename(out, &old).map_err(io(out))?;
    }
    fs::rename(&next, out).map_err(io(&next))?;
    if old.exists() {
        fs::remove_dir_all(&old).map_err(io(&old))?;
    }
    println!("preview built in {}", out.display());
    Ok(())
}

/// The preview `preview_build` left in `from`, on a fresh Lanterne: the
/// cluster started or restarted on the extension built, `cella_preview`
/// reset and seeded, the analytics shell on it, and the build served on it
/// in dev mode, whose sign-in offers the fixture members, until stopped.
/// Its keys being the fixture's, a host serves it behind a gate, never in
/// public.
fn preview_serve(repo: &Repo, steps: &Steps, port: u16, from: &Path) -> Result {
    let unbuilt = |what: &Path| {
        Fail::new(format!(
            "{} holds no build: run `cella preview build` first",
            what.display()
        ))
    };
    let entry = fs::canonicalize(from.join("index.js")).map_err(|_| unbuilt(from))?;
    let ext = db::ext_dir(repo);
    if !ext.is_dir() {
        return Err(unbuilt(&ext));
    }
    let lanterne = data::fixture(repo, "lanterne")?;
    let dev = Dev::new(repo);
    dev.load(steps, &ext)?;
    // Its shell attaches the database the reset drops, so it goes first.
    let shell = Shell::new(repo, None);
    shell.stop()?;
    repo.install(steps)?;
    steps.run(
        &format!("reset {PREVIEW}"),
        &mut dev.renew(PREVIEW, None, Some(&lanterne)),
        last_line,
    )?;
    shell.start(&Target::Dev(PREVIEW))?;
    let session = repo.data().join("session.key");
    key::session(&session)?;
    println!(
        "preview on http://127.0.0.1:{port}, dev mode, database {PREVIEW}: its sign-in offers the fixture members, so serve it behind a gate, never in public"
    );
    let mut node = dev.on(PREVIEW, "node");
    node.arg(entry)
        .env("PORT", port.to_string())
        .env("HOST", "127.0.0.1")
        .env("PROTOCOL_HEADER", "x-forwarded-proto")
        .env("BODY_SIZE_LIMIT", "11M")
        .env("CELLA_DEV", "1")
        .env("CELLA_SESSION_KEY_FILE", &session);
    shell.env(&mut node);
    Steps::exec(&mut node)
}

/// Copies a directory whole, its links as links.
fn copy(from: &Path, to: &Path) -> Result {
    fs::create_dir_all(to).map_err(io(to))?;
    for entry in fs::read_dir(from).map_err(io(from))? {
        let entry = entry.map_err(io(from))?;
        let (src, dst) = (entry.path(), to.join(entry.file_name()));
        let kind = entry.file_type().map_err(io(&src))?;
        if kind.is_dir() {
            copy(&src, &dst)?;
        } else if kind.is_symlink() {
            symlink(fs::read_link(&src).map_err(io(&src))?, &dst).map_err(io(&dst))?;
        } else {
            fs::copy(&src, &dst).map_err(io(&src))?;
        }
    }
    Ok(())
}

fn io(path: &Path) -> impl Fn(std::io::Error) -> Fail + '_ {
    move |e| Fail::new(format!("{}: {e}", path.display()))
}
