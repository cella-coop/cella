//! Personal data out of the log. A handler marks each personal value a
//! payload carries, `{"$personal": {"field", "subject", "value"}}`; what
//! the log keeps of it is a commitment, `{"$commit": hex}`, the BLAKE3,
//! under its own domain, of a fresh 256-bit salt and the value's canonical
//! JSON. The value and its salt go to the vault, sealed with
//! XChaCha20-Poly1305 under a key per subject, retention class and year,
//! itself sealed under a key derived from the scope's seed. Erasing a
//! subject deletes the salts and the values and destroys the keys, so the
//! commitment no longer opens: the log still verifies, and reads the gap
//! as `redacted`.
//!
//! A payload marks an erasure as `{"$erase": {"subject", "classes"?}}`,
//! which the log keeps as `{"$erasure": {"subject", "erased",
//! "restricted"}}`. Every other object key starting with `$` is reserved,
//! so no payload can pass a commitment off as its own.

use crate::log::canonical;
use crate::{Error, Result};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde_json::{Map, Value, json};

/// The domain of a commitment to a personal value.
pub const COMMITMENT: &str = "cella org 2026-10 personal commitment";
/// The domain of the key that seals the vault's keys, derived from the
/// scope's seed.
pub const WRAP: &str = "cella org 2026-10 vault key";

pub const PERSONAL: &str = "$personal";
pub const COMMIT: &str = "$commit";
pub const ERASE: &str = "$erase";
pub const ERASURE: &str = "$erasure";

/// What a commitment whose salt is gone reads as.
pub const REDACTED: &str = "redacted";

/// A nonce for XChaCha20-Poly1305 is 24 bytes, random.
pub const NONCE: usize = 24;

/// A personal value as a handler marks it: the field it is, as
/// `schema.table.column`, which the registry classes; whose it is, by
/// their address or id; and the value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Personal {
    pub field: String,
    pub subject: String,
    pub value: Value,
}

/// An erasure as a handler marks it: the subject, and the classes to erase,
/// or every class.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Erase {
    pub subject: String,
    pub classes: Option<Vec<String>>,
}

/// What a payload marks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Marked {
    Personal(Personal),
    Erase(Erase),
}

/// The commitment to `value` under `salt`.
pub fn commit(salt: &[u8; 32], value: &Value) -> Result<[u8; 32]> {
    let mut h = blake3::Hasher::new_derive_key(COMMITMENT);
    h.update(salt);
    h.update(canonical(value)?.as_bytes());
    Ok(*h.finalize().as_bytes())
}

/// Whether `value` and `salt` open `commitment`.
#[must_use]
pub fn opens(commitment: &[u8; 32], salt: &[u8; 32], value: &Value) -> bool {
    commit(salt, value).is_ok_and(|c| &c == commitment)
}

/// The key that seals the vault's keys, from the scope's seed.
#[must_use]
pub fn wrap_key(seed: &[u8]) -> [u8; 32] {
    blake3::derive_key(WRAP, seed)
}

/// Length-prefixed parts, bound to a sealed value as its associated data,
/// so a sealed value cannot be moved to another row.
#[must_use]
pub fn bound(parts: &[&[u8]]) -> Vec<u8> {
    let mut out = Vec::new();
    for p in parts {
        out.extend_from_slice(&(p.len() as u64).to_be_bytes());
        out.extend_from_slice(p);
    }
    out
}

/// `plain` sealed under `key` with a fresh `nonce`, bound to `aad`: the
/// nonce, then the ciphertext and its tag.
pub fn seal(key: &[u8; 32], nonce: &[u8; NONCE], aad: &[u8], plain: &[u8]) -> Result<Vec<u8>> {
    let sealed = XChaCha20Poly1305::new(key.into())
        .encrypt(XNonce::from_slice(nonce), Payload { msg: plain, aad })
        .map_err(|_| Error::Sealed)?;
    Ok([nonce.as_slice(), &sealed].concat())
}

/// What `seal` sealed, if `key` and `aad` are the ones it was sealed with.
pub fn open(key: &[u8; 32], aad: &[u8], sealed: &[u8]) -> Result<Vec<u8>> {
    if sealed.len() < NONCE {
        return Err(Error::Sealed);
    }
    let (nonce, msg) = sealed.split_at(NONCE);
    XChaCha20Poly1305::new(key.into())
        .decrypt(XNonce::from_slice(nonce), Payload { msg, aad })
        .map_err(|_| Error::Sealed)
}

fn marker(map: &Map<String, Value>) -> Result<Option<Marked>> {
    let reserved: Vec<&String> = map.keys().filter(|k| k.starts_with('$')).collect();
    let Some(key) = reserved.first() else {
        return Ok(None);
    };
    let bad = |why: &str| Error::Personal(format!("{key}: {why}"));
    if map.len() != 1 {
        return Err(bad("a marker is an object of one key"));
    }
    let inner = map[key.as_str()].as_object().ok_or_else(|| bad("names an object"))?;
    let text = |k: &str| -> Result<String> {
        inner
            .get(k)
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .ok_or_else(|| bad(&format!("names its {k}")))
    };
    match key.as_str() {
        PERSONAL => {
            let value = inner.get("value").cloned().ok_or_else(|| bad("names its value"))?;
            Ok(Some(Marked::Personal(Personal { field: text("field")?, subject: text("subject")?, value })))
        }
        ERASE => {
            let classes = match inner.get("classes") {
                None | Some(Value::Null) => None,
                Some(Value::Array(c)) => Some(
                    c.iter()
                        .map(|x| x.as_str().map(str::to_string).ok_or_else(|| bad("names its classes as text")))
                        .collect::<Result<Vec<_>>>()?,
                ),
                Some(_) => return Err(bad("names its classes as a list")),
            };
            Ok(Some(Marked::Erase(Erase { subject: text("subject")?, classes })))
        }
        _ => Err(bad("is reserved: a payload marks only $personal and $erase")),
    }
}

