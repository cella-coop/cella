//! The `cella` Postgres extension: the notary and the guard primitives as
//! SQL. Its whole SQL surface is declared in [`surface`], each item a thin
//! wrapper over `cella-guards`; [`notary`] is the plumbing `submit` and
//! `verify_log` need to reach the log through SPI. No guard lives here.

use pgrx::guc::{GucContext, GucFlags, GucRegistry, GucSetting};
use pgrx::prelude::*;
use std::ffi::CString;

::pgrx::pg_module_magic!(name, version);

mod notary;
mod surface;
#[cfg(any(test, feature = "pg_test"))]
mod tests;
mod vault;

/// pgrx's test harness, which `cella test notary` runs: the cluster loads
/// the extension from `CELLA_NOTARY_TEST`, outside the read-only store, as
/// the dev cluster does, and signs with the TEST-ONLY keys written there.
/// The tests share one database, each in a session of its own, and each
/// opens by taking the tests' advisory lock, shared or, alone, exclusive.
#[cfg(test)]
pub mod pg_test {
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    fn dir() -> PathBuf {
        std::env::var_os("CELLA_NOTARY_TEST").map_or_else(
            || panic!("CELLA_NOTARY_TEST is not set: run `cella test notary`"),
            PathBuf::from,
        )
    }

    /// Runs on every test thread before the tests' lock is taken, so each
    /// key file is written whole to a file of this thread's own and renamed
    /// over the last: a test beside it never reads one empty or short.
    pub fn setup(_options: Vec<&str>) {
        let dir = dir();
        std::fs::create_dir_all(&dir).expect("the test directory");
        write_whole(&dir, "notary.key", &crate::tests::NOTARY_SEED);
        write_whole(&dir, "vault.key", &crate::tests::VAULT_KEY);
    }

    fn write_whole(dir: &Path, name: &str, bytes: &[u8]) {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        let part = dir.join(format!(".{name}.{}.{n}", std::process::id()));
        std::fs::write(&part, bytes).unwrap_or_else(|e| panic!("the {name} file: {e}"));
        std::fs::rename(&part, dir.join(name)).unwrap_or_else(|e| panic!("the {name} file: {e}"));
    }

    pub fn postgresql_conf_options() -> Vec<&'static str> {
        let dir = dir();
        let at = |name: &str| dir.join(name).display().to_string();
        [
            format!("extension_control_path = '$system:{}'", at("share")),
            format!("dynamic_library_path = '$libdir:{}'", at("lib")),
            "shared_preload_libraries = 'cella'".into(),
            format!("cella.key_file = '{}'", at("notary.key")),
            format!("cella.vault_key_file = '{}'", at("vault.key")),
        ]
        .into_iter()
        .map(|s| &*Box::leak(s.into_boxed_str()))
        .collect()
    }

    /// Every `#[pg_test]` opens by taking the tests' lock, `beside()` or
    /// `alone()`, so none runs beside the one that drops the extension.
    #[test]
    fn every_pg_test_takes_the_tests_lock() {
        for test in include_str!("tests.rs").split("#[pg_test").skip(1) {
            let (head, body) = test.split_once('{').expect("a test's body");
            let name = head
                .split_once("fn ")
                .map_or(head, |(_, n)| n)
                .trim_end_matches(|c: char| c == '(' || c == ')' || c.is_whitespace());
            let body = body.trim_start();
            assert!(
                body.starts_with("beside();") || body.starts_with("alone();"),
                "the test {name} opens without taking the tests' lock: begin it with `beside();`, or `alone();` if it drops what the others read"
            );
        }
    }
}

/// The scope's Ed25519 seed, 32 raw bytes in a file only the server reads.
pub(crate) static KEY_FILE: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// The vault's own key, 32 random bytes in a file only the server reads,
/// apart from the notary's seed: the wrap key sealing the vault's keys is
/// derived from it.
pub(crate) static VAULT_KEY_FILE: GucSetting<Option<CString>> =
    GucSetting::<Option<CString>>::new(None);

