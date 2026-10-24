//! Disk-backed cell identity storage — `<dir>/.private/keypair.seed`
//! plus `<dir>/.private/scheme`.
//!
//! The seed is 32 raw bytes, no encoding, mode `0600` on Unix; the scheme
//! marker names the signature scheme the seed expands into (missing marker
//! = `ed25519`, the pre-PQ legacy; a marker that is there but cannot be
//! read, or names no scheme, is an error). Missing seed = the cell is
//! read-only on this host.
//!
//! Every app that needs to sign into a cell's log (host provisioning
//! decisions, member admissions, composition edges) depends on this lib
//! rather than on any particular app — keystore is runtime, not an
//! app's business logic.
//!
//! corpus:article/architecture

#![warn(missing_docs)]

use std::io::{self, Write as _};
use std::path::{Path, PathBuf};

use std::str::FromStr as _;

use cella_crypto::{Identity, SigScheme};
use thiserror::Error;

const PRIVATE_DIR: &str = ".private";
const SEED_FILE: &str = "keypair.seed";
const SCHEME_FILE: &str = "scheme";
const SEED_LEN: usize = 32;

/// Errors from the keystore.
#[derive(Debug, Error)]
pub enum KeystoreError {
    /// Filesystem I/O failure.
    #[error("io at {path}: {source}")]
    Io {
        /// Path we were acting on.
        path: PathBuf,
        /// Underlying I/O error.
        #[source]
        source: io::Error,
    },
    /// Seed file is the wrong size.
    #[error("{path}: expected {expected} bytes, got {actual}")]
    BadSeedLen {
        /// File we read.
        path: PathBuf,
        /// Expected length.
        expected: usize,
        /// Actual length.
        actual: usize,
    },
    /// Scheme marker holds an unrecognized value.
    #[error("{path}: unrecognized scheme marker {value:?}")]
    BadScheme {
        /// File we read.
        path: PathBuf,
        /// What the marker actually said.
        value: String,
    },
}

/// `<cell>/.private` — where all private material lives.
#[must_use]
pub fn private_dir(cell_dir: &Path) -> PathBuf {
    cell_dir.join(PRIVATE_DIR)
}

/// `<cell>/.private/keypair.seed`.
#[must_use]
pub fn seed_path(cell_dir: &Path) -> PathBuf {
    private_dir(cell_dir).join(SEED_FILE)
}

/// `<cell>/.private/scheme` — the signature scheme the seed expands into.
#[must_use]
pub fn scheme_path(cell_dir: &Path) -> PathBuf {
    private_dir(cell_dir).join(SCHEME_FILE)
}

/// Write the identity's seed + scheme marker to disk (creates `.private/`
/// if needed, sets mode 0600 on Unix).
///
/// Both files land via write-to-temp + rename, **marker first**: a crash
/// between the two writes then leaves a marker with no seed (a loud load
/// failure), never a seed with no marker — which `load()` would silently
/// read back as a legacy Ed25519 cell, i.e. a different identity.
pub fn save(cell_dir: &Path, identity: &Identity) -> Result<(), KeystoreError> {
    let dir = private_dir(cell_dir);
    std::fs::create_dir_all(&dir).map_err(|e| KeystoreError::Io {
        path: dir.clone(),
        source: e,
    })?;
    set_owner_only(&dir, 0o700).map_err(|e| KeystoreError::Io {
        path: dir.clone(),
        source: e,
    })?;
    write_atomic(
        &scheme_path(cell_dir),
        identity.scheme().as_str().as_bytes(),
    )?;
    write_atomic(&seed_path(cell_dir), identity.seed_bytes().as_slice())?;
    Ok(())
}

/// Write `bytes` to `path` via a same-directory temp file + rename, with
/// owner-only permissions applied before any content lands.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), KeystoreError> {
    let io_err = |e: io::Error| KeystoreError::Io {
        path: path.to_path_buf(),
        source: e,
    };
    let tmp = path.with_extension("tmp");
    let mut file = create_owner_only(&tmp).map_err(io_err)?;
    file.write_all(bytes).map_err(io_err)?;
    drop(file);
    std::fs::rename(&tmp, path).map_err(io_err)?;
    Ok(())
}

/// Open `path` for writing, empty and owner-only (`0600` on Unix) before a
/// byte is written to it. The open's mode covers a file it creates; a stale
/// temp file a crashed save left behind keeps its own mode, so the mode is
/// set again on the open file.
#[cfg(unix)]
fn create_owner_only(path: &Path) -> io::Result<std::fs::File> {
    use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
    let file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)?;
    file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
    Ok(file)
}

#[cfg(not(unix))]
fn create_owner_only(path: &Path) -> io::Result<std::fs::File> {
    std::fs::File::create(path)
}

/// Load the identity from `.private/keypair.seed` + `.private/scheme`
/// (a missing marker means a legacy Ed25519 seed; one that is there but
/// cannot be read is [`KeystoreError::Io`], and one naming no scheme,
/// UTF-8 or not, is [`KeystoreError::BadScheme`]).
pub fn load(cell_dir: &Path) -> Result<Identity, KeystoreError> {
    let path = seed_path(cell_dir);
    let bytes = std::fs::read(&path).map_err(|e| KeystoreError::Io {
        path: path.clone(),
        source: e,
    })?;
    if bytes.len() != SEED_LEN {
        return Err(KeystoreError::BadSeedLen {
            path,
            expected: SEED_LEN,
            actual: bytes.len(),
        });
    }
    let mut seed = [0u8; SEED_LEN];
    seed.copy_from_slice(&bytes);
    let marker = scheme_path(cell_dir);
    let scheme = match std::fs::read(&marker) {
        Ok(raw) => std::str::from_utf8(&raw)
            .ok()
            .and_then(|s| SigScheme::from_str(s).ok())
            .ok_or_else(|| KeystoreError::BadScheme {
                path: marker.clone(),
                value: String::from_utf8_lossy(&raw).trim().to_string(),
            })?,
        // Only an absent marker is the legacy: read as Ed25519, a marker
        // that is there but unreadable would load a different identity.
        Err(e) if e.kind() == io::ErrorKind::NotFound => SigScheme::Ed25519,
        Err(e) => {
            return Err(KeystoreError::Io {
                path: marker,
                source: e,
            });
        }
    };
    Ok(Identity::from_seed(scheme, seed))
}

