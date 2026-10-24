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

/// The scope's Ed25519 seed, 32 raw bytes in a file only the server reads.
pub(crate) static KEY_FILE: GucSetting<Option<CString>> = GucSetting::<Option<CString>>::new(None);

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
