use std::process::ExitCode;

use cella_cli::cli::Cli;
use cella_cli::dispatch;
use clap::Parser;

fn main() -> ExitCode {
    let cli = Cli::parse();
    match dispatch(cli.command, cli.verbose) {
        Ok(()) => ExitCode::SUCCESS,
        Err(fail) => {
            if let Some(msg) = fail.msg {
                eprintln!("cella: {msg}");
            }
            ExitCode::from(fail.code)
        }
    }
}
