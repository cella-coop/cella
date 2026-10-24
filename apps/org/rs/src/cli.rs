use std::path::PathBuf;

use clap::{Parser, Subcommand, ValueEnum};

/// Cella's one entry point: every development and production task.
#[derive(Parser)]
#[command(name = "cella", version, about)]
pub struct Cli {
    /// Stream each tool's output instead of one line per step
    #[arg(short, long, global = true)]
    pub verbose: bool,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// What a commit must pass: feat check, fixture check, types, cargo check and clippy
    Check {
        /// Run one part alone
        part: Option<Part>,

        /// Skip the feat check's SQL boundaries
        #[arg(long)]
        no_sql: bool,
    },

    /// The dev Postgres 18 cluster in .data/
    Db {
        #[command(subcommand)]
        command: Db,
    },

    /// The cella Postgres extension
    Ext {
        #[command(subcommand)]
        command: Ext,
    },

    /// Apply every feat's and graft's migrations, cascading down the tree
    Migrate {
        /// A database other than the dev cluster's, such as production's
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },

    /// Load a mock co-op from apps/org/fixtures
    Seed {
        /// The fixture's directory name, such as lanterne
        fixture: String,

        /// A database other than the dev cluster's
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },

    /// The Rust and tool tests, then each slice's tests and the e2e scenarios on fresh databases
    Test {
        #[command(subcommand)]
        only: Option<Test>,
    },

    /// The notary log
    Log {
        #[command(subcommand)]
        command: Log,
    },

    /// The scope's signing key
    Key {
        #[command(subcommand)]
        command: Key,
    },
}

#[derive(Clone, Copy, ValueEnum)]
pub enum Part {
    /// The feat tree's dependencies, imports, ops and SQL boundaries
    Feats,
    /// The mock co-ops balance and their links resolve
    Fixtures,
    /// The TypeScript type check
    Types,
    /// cargo check and clippy over the workspace
    Rust,
}

#[derive(Subcommand)]
pub enum Db {
    /// Build the extension, then start the cluster, or restart it to load a rebuilt one
    Start,
    /// Stop the cluster
    Stop,
    /// Whether the cluster runs, and where
    Status,
    /// Drop, recreate and migrate a database on the cluster, and seed it with --seed
    Reset {
        /// The database, by default the dev one
        #[arg(long)]
        db: Option<String>,

        /// Also load a mock co-op from apps/org/fixtures, such as lanterne
        #[arg(long, value_name = "FIXTURE")]
        seed: Option<String>,
    },
    /// psql on the dev database; arguments pass through
    Psql {
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
}

#[derive(Subcommand)]
pub enum Ext {
    /// Package the extension into .data/ext, where the dev cluster loads it
    Build,
}

#[derive(Subcommand)]
pub enum Test {
    /// The rule primitives' tests
    Rules,
    /// This CLI's tests
    Cli,
    /// The node tools' tests, such as the feat check's
    Tools,
    /// Each slice's own tests, or one slice's, on a database holding only its part of the tree; needs the dev cluster
    Slice {
        /// A feat or graft, such as transaction or circle-member
        name: Option<String>,
    },
    /// The scenarios across slices on a seeded Lanterne, or one by name; needs the dev cluster
    E2e {
        /// A scenario's file name in apps/org/ts/_e2e without .test.ts, such as admission
        name: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum Log {
    /// Recheck the log's chain, its receipts, every signature and the head
    Verify {
        /// A database other than the dev cluster's, such as production's
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum Key {
    /// Create a scope signing key file, readable by its owner only
    Init {
        /// Where to write it; an existing file is never overwritten
        path: PathBuf,
    },
}
