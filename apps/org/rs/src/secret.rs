use std::process::{Command, Stdio};

use zeroize::Zeroizing;

use crate::repo::Repo;
use crate::run::{Fail, Result};

/// The development secrets, a sops file encrypted to `.sops.yaml`'s age
/// recipients.
const FILE: &str = "secrets/dev.yaml";

/// One value of the development secrets by its key, decrypted by sops with
/// the caller's age identity, or none where the file or the key is absent.
/// A file that exists but will not decrypt fails, naming the file.
pub fn get(repo: &Repo, key: &str) -> Result<Option<Zeroizing<String>>> {
    let file = repo.root.join(FILE);
    if !file.is_file() {
        return Ok(None);
    }
    let out = Command::new("sops")
        .current_dir(&repo.root)
        .args(["decrypt", "--extract", &format!("[\"{key}\"]")])
        .arg(&file)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| Fail::new(format!("sops: {e}")))?;
    if out.status.success() {
        let value = Zeroizing::new(String::from_utf8_lossy(&out.stdout).trim().to_owned());
        return Ok((!value.is_empty()).then_some(value));
    }
    let err = String::from_utf8_lossy(&out.stderr);
    // sops names a missing key, "component ['key'] not found"; anything else
    // is a failure to decrypt
    if err.contains("component") && err.contains("not found") {
        return Ok(None);
    }
    Err(Fail::new(format!(
        "{FILE}: sops cannot decrypt it: {}",
        err.trim()
    )))
}
