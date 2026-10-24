use std::io::{self, Write};
use std::process::{Command, ExitStatus, Output};
use std::time::Instant;

/// A failed command: the exit code to leave with, and what to say, if the
/// failing tool has not said it already.
pub struct Fail {
    pub code: u8,
    pub msg: Option<String>,
}

impl Fail {
    pub fn new(msg: impl Into<String>) -> Self {
        Self { code: 1, msg: Some(msg.into()) }
    }

    fn status(s: ExitStatus) -> Self {
        let code = s.code().and_then(|c| u8::try_from(c).ok()).filter(|c| *c != 0);
        Self { code: code.unwrap_or(1), msg: None }
    }

    fn spawn(cmd: &Command, e: &io::Error) -> Self {
        let program = cmd.get_program().to_string_lossy();
        if e.kind() == io::ErrorKind::NotFound {
            return Self {
                code: 127,
                msg: Some(format!("`{program}` is not on PATH; run cella inside `nix develop`")),
            };
        }
        Self::new(format!("{program}: {e}"))
    }
}

pub type Result<T = ()> = std::result::Result<T, Fail>;

/// What a step prints after `ok`, read from its tools' standard output.
pub type Summary = fn(&str) -> Option<String>;

#[must_use]
pub fn quiet(_: &str) -> Option<String> {
    None
}

#[must_use]
pub fn last_line(out: &str) -> Option<String> {
    out.lines().rev().find(|l| !l.trim().is_empty()).map(str::to_owned)
}

/// Runs commands as named steps, one line each, or streams them.
pub struct Steps {
    pub verbose: bool,
}

impl Steps {
    /// Runs the commands in order as one step; the first failure stops it
    /// and its output is printed in full.
    pub fn run(&self, name: &str, cmds: &mut [Command], summary: Summary) -> Result {
        let start = Instant::now();
        if self.verbose {
            println!("== {name}");
            for cmd in cmds.iter_mut() {
                let status = cmd.status().map_err(|e| Fail::spawn(cmd, &e))?;
                if !status.success() {
                    eprintln!("{name:<22} FAIL");
                    return Err(Fail::status(status));
                }
            }
            println!("{name:<22} ok {:>5.1}s", start.elapsed().as_secs_f64());
            return Ok(());
        }
        // The space keeps a label longer than the column apart from its verdict.
        print!("{name:<22} ");
        let _ = io::stdout().flush();
        let mut stdout = String::new();
        for cmd in cmds.iter_mut() {
            let out = cmd.output().map_err(|e| {
                println!("FAIL");
                Fail::spawn(cmd, &e)
            })?;
            stdout.push_str(&String::from_utf8_lossy(&out.stdout));
            if !out.status.success() {
                println!("FAIL");
                dump(&out);
                return Err(Fail::status(out.status));
            }
        }
        let secs = start.elapsed().as_secs_f64();
        match summary(&stdout) {
            Some(s) => println!("ok {secs:>5.1}s  {s}"),
            None => println!("ok {secs:>5.1}s"),
        }
        Ok(())
    }

    /// Runs a command on the terminal, leaving with its exit code.
    pub fn exec(cmd: &mut Command) -> Result {
        let status = cmd.status().map_err(|e| Fail::spawn(cmd, &e))?;
        if status.success() {
            return Ok(());
        }
        Err(Fail::status(status))
    }

    /// Runs a command for its standard output, passing its standard error
    /// on; a failure prints its output.
    pub fn read(cmd: &mut Command) -> Result<String> {
        let out = cmd.output().map_err(|e| Fail::spawn(cmd, &e))?;
        if !out.status.success() {
            dump(&out);
            return Err(Fail::status(out.status));
        }
        let _ = io::stderr().write_all(&out.stderr);
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_owned())
    }

    /// Whether a command succeeds, its output discarded.
    pub fn ok(cmd: &mut Command) -> Result<bool> {
        let out = cmd.output().map_err(|e| Fail::spawn(cmd, &e))?;
        Ok(out.status.success())
    }
}

fn dump(out: &Output) {
    let mut err = io::stderr();
    let _ = err.write_all(&out.stdout);
    let _ = err.write_all(&out.stderr);
}
