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
    /// What a commit must pass: feat check, fixture check, types, svelte-check, the pruned build of core alone, the brand check, the site check, cargo check and clippy
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

    /// The analytics shell: a read-only DuckDB server over the views the slices publish
    Analytics {
        #[command(subcommand)]
        command: Analytics,
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

    /// Back a database up into a new directory: its dump, the notary's and the vault's key files, and a manifest
    Backup {
        /// The directory to write; it must not exist
        dir: PathBuf,

        /// A database other than the dev cluster's, such as production's, on the host holding its key files
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },

    /// Restore a backup into a new database, its key files where the cluster reads them, then check the log verifies and the vault opens
    Restore {
        /// A directory `cella backup` wrote
        dir: PathBuf,

        /// The database to create on the dev cluster, by default the one backed up
        #[arg(long, conflicts_with = "url")]
        db: Option<String>,

        /// An empty database on another cluster, such as a new host's, to restore into
        #[arg(long, value_name = "URL")]
        url: Option<String>,

        /// The newest erasures the host keeps, a later backup's directory or its erasures.json, carried out again before the database opens; by default the backup's own
        #[arg(long, value_name = "PATH")]
        erasures: Option<PathBuf>,
    },

    /// Load a mock co-op from apps/org/fixtures
    Seed {
        /// The fixture's directory name, such as lanterne
        fixture: String,

        /// Play one e2e scenario's story into the dev database; reset before another
        #[arg(long, value_name = "NAME", conflicts_with = "url")]
        scenario: Vec<String>,

        /// A database other than the dev cluster's
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },

    /// Write a body or threads of comments into a feat's own folder, as the task feat's are; refused where it has them
    Scaffold {
        /// What to give the feat: its record's body, or threads of comments on it
        part: Scaffolded,

        /// The feat, by its name, such as project
        feat: String,
    },

    /// Bring a file from another tool into the scope as a member, each record through its signed write; --dry-run undoes them all
    Import {
        /// The kind of file: members, contacts, fec, invoices, toggl, harvest, projects or tasks
        kind: String,

        /// The file to import
        file: PathBuf,

        /// The member who imports it, by address; their fixture device signs, as the dev server does
        #[arg(long = "as", value_name = "ADDRESS")]
        actor: String,

        /// Make every write and undo them all, to see what would be created and what refused
        #[arg(long)]
        dry_run: bool,

        /// A database other than the dev cluster's
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },

    /// The shell on the dev database, its dev server or with --prod the built one; starts the cluster if needed
    Serve {
        /// The port it listens on, on localhost
        #[arg(long, default_value_t = 5173)]
        port: u16,

        /// Build the shell and run it as a scope's server, outside dev mode, behind TLS
        #[arg(long)]
        prod: bool,

        /// A database other than the dev cluster's, for --prod
        #[arg(long, value_name = "URL", requires = "prod")]
        url: Option<String>,
    },

    /// Build the shell for production into apps/org/ts/build
    Build,

    /// A preview of main for a host to serve behind a gate of its own: its build apart, served in dev mode on a fresh Lanterne
    Preview {
        #[command(subcommand)]
        command: Preview,
    },

    /// Write the brand's tokens, fonts, mark, wordmark and icons from packages/brand/house.json
    Brand,

    /// The landing site in apps/site: its dev server, its static build, or its release to cella.coop
    Site {
        #[command(subcommand)]
        command: Site,
    },

    /// The Rust and tool tests, the org app of core alone signed in to, then each slice's tests and the e2e scenarios on fresh databases
    Test {
        #[command(subcommand)]
        only: Option<Test>,
    },

    /// Fold a database's log into a fresh one migrated as the scope's, entry by entry, recording a checkpoint every so many entries; then its log verifies
    Fold {
        /// The database on the dev cluster whose log is folded
        db: String,

        /// The database to fold it into, made afresh unless --from resumes it
        #[arg(long, value_name = "NAME")]
        into: String,

        /// The entry to stop at, the end of a write; by default the log's head
        #[arg(long, value_name = "N")]
        to: Option<i64>,

        /// Resume the database folded into at its checkpoint at entry N, its state hashed again first
        #[arg(long, value_name = "N")]
        from: Option<i64>,

        /// How many entries apart the checkpoints are, each at the end of a write
        #[arg(long, value_name = "N", default_value_t = crate::fold::EVERY)]
        every: i64,

        /// Then compare the two databases' folded slices, by state hash and row for row
        #[arg(long)]
        compare: bool,
    },

    /// The notary log
    Log {
        #[command(subcommand)]
        command: Log,
    },

    /// The vault of personal data
    Vault {
        #[command(subcommand)]
        command: Vault,
    },

    /// The scope's signing key
    Key {
        #[command(subcommand)]
        command: Key,
    },
}