/// The vault key file before a rotation, read only to open what is still
/// sealed under it until `cella.vault_rewrap()` has moved it.
pub(crate) static VAULT_KEY_PREVIOUS: GucSetting<Option<CString>> =
    GucSetting::<Option<CString>>::new(None);

/// The vault key files of earlier rotations, comma-separated, kept until
/// no restore point older than their rotation is kept: the notary never
/// opens under them, and `cella backup` carries each.
pub(crate) static VAULT_KEYS_KEPT: GucSetting<Option<CString>> =
    GucSetting::<Option<CString>>::new(None);

/// A fixed verdict date, for fixtures and tests; unset, the notary reads
/// its clock once per transaction.
pub(crate) static CLOCK: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// The scope's address, such as `lanterne.example`, which every write
/// signature names so that it verifies in no other scope.
pub(crate) static SCOPE: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// The scope's timezone, such as `Europe/Paris`: the verdict date is the
/// day there, so a cutoff or a close falls on the co-op's day; unset, UTC.
pub(crate) static TIMEZONE: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// Whether state may be written outside a write: a superuser's, for the
/// migrations, which change the schema and its registries, and for a slice
/// test, which tests a slice's SQL below the notary. Off, every registered
/// state table refuses a row no submitting transaction writes.
pub(crate) static UNBOUND: GucSetting<bool> = GucSetting::<bool>::new(false);

#[pg_guard]
pub extern "C-unwind" fn _PG_init() {
    GucRegistry::define_string_guc(
        c"cella.key_file",
        c"The scope's Ed25519 seed file",
        c"32 raw bytes; set in postgresql.conf, readable only by the server",
        &KEY_FILE,
        GucContext::Sighup,
        GucFlags::SUPERUSER_ONLY,
    );
    GucRegistry::define_string_guc(
        c"cella.vault_key_file",
        c"The vault's key file, apart from the notary's",
        c"32 random bytes; set in postgresql.conf, readable only by the server",
        &VAULT_KEY_FILE,
        GucContext::Sighup,
        GucFlags::SUPERUSER_ONLY,
    );
    GucRegistry::define_string_guc(
        c"cella.vault_key_previous",
        c"The vault's key file before a rotation",
        c"set in postgresql.conf until cella.vault_rewrap() has moved every key",
        &VAULT_KEY_PREVIOUS,
        GucContext::Sighup,
        GucFlags::SUPERUSER_ONLY,
    );
    GucRegistry::define_string_guc(
        c"cella.vault_keys_kept",
        c"The vault's key files of earlier rotations, comma-separated",
        c"set in postgresql.conf until no restore point older than their rotation is kept; never opened under, carried by cella backup",
        &VAULT_KEYS_KEPT,
        GucContext::Sighup,
        GucFlags::SUPERUSER_ONLY,
    );
    GucRegistry::define_string_guc(
        c"cella.clock",
        c"A fixed verdict date, YYYY-MM-DD",
        c"for fixtures and tests; unset, submit reads the clock once per transaction",
        &CLOCK,
        GucContext::Suset,
        GucFlags::default(),
    );
    GucRegistry::define_string_guc(
        c"cella.scope",
        c"The scope's address, which every write signature names",
        c"set by a superuser, in postgresql.conf or on the database",
        &SCOPE,
        GucContext::Suset,
        GucFlags::default(),
    );
    GucRegistry::define_string_guc(
        c"cella.timezone",
        c"The scope's timezone, whose day is the verdict date",
        c"an IANA zone such as Europe/Paris, set by a superuser on the database; unset, UTC",
        &TIMEZONE,
        GucContext::Suset,
        GucFlags::default(),
    );
    GucRegistry::define_bool_guc(
        c"cella.unbound",
        c"Whether state may be written outside a write",
        c"a superuser's, for migrations and slice tests; off, a registered state table refuses a row no submitting transaction writes",
        &UNBOUND,
        GucContext::Suset,
        GucFlags::default(),
    );
}
