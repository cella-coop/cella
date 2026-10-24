//! The notary log's entries: hashed with BLAKE3 over the previous hash and
//! the canonical entry, and signed with the scope's Ed25519 key. An entry
//! carries a digest of its payload, never the payload, so personal data
//! stays out of the log.

use crate::{Error, Result};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde_json::Value;

/// The `prev` of the first entry.
pub const GENESIS: [u8; 32] = [0; 32];

const ENTRY: &str = "cella org 2026-10 log entry";
const PAYLOAD: &str = "cella org 2026-10 log payload";
const RULE: &str = "cella org 2026-10 rule text";

/// A rule that decided a verdict, by its owner, its signature and the
/// digest of its text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Rule {
    pub owner: String,
    pub function: String,
    pub text: [u8; 32],
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub n: i64,
    pub op: String,
    pub actor: String,
    /// The verdict date, `YYYY-MM-DD`.
    pub date: String,
    pub payload: [u8; 32],
    pub rules: Vec<Rule>,
}

/// JSON with sorted keys, no whitespace and integers only, so the same
/// payload hashes the same in every engine.
pub fn canonical(v: &Value) -> Result<String> {
    let mut out = String::new();
    write(v, &mut out)?;
    Ok(out)
}

fn write(v: &Value, out: &mut String) -> Result<()> {
    match v {
        Value::Null | Value::Bool(_) | Value::String(_) => out.push_str(&v.to_string()),
        Value::Number(n) if n.is_i64() || n.is_u64() => out.push_str(&n.to_string()),
        Value::Number(n) => return Err(Error::Float(n.to_string())),
        Value::Array(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write(item, out)?;
            }
            out.push(']');
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push('{');
            for (i, k) in keys.into_iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                out.push_str(&Value::String(k.clone()).to_string());
                out.push(':');
                write(&map[k], out)?;
            }
            out.push('}');
        }
    }
    Ok(())
}

pub fn payload_digest(v: &Value) -> Result<[u8; 32]> {
    let text = canonical(v)?;
    Ok(*blake3::Hasher::new_derive_key(PAYLOAD).update(text.as_bytes()).finalize().as_bytes())
}

#[must_use]
pub fn rule_digest(text: &str) -> [u8; 32] {
    *blake3::Hasher::new_derive_key(RULE).update(text.as_bytes()).finalize().as_bytes()
}

fn check_date(d: &str) -> Result<()> {
    let b = d.as_bytes();
    let digits = |r: std::ops::Range<usize>| b[r].iter().all(u8::is_ascii_digit);
    let ok = b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && digits(0..4)
        && digits(5..7)
        && digits(8..10)
        && (1..=12).contains(&((b[5] - b'0') * 10 + (b[6] - b'0')))
        && (1..=31).contains(&((b[8] - b'0') * 10 + (b[9] - b'0')));
    if ok { Ok(()) } else { Err(Error::Date(d.to_string())) }
}

fn field(h: &mut blake3::Hasher, bytes: &[u8]) {
    h.update(&(bytes.len() as u64).to_be_bytes());
    h.update(bytes);
}

/// The entry's hash, chained to `prev`.
pub fn hash(prev: &[u8; 32], e: &Entry) -> Result<[u8; 32]> {
    check_date(&e.date)?;
    let mut h = blake3::Hasher::new_derive_key(ENTRY);
    h.update(prev);
    h.update(&e.n.to_be_bytes());
    field(&mut h, e.op.as_bytes());
    field(&mut h, e.actor.as_bytes());
    field(&mut h, e.date.as_bytes());
    h.update(&e.payload);
    h.update(&(e.rules.len() as u64).to_be_bytes());
    for r in &e.rules {
        field(&mut h, r.owner.as_bytes());
        field(&mut h, r.function.as_bytes());
        h.update(&r.text);
    }
    Ok(*h.finalize().as_bytes())
}

/// The scope's signing key, from its 32-byte seed.
pub struct Key(SigningKey);

impl Key {
    pub fn from_seed(seed: &[u8]) -> Result<Self> {
        let seed: [u8; 32] = seed
            .try_into()
            .map_err(|_| Error::Key(format!("a seed is 32 bytes, got {}", seed.len())))?;
        Ok(Self(SigningKey::from_bytes(&seed)))
    }

    #[must_use]
    pub fn public(&self) -> [u8; 32] {
        self.0.verifying_key().to_bytes()
    }

    #[must_use]
    pub fn sign(&self, hash: &[u8; 32]) -> [u8; 64] {
        self.0.sign(hash).to_bytes()
    }
}