#[derive(Clone, Copy, ValueEnum)]
pub enum Scaffolded {
    /// The record's body column, its save, power, guard, fold and mount, and the block its page opens on
    Body,
    /// The comment, mention and reaction tables, post, resolve and react, the Inbox's mentions and the Activity's threads
    Comments,
}

#[derive(Clone, Copy, ValueEnum)]
pub enum Part {
    /// The feat tree's dependencies, imports, actions and SQL boundaries
    Feats,
    /// The mock co-ops balance, their links resolve, and they show every feature and every circle a slice of its own
    Fixtures,
    /// The TypeScript type check of the server layers and tools
    Types,
    /// svelte-check over the shell and every slice's client layers
    Shell,
    /// The org app of core alone: every slice above core pruned from the tree and the shell's composition root, installed, svelte-checked and built
    Pruned,
    /// The brand's generated files are what its house.json makes
    Brand,
    /// The landing site's copy check, astro check over it, its build, the figure fixture's, the diagrams' type check, then the site's tools' tests
    Site,
    /// cargo check and clippy over the workspace
    Rust,
    /// Every part but the site's
    Org,
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
pub enum Analytics {
    /// Start the shell on the dev database, or another, reading it as cella_analytics; waits until it answers
    Start {
        /// A database on the dev cluster other than the dev one
        #[arg(long, conflicts_with = "url")]
        db: Option<String>,

        /// A database by URL, such as production's, that logs in as cella_analytics
        #[arg(long, value_name = "URL")]
        url: Option<String>,

        /// The port it serves on, on localhost; CELLA_ANALYTICS_PORT, else CORPUS_PORT plus one, else 54343
        #[arg(long)]
        port: Option<u16>,
    },
    /// Stop the shell
    Stop {
        /// The port it serves on
        #[arg(long)]
        port: Option<u16>,
    },
    /// Whether the shell runs, and where
    Status {
        /// The port it serves on
        #[arg(long)]
        port: Option<u16>,
    },
    /// Run SQL in the shell, read-only as cella_analytics, or with --report a report through the port
    Query {
        /// The SQL, over the attached scope: scope.<schema>.<view>
        #[arg(required_unless_present = "report")]
        sql: Option<String>,

        /// A report definition in JSON, checked against the views the slices publish and run on one snapshot
        #[arg(long, value_name = "FILE", conflicts_with = "sql")]
        report: Option<PathBuf>,

        /// Print JSON rows instead of a table
        #[arg(long)]
        json: bool,

        /// The port it serves on
        #[arg(long)]
        port: Option<u16>,
    },
}

#[derive(Subcommand)]
pub enum Site {
    /// Astro's dev server, reloading on every change, until stopped
    Dev {
        /// The port it listens on, on localhost
        #[arg(long, default_value_t = 4321)]
        port: u16,
    },
    /// Build the site static into apps/site/dist
    Build {
        /// Refuse any text a draft still supplies: the site's every word the operator's
        #[arg(long)]
        release: bool,
    },
    /// Put the site main holds live at cella.coop: its release build, sent to the production host
    Release {
        /// Where it goes: an ssh host, whose forced command takes it, or an absolute path, a directory standing in for the host
        #[arg(long, default_value = "production")]
        to: String,
    },
    /// Build the figure fixture and take its four screenshots into apps/site/test
    Screenshots,
    /// Format the site's text and drafts, its pages and posts, with Prettier
    Fmt {
        /// Say which files it would change, and change none
        #[arg(long)]
        check: bool,
    },
    /// Vendor an Unsplash photo with its attribution
    Photo {
        #[command(subcommand)]
        command: SitePhoto,
    },
}

#[derive(Subcommand)]
pub enum SitePhoto {
    /// Download photos and record their Unsplash credits, skipping one already vendored
    Add {
        #[arg(required = true)]
        urls: Vec<String>,
        #[arg(long)]
        name: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum Ext {
    /// Package the extension into .data/ext, where the dev cluster loads it
    Build,
}

#[derive(Subcommand)]
pub enum Test {
    /// The guard primitives' tests
    Guards,
    /// This CLI's tests
    Cli,
    /// The notary's own tests, in Postgres: signature, nonce, keyring and chain
    Notary,
    /// The node tools' tests, such as the feat check's
    Tools,
    /// The org app of core alone, built as `cella check pruned` builds it, on a database migrated with core's SQL alone, served and signed in to; needs the dev cluster
    Pruned,
    /// Each slice's own tests, or one slice's, on a database holding only its part of the tree; needs the dev cluster
    Slice {
        /// A feat or graft, such as transaction or membership-motion, or a library of the app's core with tests, such as circle
        name: Option<String>,
    },
    /// The scenarios across slices on a seeded Lanterne, or one by name; needs the dev cluster
    E2e {
        /// A scenario's file name in apps/org/ts/_e2e without .test.ts, such as admission
        name: Option<String>,

        /// The workers running scenarios at once, each on a database of its own; CELLA_E2E_JOBS unset, else one for each two cores the load leaves idle, at most three and at least one
        #[arg(long, short)]
        jobs: Option<usize>,
    },
    /// The fold's scale tier: Lanterne grown to a generated scope, folded in memory that does not grow with its log and re-folded from its latest checkpoint within its bound; slow, so no other target runs it; needs the dev cluster
    Scale {
        /// The members the scope grows to
        #[arg(long, default_value_t = 10_000)]
        members: usize,

        /// The years it grows over, from 2027
        #[arg(long, default_value_t = 20)]
        years: u32,

        /// Keep its two databases when it ends, which it drops otherwise, passed or failed
        #[arg(long)]
        keep: bool,
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
pub enum Vault {
    /// Erase the restricted personal data whose legal clock has run out: payroll after five years, receipts and books after ten
    Sweep {
        /// A database other than the dev cluster's, such as production's
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },
    /// Seal every vault key under cella.vault_key_file's wrap key, moving those still under cella.vault_key_previous
    Rewrap {
        /// A database other than the dev cluster's, such as production's
        #[arg(long, value_name = "URL")]
        url: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum Key {
    /// Create a scope signing key file, or with --vault a vault key file, readable by its owner only
    Init {
        /// Where to write it; an existing file is never overwritten
        path: PathBuf,

        /// A vault key, 32 random bytes apart from the notary's, as cella.vault_key_file reads it
        #[arg(long)]
        vault: bool,
    },
}

#[derive(Subcommand)]
pub enum Preview {
    /// Build the extension and the shell, then copy the shell's build whole to a directory of its own, apart from a preview that runs
    Build {
        /// Where the copy goes, .data/preview/build unset
        #[arg(long, value_name = "DIR")]
        out: Option<PathBuf>,
    },
    /// Start or restart the cluster on the extension built, reset cella_preview to a fresh Lanterne, then serve the build on it in dev mode, its sign-in offering the fixture members, until stopped
    Serve {
        /// The port it listens on, on 127.0.0.1
        #[arg(long, default_value_t = 4173)]
        port: u16,

        /// The directory `preview build` wrote, .data/preview/build unset
        #[arg(long, value_name = "DIR")]
        from: Option<PathBuf>,
    },
}
