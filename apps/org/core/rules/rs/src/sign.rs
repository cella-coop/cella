//! A member's signature on one write. The device signs a domain-separated
//! text naming the scope, the op, the actor, the device, the digest of the
//! request and a single-use nonce, so a signature names its request and,
//! with the notary refusing a nonce twice, counts once.
//!
//! The request digest is SHA-256 over the request's canonical JSON, the
//! same canonical form the log's payload digests use: browsers compute it
//! with WebCrypto, which has SHA-256 and Ed25519 but no BLAKE3.

use crate::hex::hex;
use crate::log::canonical;
use crate::{Error, Result};
use ed25519_dalek::{Signature, VerifyingKey};
use serde_json::Value;
use sha2::{Digest, Sha256};

/// The first line of every write signature: its type and version.
pub const WRITE: &str = "cella org 2026-10 write";

/// A nonce is 16 random bytes, as 32 lowercase hex digits.
pub const NONCE_HEX: usize = 32;

pub struct Request<'a> {
    pub scope: &'a str,
    pub op: &'a str,
    pub actor: &'a str,
    /// The signing device's Ed25519 public key.
    pub device: [u8; 32],
    /// The request's digest, [`request_digest`].
    pub digest: [u8; 32],
    pub nonce: &'a str,
}

pub fn request_digest(v: &Value) -> Result<[u8; 32]> {
    Ok(Sha256::digest(canonical(v)?.as_bytes()).into())
}

fn text(name: &'static str, v: &str) -> Result<()> {
    if v.is_empty() || v.chars().any(char::is_control) {
        return Err(Error::Field(name));
    }
    Ok(())
}

impl Request<'_> {
    /// The exact text the device signs, one `name value` line each.
    pub fn message(&self) -> Result<String> {
        text("scope", self.scope)?;
        text("op", self.op)?;
        text("actor", self.actor)?;
        let nonce = self.nonce.len() == NONCE_HEX && crate::hex::unhex(self.nonce).is_some();
        if !nonce {
            return Err(Error::Field("nonce"));
        }
        Ok(format!(
            "{WRITE}\nscope {}\nop {}\nactor {}\ndevice {}\nrequest {}\nnonce {}\n",
            self.scope,
            self.op,
            self.actor,
            hex(&self.device),
            hex(&self.digest),
            self.nonce,
        ))
    }

    /// Checks the device's signature on this request, strictly: no weak
    /// keys, no malleable signatures.
    pub fn verify(&self, sig: &[u8]) -> Result<()> {
        let message = self.message()?;
        let key = VerifyingKey::from_bytes(&self.device).map_err(|_| Error::Signature("the device key is not an Ed25519 key"))?;
        let sig = Signature::from_slice(sig).map_err(|_| Error::Signature("a signature is 64 bytes"))?;
        key.verify_strict(message.as_bytes(), &sig).map_err(|_| Error::Signature("the signature does not verify"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use serde_json::json;

    fn signed(key: &SigningKey, request: &Value, nonce: &str) -> ([u8; 32], [u8; 64]) {
        let digest = request_digest(request).unwrap();
        let r = Request { scope: "lanterne.example", op: "invoice:invoice:issue", actor: "julien@lanterne.example", device: key.verifying_key().to_bytes(), digest, nonce };
        (digest, key.sign(r.message().unwrap().as_bytes()).to_bytes())
    }

    #[test]
    fn a_signature_names_its_request() {
        let key = SigningKey::from_bytes(&[3; 32]);
        let nonce = "00112233445566778899aabbccddeeff";
        let request = json!({"series": "F-2026", "lines": [{"cents": 52000}]});
        let (digest, sig) = signed(&key, &request, nonce);
        let r = |op, actor, digest, nonce| Request { scope: "lanterne.example", op, actor, device: key.verifying_key().to_bytes(), digest, nonce };

        assert!(r("invoice:invoice:issue", "julien@lanterne.example", digest, nonce).verify(&sig).is_ok());
        let other = request_digest(&json!({"series": "F-2026", "lines": [{"cents": 52001}]})).unwrap();
        assert!(r("invoice:invoice:issue", "julien@lanterne.example", other, nonce).verify(&sig).is_err());
        assert!(r("invoice:invoice:void", "julien@lanterne.example", digest, nonce).verify(&sig).is_err());
        assert!(r("invoice:invoice:issue", "chloe@lanterne.example", digest, nonce).verify(&sig).is_err());
        assert!(r("invoice:invoice:issue", "julien@lanterne.example", digest, "ffeeddccbbaa99887766554433221100").verify(&sig).is_err());
    }

    #[test]
    fn fields_cannot_forge_lines() {
        let r = Request { scope: "lanterne.example", op: "a:b:c", actor: "x\nop d:e:f", device: [0; 32], digest: [0; 32], nonce: "00112233445566778899aabbccddeeff" };
        assert_eq!(r.message(), Err(Error::Field("actor")));
        let r = Request { actor: "x", nonce: "short", ..r };
        assert_eq!(r.message(), Err(Error::Field("nonce")));
    }

    #[test]
    fn the_message_is_fixed() {
        let r = Request { scope: "s", op: "a:b:c", actor: "x", device: [1; 32], digest: [2; 32], nonce: "00112233445566778899aabbccddeeff" };
        let m = r.message().unwrap();
        assert!(m.starts_with("cella org 2026-10 write\nscope s\nop a:b:c\nactor x\ndevice 0101"));
        assert!(m.ends_with("\nnonce 00112233445566778899aabbccddeeff\n"));
    }
}
