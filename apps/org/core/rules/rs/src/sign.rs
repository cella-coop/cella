//! A member's signature on one write. The device signs a domain-separated
//! text naming the scope, the op, the actor, the device, the digest of the
//! request and a single-use nonce, so a signature names its request and,
//! with the notary refusing a nonce twice, counts once.
//!
//! The request digest is SHA-256 over the canonical JSON of the request
//! and a fresh salt, the same canonical form the log's payload digests
//! use: browsers compute it with `WebCrypto`, which has SHA-256 and Ed25519
//! but no BLAKE3.

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

/// A request's salt is 32 random bytes, as 64 lowercase hex digits.
pub const SALT_HEX: usize = 64;

/// The request's digest: SHA-256 over the canonical JSON of
/// `{"request": …, "salt": …}`. The device draws a fresh salt for each
/// write and the notary keeps only the digest, so the digest hides what
/// the member typed: no one can confirm a guess of a request against the
/// log.
pub fn request_digest(request: &Value, salt: &str) -> Result<[u8; 32]> {
    if salt.len() != SALT_HEX || crate::hex::unhex(salt).is_none() {
        return Err(Error::Field("salt"));
    }
    let salted = serde_json::json!({ "request": request, "salt": salt });
    Ok(Sha256::digest(canonical(&salted)?.as_bytes()).into())
}

/// Checks that the payload restates the request where it carries the same
/// field: each top-level field of the request that the payload also holds
/// with a value of the same kind (string, number, boolean, array, object)
/// has the same value there, a personal value compared by the value it
/// marks. The member signs the request and the log commits to the payload
/// the server composes from it; where the two say the same thing they
/// agree, so the payload cannot say the member asked for what they did not
/// sign. A value of another kind under the same name is something the
/// server composed in its place, such as the id of a file it stored for
/// the file the member sent, and restates nothing.
pub fn restates(request: &Value, payload: &Value) -> Result<()> {
    let (Some(asked), Some(logged)) = (request.as_object(), payload.as_object()) else {
        return Ok(());
    };
    for (field, value) in asked {
        let Some(said) = logged.get(field).map(unmarked) else { continue };
        if kind(&said) == kind(value) && said != *value {
            return Err(Error::Restated(field.clone()));
        }
    }
    Ok(())
}

fn kind(v: &Value) -> u8 {
    match v {
        Value::Null => 0,
        Value::Bool(_) => 1,
        Value::Number(_) => 2,
        Value::String(_) => 3,
        Value::Array(_) => 4,
        Value::Object(_) => 5,
    }
}

/// A payload's value with each personal marker replaced by the value it
/// marks.
fn unmarked(v: &Value) -> Value {
    match v {
        Value::Object(o) => match (o.len(), o.get("$personal")) {
            (1, Some(p)) => p.get("value").map_or(Value::Null, unmarked),
            _ => Value::Object(o.iter().map(|(k, v)| (k.clone(), unmarked(v))).collect()),
        },
        Value::Array(a) => Value::Array(a.iter().map(unmarked).collect()),
        v => v.clone(),
    }
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

    const SALT: &str = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

    fn signed(key: &SigningKey, request: &Value, nonce: &str) -> ([u8; 32], [u8; 64]) {
        let digest = request_digest(request, SALT).unwrap();
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
        let other = request_digest(&json!({"series": "F-2026", "lines": [{"cents": 52001}]}), SALT).unwrap();
        assert!(r("invoice:invoice:issue", "julien@lanterne.example", other, nonce).verify(&sig).is_err());
        assert!(r("invoice:invoice:void", "julien@lanterne.example", digest, nonce).verify(&sig).is_err());
        assert!(r("invoice:invoice:issue", "chloe@lanterne.example", digest, nonce).verify(&sig).is_err());
        assert!(r("invoice:invoice:issue", "julien@lanterne.example", digest, "ffeeddccbbaa99887766554433221100").verify(&sig).is_err());
    }

    #[test]
    fn a_request_digest_is_salted() {
        let request = json!({"name": "Ana Martin"});
        let other = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";
        assert_ne!(request_digest(&request, SALT).unwrap(), request_digest(&request, other).unwrap());
        assert_eq!(request_digest(&request, "short"), Err(Error::Field("salt")));
        assert_eq!(request_digest(&request, &SALT.to_uppercase()), Err(Error::Field("salt")));
    }

    #[test]
    fn a_payload_restates_what_was_signed() {
        let request = json!({"person": "lea@lanterne.example", "email": "lea@example.org", "note": "mine"});
        let payload = json!({
            "person": "lea@lanterne.example",
            "email": {"$personal": {"field": "person.person.email", "subject": "lea@lanterne.example", "value": "lea@example.org"}},
            "entry": "42",
        });
        assert_eq!(restates(&request, &payload), Ok(()));
        let swapped = json!({"person": "camille@lanterne.example", "entry": "42"});
        assert_eq!(restates(&request, &swapped), Err(Error::Restated("person".into())));
        let marked = json!({"email": {"$personal": {"field": "person.person.email", "subject": "lea@lanterne.example", "value": "eve@example.org"}}});
        assert_eq!(restates(&request, &marked), Err(Error::Restated("email".into())));
        let nested = json!({"lines": [{"cents": 52000}]});
        assert_eq!(restates(&json!({"lines": [{"cents": 52000}]}), &nested), Ok(()));
        assert_eq!(restates(&json!({"lines": [{"cents": 52001}]}), &nested), Err(Error::Restated("lines".into())));
        assert_eq!(restates(&json!("a scalar request"), &payload), Ok(()));
        // Composed in its place, of another kind: the stored file's id for
        // the file sent, the names of the fields changed for their values.
        let composed = json!({"file": "0193", "fields": ["email"]});
        assert_eq!(restates(&json!({"file": {"name": "cv.pdf"}, "fields": {"email": "a@b.c"}}), &composed), Ok(()));
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