#[cfg(unix)]
fn set_owner_only(path: &Path, mode: u32) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path)?.permissions();
    perms.set_mode(mode);
    std::fs::set_permissions(path, perms)
}

#[cfg(not(unix))]
fn set_owner_only(_path: &Path, _mode: u32) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn save_then_load_round_trips() {
        let tmp = tempdir().unwrap();
        let dir = tmp.path().join("c");
        std::fs::create_dir_all(&dir).unwrap();
        let id = Identity::generate();
        save(&dir, &id).unwrap();
        let loaded = load(&dir).unwrap();
        assert_eq!(*id.seed_bytes(), *loaded.seed_bytes());
        assert_eq!(id.scheme(), loaded.scheme());
        assert_eq!(id.public_form(), loaded.public_form());
    }

    #[test]
    fn missing_scheme_marker_means_legacy_ed25519() {
        let tmp = tempdir().unwrap();
        let dir = tmp.path().join("c");
        std::fs::create_dir_all(&dir).unwrap();
        let id = Identity::generate_ed25519();
        save(&dir, &id).unwrap();
        std::fs::remove_file(scheme_path(&dir)).unwrap();
        let loaded = load(&dir).unwrap();
        assert_eq!(loaded.scheme(), cella_crypto::SigScheme::Ed25519);
        assert_eq!(id.public_form(), loaded.public_form());
    }

    #[test]
    fn load_missing_errors() {
        let tmp = tempdir().unwrap();
        let err = load(tmp.path()).unwrap_err();
        assert!(matches!(err, KeystoreError::Io { .. }));
    }

    #[test]
    fn corrupt_scheme_marker_errors() {
        let tmp = tempdir().unwrap();
        let dir = tmp.path().join("c");
        std::fs::create_dir_all(&dir).unwrap();
        save(&dir, &Identity::generate()).unwrap();
        std::fs::write(scheme_path(&dir), "rot13").unwrap();
        let err = load(&dir).unwrap_err();
        assert!(matches!(err, KeystoreError::BadScheme { ref value, .. } if value == "rot13"));
    }

    #[test]
    fn unreadable_scheme_marker_errors_rather_than_reading_as_legacy() {
        let tmp = tempdir().unwrap();
        let dir = tmp.path().join("c");
        std::fs::create_dir_all(&dir).unwrap();
        save(&dir, &Identity::generate()).unwrap();
        // There, and unreadable to anyone: a directory in the marker's place.
        std::fs::remove_file(scheme_path(&dir)).unwrap();
        std::fs::create_dir(scheme_path(&dir)).unwrap();
        let err = load(&dir).unwrap_err();
        assert!(matches!(err, KeystoreError::Io { ref path, .. } if *path == scheme_path(&dir)));
    }

    #[test]
    fn non_utf8_scheme_marker_is_a_bad_scheme() {
        let tmp = tempdir().unwrap();
        let dir = tmp.path().join("c");
        std::fs::create_dir_all(&dir).unwrap();
        save(&dir, &Identity::generate()).unwrap();
        std::fs::write(scheme_path(&dir), [0xff, 0xfe, b'm', b'l']).unwrap();
        let err = load(&dir).unwrap_err();
        assert!(matches!(err, KeystoreError::BadScheme { .. }));
    }

    #[test]
    fn a_key_file_is_owner_only_before_its_bytes_land() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let tmp = tempdir().unwrap();
            // A crashed save's temp file, world-readable and holding a seed.
            let stale = tmp.path().join("keypair.tmp");
            std::fs::write(&stale, b"an older seed").unwrap();
            std::fs::set_permissions(&stale, std::fs::Permissions::from_mode(0o644)).unwrap();
            let meta = create_owner_only(&stale).unwrap().metadata().unwrap();
            assert_eq!(meta.permissions().mode() & 0o777, 0o600);
            assert_eq!(meta.len(), 0);
            let fresh = tmp.path().join("scheme.tmp");
            let meta = create_owner_only(&fresh).unwrap().metadata().unwrap();
            assert_eq!(meta.permissions().mode() & 0o777, 0o600);
        }
    }

    #[test]
    fn seed_file_is_owner_only() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let tmp = tempdir().unwrap();
            let dir = tmp.path().join("c");
            std::fs::create_dir_all(&dir).unwrap();
            save(&dir, &Identity::generate()).unwrap();
            let mode = std::fs::metadata(seed_path(&dir))
                .unwrap()
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600);
        }
    }

    #[test]
    fn load_wrong_length_errors() {
        let tmp = tempdir().unwrap();
        let dir = tmp.path().join("c");
        std::fs::create_dir_all(private_dir(&dir)).unwrap();
        std::fs::write(seed_path(&dir), b"too short").unwrap();
        let err = load(&dir).unwrap_err();
        assert!(matches!(err, KeystoreError::BadSeedLen { .. }));
    }
}
