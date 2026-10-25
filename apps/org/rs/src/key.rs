use std::fmt::Write as _;
use std::fs::OpenOptions;
use std::io::{ErrorKind, Write};
use std::os::unix::fs::OpenOptionsExt;
use std::path::Path;

use cella_rules::log::Key;
use rand_core::{OsRng, RngCore};
use zeroize::Zeroizing;

use crate::run::{Fail, Result};

/// Writes a new scope signing key, a 32-byte Ed25519 seed as the notary's
/// `cella.key_file` reads it, owner-only and never over an existing file,
/// and prints its public key.
pub fn create(path: &Path) -> Result {
    let mut seed = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(seed.as_mut());
    let key = Key::from_seed(seed.as_ref()).map_err(|e| Fail::new(e.to_string()))?;
    let fail = |e: std::io::Error| {
        if e.kind() == ErrorKind::AlreadyExists {
            return Fail::new(format!("{} exists; a key is never overwritten", path.display()));
        }
        Fail::new(format!("{}: {e}", path.display()))
    };
    let mut file = OpenOptions::new().write(true).create_new(true).mode(0o600).open(path).map_err(fail)?;
    file.write_all(seed.as_ref()).and_then(|()| file.sync_all()).map_err(fail)?;
    println!("key {}, public {}", path.display(), hex(&key.public()));
    Ok(())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut s, b| {
        let _ = write!(s, "{b:02x}");
        s
    })
}

/// The shell's session key, 32 random bytes the server MACs its sessions
/// with: made owner-only on first use, then kept, so sessions outlive a
/// restart.
pub fn session(path: &Path) -> Result {
    if path.exists() {
        return Ok(());
    }
    let mut bytes = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(bytes.as_mut());
    let fail = |e: std::io::Error| Fail::new(format!("{}: {e}", path.display()));
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(fail)?;
    }
    let mut file = OpenOptions::new().write(true).create_new(true).mode(0o600).open(path).map_err(fail)?;
    file.write_all(bytes.as_ref()).and_then(|()| file.sync_all()).map_err(fail)
}