/// The payload as the log keeps it: each marker replaced, depth first and
/// in canonical key order, by what `each` makes of it.
pub fn logged(payload: &Value, each: &mut impl FnMut(Marked) -> Result<Value>) -> Result<Value> {
    match payload {
        Value::Array(items) => items.iter().map(|v| logged(v, each)).collect::<Result<Vec<_>>>().map(Value::Array),
        Value::Object(map) => {
            if let Some(m) = marker(map)? {
                return each(m);
            }
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let mut out = Map::new();
            for k in keys {
                out.insert(k.clone(), logged(&map[k], each)?);
            }
            Ok(Value::Object(out))
        }
        v => Ok(v.clone()),
    }
}

/// A commitment as the log keeps it.
#[must_use]
pub fn committed(commitment: &[u8; 32]) -> Value {
    json!({ COMMIT: crate::hex::hex(commitment) })
}

/// The commitment a logged value is, if it is one.
#[must_use]
pub fn commitment(v: &Value) -> Option<[u8; 32]> {
    let map = v.as_object().filter(|m| m.len() == 1)?;
    crate::hex::unhex(map.get(COMMIT)?.as_str()?)?.try_into().ok()
}

/// The logged form with each commitment opened by `open`, or read as
/// `redacted` when it no longer opens.
pub fn opened(form: &Value, open: &mut impl FnMut(&[u8; 32]) -> Option<Value>) -> Value {
    if let Some(c) = commitment(form) {
        return open(&c).unwrap_or_else(|| Value::String(REDACTED.into()));
    }
    match form {
        Value::Array(items) => Value::Array(items.iter().map(|v| opened(v, open)).collect()),
        Value::Object(map) => Value::Object(map.iter().map(|(k, v)| (k.clone(), opened(v, open))).collect()),
        v => v.clone(),
    }
}

/// The first year a key of `class` sealed in `year` may be destroyed: the
/// first of January after `years` full years past the end of `year`, as
/// the French books' clock runs from the close of the financial year.
#[must_use]
pub fn expires(year: i32, years: i32) -> i32 {
    year.saturating_add(years).saturating_add(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_commitment_is_salted_and_domain_separated() {
        let v = json!("ana@example.org");
        let a = commit(&[1; 32], &v).unwrap();
        assert_ne!(a, commit(&[2; 32], &v).unwrap());
        assert!(opens(&a, &[1; 32], &v));
        assert!(!opens(&a, &[1; 32], &json!("bob@example.org")));
        assert_ne!(a, crate::digest(&[[1; 32].as_slice(), b"\"ana@example.org\""].concat()));
    }

    #[test]
    fn sealing_round_trips_bound_to_its_row() {
        let key = [7; 32];
        let aad = bound(&[b"ana", b"contact"]);
        let sealed = seal(&key, &[3; NONCE], &aad, b"secret").unwrap();
        assert_eq!(open(&key, &aad, &sealed).unwrap(), b"secret");
        assert_eq!(open(&key, &bound(&[b"bob", b"contact"]), &sealed), Err(Error::Sealed));
        assert_eq!(open(&[8; 32], &aad, &sealed), Err(Error::Sealed));
        assert_ne!(wrap_key(&[0; 32]), wrap_key(&[1; 32]));
    }

    #[test]
    fn the_log_keeps_commitments_and_reads_gaps_as_redacted() {
        let payload = json!({
            "client": "ana",
            "fields": ["email", "phone"],
            "values": {
                "email": {"$personal": {"field": "client.client.email", "subject": "ana", "value": "ana@example.org"}},
                "phone": {"$personal": {"field": "client.client.phone", "subject": "ana", "value": "+33 1"}},
            },
        });
        let mut n = 0u8;
        let form = logged(&payload, &mut |m| {
            let Marked::Personal(p) = m else { panic!() };
            n += 1;
            Ok(committed(&commit(&[n; 32], &p.value)?))
        })
        .unwrap();
        assert_eq!(form["client"], "ana");
        let email = commitment(&form["values"]["email"]).unwrap();
        assert!(opens(&email, &[1; 32], &json!("ana@example.org")));
        let read = opened(&form, &mut |c| (c == &email).then(|| json!("ana@example.org")));
        assert_eq!(read["values"]["email"], "ana@example.org");
        assert_eq!(read["values"]["phone"], REDACTED);
    }

    #[test]
    fn markers_are_strict_and_other_dollar_keys_reserved() {
        let each = &mut |_| Ok(Value::Null);
        assert!(logged(&json!({"$commit": "00"}), each).is_err());
        assert!(logged(&json!({"$personal": {"field": "a.b.c", "subject": "x"}}), each).is_err());
        assert!(logged(&json!({"$personal": {"field": "a.b.c", "subject": "x", "value": 1}, "y": 2}), each).is_err());
        let mut seen = None;
        logged(&json!({"e": {"$erase": {"subject": "ana", "classes": ["contact"]}}}), &mut |m| {
            seen = Some(m);
            Ok(Value::Null)
        })
        .unwrap();
        assert_eq!(seen, Some(Marked::Erase(Erase { subject: "ana".into(), classes: Some(vec!["contact".into()]) })));
    }

    #[test]
    fn a_clock_runs_full_years_past_the_end_of_its_year() {
        assert_eq!(expires(2025, 10), 2036);
        assert_eq!(expires(2026, 5), 2032);
        assert_eq!(expires(2026, 0), 2027);
    }
}
