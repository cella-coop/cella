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
    let seed = random();
    let key = Key::from_seed(seed.as_ref()).map_err(|e| Fail::new(e.to_string()))?;
    write(path, seed.as_ref())?;
    println!("key {}, public {}", path.display(), hex(&key.public()));
    Ok(())
}

/// Writes a new vault key, the 32 random bytes `cella.vault_key_file`
/// reads, apart from the notary's seed: owner-only and never over an
/// existing file.
pub fn vault(path: &Path) -> Result {
    write(path, random().as_ref())?;
    println!("vault key {}", path.display());
    Ok(())
}

fn random() -> Zeroizing<[u8; 32]> {
    let mut bytes = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(bytes.as_mut());
    bytes
}

/// Writes a key file owner-only, never over an existing file.
pub fn write(path: &Path, bytes: &[u8]) -> Result {
    let fail = |e: std::io::Error| {
        if e.kind() == ErrorKind::AlreadyExists {
            return Fail::new(format!("{} exists; a key is never overwritten", path.display()));
        }
        Fail::new(format!("{}: {e}", path.display()))
    };
    let mut file = OpenOptions::new().write(true).create_new(true).mode(0o600).open(path).map_err(fail)?;
    file.write_all(bytes).and_then(|()| file.sync_all()).map_err(fail)
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
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| Fail::new(format!("{}: {e}", dir.display())))?;
    }
    write(path, random().as_ref())
}

/// The analytics shell's token, 32 random bytes in hex, which the shell
/// answers to and its clients send: made owner-only on first use, then kept.
pub fn token(path: &Path) -> Result {
    write(path, hex(random().as_ref()).as_bytes())
}
