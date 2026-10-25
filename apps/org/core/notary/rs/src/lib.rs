//! The `cella` Postgres extension: the notary and the rule primitives as
//! SQL. Its whole SQL surface is declared in [`surface`], each item a thin
//! wrapper over `cella-rules`; [`notary`] is the plumbing `submit` and
//! `verify_log` need to reach the log through SPI. No rule lives here.

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
#[cfg(test)]
pub mod pg_test {
    use std::path::PathBuf;

    fn dir() -> PathBuf {
        std::env::var_os("CELLA_NOTARY_TEST").map_or_else(|| panic!("CELLA_NOTARY_TEST is not set: run `cella test notary`"), PathBuf::from)
    }

    pub fn setup(_options: Vec<&str>) {
        let dir = dir();
        std::fs::create_dir_all(&dir).expect("the test directory");
        std::fs::write(dir.join("notary.key"), crate::tests::NOTARY_SEED).expect("the notary's key file");
        std::fs::write(dir.join("vault.key"), crate::tests::VAULT_KEY).expect("the vault's key file");
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
}

/// The scope's Ed25519 seed, 32 raw bytes in a file only the server reads.
pub(crate) static KEY_FILE: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// The vault's own key, 32 random bytes in a file only the server reads,
/// apart from the notary's seed: the wrap key sealing the vault's keys is
/// derived from it.
pub(crate) static VAULT_KEY_FILE: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// The vault key file before a rotation, read only to open what is still
/// sealed under it until `cella.vault_rewrap()` has moved it.
pub(crate) static VAULT_KEY_PREVIOUS: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// A fixed verdict date, for fixtures and tests; unset, the notary reads
/// its clock once per transaction.
pub(crate) static CLOCK: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

/// The scope's address, such as `lanterne.example`, which every write
/// signature names so that it verifies in no other scope.
pub(crate) static SCOPE: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

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
}