/// Where a chain breaks, and why.
#[derive(Debug, PartialEq, Eq)]
pub struct Broken {
    pub n: i64,
    pub why: &'static str,
}

/// Walks a log from its first entry, checking numbering, links, hashes and
/// signatures.
pub struct Chain {
    public: VerifyingKey,
    prev: [u8; 32],
    next: i64,
}

impl Chain {
    pub fn new(public: &[u8]) -> Result<Self> {
        let bytes: [u8; 32] = public
            .try_into()
            .map_err(|_| Error::Key(format!("a public key is 32 bytes, got {}", public.len())))?;
        let public = VerifyingKey::from_bytes(&bytes).map_err(|e| Error::Key(e.to_string()))?;
        Ok(Self { public, prev: GENESIS, next: 1 })
    }

    pub fn check(&mut self, e: &Entry, prev: &[u8], hash: &[u8], sig: &[u8]) -> std::result::Result<(), Broken> {
        let broken = |why| Broken { n: e.n, why };
        if e.n != self.next {
            return Err(broken("gap in numbering"));
        }
        if prev != self.prev {
            return Err(broken("wrong prev"));
        }
        let want = self::hash(&self.prev, e).map_err(|_| broken("unreadable entry"))?;
        if hash != want {
            return Err(broken("hash mismatch"));
        }
        let sig = Signature::from_slice(sig).map_err(|_| broken("malformed signature"))?;
        if self.public.verify(&want, &sig).is_err() {
            return Err(broken("signature invalid"));
        }
        self.prev = want;
        self.next += 1;
        Ok(())
    }

    /// How many entries checked so far.
    #[must_use]
    pub fn len(&self) -> i64 {
        self.next - 1
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.next == 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn entry(n: i64) -> Entry {
        Entry {
            n,
            op: "member:member:admit".into(),
            actor: "camille@lanterne.example".into(),
            date: "2026-10-31".into(),
            payload: payload_digest(&json!({"member": "ines@lanterne.example", "shares": 20})).unwrap(),
            rules: vec![Rule {
                owner: "decision-member".into(),
                function: "decision_member.admit(jsonb)".into(),
                text: rule_digest("select 1"),
            }],
        }
    }

    #[test]
    fn canonical_sorts_and_refuses_floats() {
        let a = canonical(&json!({"b": 1, "a": [true, null, "x"]})).unwrap();
        assert_eq!(a, r#"{"a":[true,null,"x"],"b":1}"#);
        assert!(canonical(&json!({"x": 1.5})).is_err());
        assert_eq!(payload_digest(&json!({"b": 1, "a": 2})), payload_digest(&json!({"a": 2, "b": 1})));
    }

    #[test]
    fn chain_verifies_and_catches_tampering() {
        let key = Key::from_seed(&[7; 32]).unwrap();
        let mut log = Vec::new();
        let mut prev = GENESIS;
        for n in 1..=3 {
            let e = entry(n);
            let h = hash(&prev, &e).unwrap();
            log.push((e, prev, h, key.sign(&h)));
            prev = h;
        }
        let mut chain = Chain::new(&key.public()).unwrap();
        for (e, p, h, s) in &log {
            chain.check(e, p, h, s).unwrap();
        }
        assert_eq!(chain.len(), 3);

        let mut chain = Chain::new(&key.public()).unwrap();
        let (e, p, h, s) = &log[0];
        let mut forged = e.clone();
        forged.actor = "mallory@lanterne.example".into();
        assert_eq!(chain.check(&forged, p, h, s), Err(Broken { n: 1, why: "hash mismatch" }));
        let (e, p, h, s) = &log[1];
        assert_eq!(chain.check(e, p, h, s), Err(Broken { n: 2, why: "gap in numbering" }));

        let other = Key::from_seed(&[8; 32]).unwrap();
        let mut chain = Chain::new(&other.public()).unwrap();
        let (e, p, h, s) = &log[0];
        assert_eq!(chain.check(e, p, h, s), Err(Broken { n: 1, why: "signature invalid" }));
    }

    #[test]
    fn dates_are_checked() {
        let mut e = entry(1);
        e.date = "2026-13-01".into();
        assert!(hash(&GENESIS, &e).is_err());
        e.date = "31/10/2026".into();
        assert!(hash(&GENESIS, &e).is_err());
    }

    #[test]
    fn key_needs_32_bytes() {
        assert!(Key::from_seed(&[1; 31]).is_err());
    }
}
