//! Every command in the tree answers `--help`, through the built binary.

use std::process::Command;

use cella_cli::cli::Cli;
use clap::CommandFactory;

fn paths(cmd: &clap::Command, prefix: &[String], out: &mut Vec<Vec<String>>) {
    out.push(prefix.to_vec());
    for sub in cmd.get_subcommands().filter(|s| s.get_name() != "help") {
        let mut path = prefix.to_vec();
        path.push(sub.get_name().to_owned());
        paths(sub, &path, out);
    }
}

#[test]
fn tree_is_consistent() {
    Cli::command().debug_assert();
}

#[test]
fn every_command_has_help() {
    let mut all = Vec::new();
    paths(&Cli::command(), &[], &mut all);
    assert!(all.len() > 10, "the tree has {} commands", all.len());
    for path in all {
        let out = Command::new(env!("CARGO_BIN_EXE_cella"))
            .args(&path)
            .arg("--help")
            .output()
            .unwrap();
        let text = String::from_utf8_lossy(&out.stdout);
        assert!(
            out.status.success(),
            "cella {} --help failed",
            path.join(" ")
        );
        assert!(
            text.contains("Usage: cella"),
            "cella {} --help: {text}",
            path.join(" ")
        );
    }
}

#[test]
fn unknown_command_fails() {
    let out = Command::new(env!("CARGO_BIN_EXE_cella"))
        .arg("frobnicate")
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(2));
}

#[test]
fn key_init_is_owner_only_and_never_overwrites() {
    use std::os::unix::fs::PermissionsExt;

    let dir = std::env::temp_dir().join(format!("cella-key-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("scope.key");
    let run = || {
        Command::new(env!("CARGO_BIN_EXE_cella"))
            .args(["key", "init"])
            .arg(&path)
            .output()
            .unwrap()
    };
    assert!(run().status.success());
    let meta = std::fs::metadata(&path).unwrap();
    assert_eq!(meta.len(), 32);
    assert_eq!(meta.permissions().mode() & 0o777, 0o600);
    let again = run();
    assert!(!again.status.success());
    assert!(String::from_utf8_lossy(&again.stderr).contains("never overwritten"));
    std::fs::remove_dir_all(&dir).unwrap();
}
