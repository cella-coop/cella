//! The notary log: receipts and entries, each hashed with BLAKE3 under its
//! own domain and signed with the scope's Ed25519 key of the day, which
//! each names by its id ([`Signer`]). A receipt says a
//! write arrived, carrying the member's signature on it; an entry is the
//! numbered verdict, chained to the previous entry and naming its receipt;
//! an effect, what a decision carries or what reacts to it, is an entry
//! with no receipt, which names in its place the entry of its own write it
//! follows, under a domain of its own.
//! Both carry a digest of the payload, never the payload, so personal data
//! stays out of the log.

use crate::sign::Request;
use crate::{Error, Result};
use ed25519_dalek::{Signature, Signer as _, SigningKey, Verifier, VerifyingKey};
use serde_json::Value;

/// The `prev` of the first entry.
pub const GENESIS: [u8; 32] = [0; 32];

pub const ENTRY: &str = "cella org 2026-10 log entry";
pub const RECEIPT: &str = "cella org 2026-10 receipt";
pub const EFFECT: &str = "cella org 2026-11 log effect";
pub const PAYLOAD: &str = "cella org 2026-10 log payload";
// A guard's text keeps the key it was hashed under when guards were
// called rules, so a digest the log holds keeps verifying.
pub const GUARD: &str = "cella org 2026-10 rule text";

/// The notary's acknowledgement that a signed write arrived: its number,
/// the op, who asked from which device, the member's signature and what
/// it signed, the digest of the payload the verdict commits to, and when.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Receipt {
    pub n: i64,
    pub op: String,
    pub actor: String,
    pub device: [u8; 32],
    pub nonce: String,
    /// The request's digest, which the member signed.
    pub request: [u8; 32],
    /// The member's signature on the request.
    pub signature: [u8; 64],
    pub payload: [u8; 32],
    /// When it arrived, RFC 3339 in UTC; it orders nothing.
    pub time: String,
}

impl Receipt {
    #[must_use]
    pub fn hash(&self) -> [u8; 32] {
        let mut h = blake3::Hasher::new_derive_key(RECEIPT);
        h.update(&self.n.to_be_bytes());
        field(&mut h, self.op.as_bytes());
        field(&mut h, self.actor.as_bytes());
        h.update(&self.device);
        field(&mut h, self.nonce.as_bytes());
        h.update(&self.request);
        h.update(&self.signature);
        h.update(&self.payload);
        field(&mut h, self.time.as_bytes());
        *h.finalize().as_bytes()
    }

    /// The member's request as signed, in `scope`.
    #[must_use]
    pub fn request<'a>(&'a self, scope: &'a str) -> Request<'a> {
        Request {
            scope,
            op: &self.op,
            actor: &self.actor,
            device: self.device,
            digest: self.request,
            nonce: &self.nonce,
        }
    }
}

/// A guard that decided a verdict, by its owner, its signature and the
/// digest of its text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Guard {
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
    pub basis: Basis,
    pub guards: Vec<Guard>,
}

/// What an entry stands on: a decision on the receipt of the request a
/// member signed; an effect on the entry it follows, an earlier entry of
/// the same write, the decision's or another effect's.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Basis {
    /// The receipt this verdict rules on, by number and hash.
    Receipt { n: i64, hash: [u8; 32] },
    /// The entry this effect follows, by number and hash, and whether the
    /// effect settled or was forgone.
    Cause {
        n: i64,
        hash: [u8; 32],
        settled: bool,
    },
}

/// How many effects deep a write goes: an effect's cause is fewer than
/// this many effects from its decision.
pub const DEEPEST: u8 = 5;

/// That `op` may follow `cause` as its effect, and whether `cause` stands
/// only with it, from entry `since` on, as `cella.follows` registers it: a
/// requirement binds the entries after it was registered, never one
/// before.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Follows {
    pub cause: String,
    pub op: String,
    pub required: bool,
    pub since: i64,
}

/// An entry of the write being appended or walked: its number, op and
/// hash, the entry it follows, whether it settled and how many effects it
/// is from its decision, 0 for the decision.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Written {
    pub n: i64,
    pub op: String,
    pub hash: [u8; 32],
    pub cause: Option<i64>,
    pub settled: bool,
    pub depth: u8,
}

/// Why an effect may not follow the entry it cites.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unfollowed {
    /// The cause is no entry of the effect's own write.
    Elsewhere,
    /// The cause was forgone, and the effect settles.
    Forgone,
    /// The cause is [`DEEPEST`] effects from its decision already.
    Deep,
    /// `cella.follows` does not let the effect's op follow the cause's.
    Unregistered,
}

impl Unfollowed {
    #[must_use]
    pub fn why(self) -> &'static str {
        match self {
            Self::Elsewhere => "an effect cites no entry of its own write",
            Self::Forgone => "a settled effect cites a forgone entry",
            Self::Deep => "an effect is deeper than a write goes",
            Self::Unregistered => "an effect's op may not follow its cause's",
        }
    }
}

/// Whether `op` may follow entry `cause` of `write`, and if so the depth it
/// stands at: the cause is an entry of the write, settled for an effect
/// that settles, fewer than [`DEEPEST`] effects from its decision, and
/// `follows` lets `op` follow its op.
pub fn may_follow<'a>(
    write: &'a [Written],
    follows: &[Follows],
    op: &str,
    cause: i64,
    settles: bool,
) -> std::result::Result<(&'a Written, u8), Unfollowed> {
    let c = write
        .iter()
        .find(|w| w.n == cause)
        .ok_or(Unfollowed::Elsewhere)?;
    if settles && !c.settled {
        return Err(Unfollowed::Forgone);
    }
    if c.depth >= DEEPEST {
        return Err(Unfollowed::Deep);
    }
    if !follows.iter().any(|f| f.cause == c.op && f.op == op) {
        return Err(Unfollowed::Unregistered);
    }
    Ok((c, c.depth + 1))
}

/// The first settled entry of `write` that lacks a settled effect its
/// `required` rows name, those registered before it, and the op it lacks.
#[must_use]
pub fn lacking<'a>(write: &'a [Written], follows: &'a [Follows]) -> Option<(&'a Written, &'a str)> {
    write.iter().filter(|w| w.settled).find_map(|w| {
        follows
            .iter()
            .filter(|f| f.required && f.cause == w.op && w.n >= f.since)
            .find(|f| {
                !write
                    .iter()
                    .any(|e| e.settled && e.cause == Some(w.n) && e.op == f.op)
            })
            .map(|f| (w, f.op.as_str()))
    })
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
    Ok(*blake3::Hasher::new_derive_key(PAYLOAD)
        .update(text.as_bytes())
        .finalize()
        .as_bytes())
}

#[must_use]
pub fn guard_digest(text: &str) -> [u8; 32] {
    *blake3::Hasher::new_derive_key(GUARD)
        .update(text.as_bytes())
        .finalize()
        .as_bytes()
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
    if ok {
        Ok(())
    } else {
        Err(Error::Date(d.to_string()))
    }
}

fn field(h: &mut blake3::Hasher, bytes: &[u8]) {
    h.update(&(bytes.len() as u64).to_be_bytes());
    h.update(bytes);
}

/// The entry's hash, chained to `prev`.
pub fn hash(prev: &[u8; 32], e: &Entry) -> Result<[u8; 32]> {
    check_date(&e.date)?;
    let mut h = blake3::Hasher::new_derive_key(match e.basis {
        Basis::Receipt { .. } => ENTRY,
        Basis::Cause { .. } => EFFECT,
    });
    h.update(prev);
    h.update(&e.n.to_be_bytes());
    field(&mut h, e.op.as_bytes());
    field(&mut h, e.actor.as_bytes());
    field(&mut h, e.date.as_bytes());
    h.update(&e.payload);
    match &e.basis {
        Basis::Receipt { n, hash } => {
            h.update(&n.to_be_bytes());
            h.update(hash);
        }
        Basis::Cause { n, hash, settled } => {
            h.update(&n.to_be_bytes());
            h.update(hash);
            h.update(&[u8::from(*settled)]);
        }
    }
    h.update(&(e.guards.len() as u64).to_be_bytes());
    for r in &e.guards {
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

/// A key the notary signed with: its id, its public key and the first
/// entry it signed. Each signs from its `since` until the next one's, so a
/// rotated or lost key file leaves the entries it signed verifiable, and a
/// retired key never signs again.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Signer {
    pub id: i32,
    pub public: [u8; 32],
    pub since: i64,
}

/// Walks a log from its first entry, checking numbering, links, hashes and
/// signatures, each under the key in office at its number, and each write:
/// a decision and the effects after it, each citing an entry of the same
/// write as [`may_follow`] allows and acting for the decision's actor, and
/// none lacking an effect it requires.
pub struct Chain {
    signers: Vec<(i32, i64, VerifyingKey)>,
    prev: [u8; 32],
    next: i64,
    follows: Vec<Follows>,
    write: Vec<Written>,
    /// The actor of the decision that opened the write walked last.
    actor: String,
}

impl Chain {
    /// A chain over the scope's signers in the order they took office: ids
    /// from 1 up, the first from entry 1, each later one from a later entry.
    pub fn new(signers: &[Signer]) -> Result<Self> {
        let mut out = Vec::with_capacity(signers.len());
        for (i, s) in signers.iter().enumerate() {
            let expected =
                i32::try_from(i + 1).map_err(|_| Error::Key("too many signers".into()))?;
            if s.id != expected {
                return Err(Error::Key(format!(
                    "signer {} where {expected} was due: ids run from 1 with no gap",
                    s.id
                )));
            }
            let after = out.last().map_or(0, |&(_, since, _)| since);
            if (i == 0 && s.since != 1) || s.since <= after {
                return Err(Error::Key(format!(
                    "signer {} takes office at entry {}, which is not after its predecessor's",
                    s.id, s.since
                )));
            }
            let public =
                VerifyingKey::from_bytes(&s.public).map_err(|e| Error::Key(e.to_string()))?;
            out.push((s.id, s.since, public));
        }
        Ok(Self {
            signers: out,
            prev: GENESIS,
            next: 1,
            follows: Vec::new(),
            write: Vec::new(),
            actor: String::new(),
        })
    }

    /// The chain walked from entry `n`, whose hash is `hash`, as from a
    /// checkpoint at the end of a write: its next entry is `n + 1`, linked
    /// to `hash`, and opens a write.
    #[must_use]
    pub fn after(mut self, n: i64, hash: [u8; 32]) -> Self {
        self.next = n + 1;
        self.prev = hash;
        self
    }

    /// The chain, judging effects by `follows`, as `cella.follows` holds it.
    #[must_use]
    pub fn following(mut self, follows: Vec<Follows>) -> Self {
        self.follows = follows;
        self
    }

    /// Checks the write the chain walked last, once it is whole: no settled
    /// entry of it lacks a settled effect it requires. Called as each
    /// decision starts the next write, and once after the last entry.
    pub fn finish(&mut self) -> std::result::Result<(), Broken> {
        let written = std::mem::take(&mut self.write);
        match lacking(&written, &self.follows) {
            Some((w, _)) => Err(Broken {
                n: w.n,
                why: "a settled entry lacks an effect it requires",
            }),
            None => Ok(()),
        }
    }

    /// Places entry `e`, whose hash is `hash`, in its write.
    fn place(&mut self, e: &Entry, hash: [u8; 32]) -> std::result::Result<(), Broken> {
        let written = match &e.basis {
            Basis::Receipt { .. } => {
                self.finish()?;
                self.actor.clone_from(&e.actor);
                Written {
                    n: e.n,
                    op: e.op.clone(),
                    hash,
                    cause: None,
                    settled: true,
                    depth: 0,
                }
            }
            Basis::Cause {
                n,
                hash: cited,
                settled,
            } => {
                let broken = |why| Broken { n: e.n, why };
                let (cause, depth) = may_follow(&self.write, &self.follows, &e.op, *n, *settled)
                    .map_err(|u| broken(u.why()))?;
                if cause.hash != *cited {
                    return Err(broken("an effect names its cause by another hash"));
                }
                if e.actor != self.actor {
                    return Err(broken(
                        "an effect acts for another actor than its decision's",
                    ));
                }
                Written {
                    n: e.n,
                    op: e.op.clone(),
                    hash,
                    cause: Some(*n),
                    settled: *settled,
                    depth,
                }
            }
        };
        self.write.push(written);
        Ok(())
    }

    /// The key in office at entry `n`, if it is the one `key` names.
    fn signer(&self, n: i64, key: i32) -> std::result::Result<&VerifyingKey, &'static str> {
        let (id, _, public) = self
            .signers
            .iter()
            .rev()
            .find(|&&(_, since, _)| since <= n)
            .ok_or("no signer holds this entry")?;
        if *id != key {
            return Err("signed by a key that was not in office");
        }
        Ok(public)
    }

    /// Checks entry `e`, signed by the signer `key`.
    pub fn check(
        &mut self,
        e: &Entry,
        key: i32,
        prev: &[u8],
        hash: &[u8],
        sig: &[u8],
    ) -> std::result::Result<(), Broken> {
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
        let public = self.signer(e.n, key).map_err(broken)?;
        let sig = Signature::from_slice(sig).map_err(|_| broken("malformed signature"))?;
        if public.verify(&want, &sig).is_err() {
            return Err(broken("signature invalid"));
        }
        self.place(e, want)?;
        self.prev = want;
        self.next += 1;
        Ok(())
    }

    /// Checks the receipt an entry names, signed by the signer `key`: its
    /// hash, the notary's signature on it, the member's signature on the
    /// request in `scope`, and that it is the entry's: the same op, actor
    /// and payload.
    pub fn check_receipt(
        &self,
        scope: &str,
        e: &Entry,
        key: i32,
        r: &Receipt,
        hash: &[u8],
        sig: &[u8],
    ) -> std::result::Result<(), Broken> {
        let broken = |why| Broken { n: e.n, why };
        let want = r.hash();
        if e.basis != (Basis::Receipt { n: r.n, hash: want }) || hash != want {
            return Err(broken("receipt hash mismatch"));
        }
        let public = self.signer(e.n, key).map_err(broken)?;
        let sig = Signature::from_slice(sig).map_err(|_| broken("malformed receipt signature"))?;
        if public.verify(&want, &sig).is_err() {
            return Err(broken("receipt signature invalid"));
        }
        if r.request(scope).verify(&r.signature).is_err() {
            return Err(broken("the member's signature does not verify"));
        }
        if r.op != e.op || r.actor != e.actor || r.payload != e.payload {
            return Err(broken("the receipt is another write's"));
        }
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
            op: "membership:member:admit".into(),
            actor: "camille@lanterne.example".into(),
            date: "2026-10-31".into(),
            payload: payload_digest(&json!({"member": "ines@lanterne.example", "shares": 20}))
                .unwrap(),
            basis: Basis::Receipt {
                n: n + 40,
                hash: [n.to_le_bytes()[0]; 32],
            },
            guards: vec![Guard {
                owner: "membership-motion".into(),
                function: "membership_motion.admit(jsonb)".into(),
                text: guard_digest("select 1"),
            }],
        }
    }

    #[test]
    fn canonical_sorts_and_refuses_floats() {
        let a = canonical(&json!({"b": 1, "a": [true, null, "x"]})).unwrap();
        assert_eq!(a, r#"{"a":[true,null,"x"],"b":1}"#);
        assert!(canonical(&json!({"x": 1.5})).is_err());
        assert_eq!(
            payload_digest(&json!({"b": 1, "a": 2})),
            payload_digest(&json!({"a": 2, "b": 1}))
        );
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
        let mut chain = Chain::new(&[signer(1, &key, 1)]).unwrap();
        for (e, p, h, s) in &log {
            chain.check(e, 1, p, h, s).unwrap();
        }
        assert_eq!(chain.len(), 3);

        // Walked from a checkpoint at entry 1, the chain checks entries 2
        // and 3 from entry 1's hash, and refuses another hash there.
        let mut chain = Chain::new(&[signer(1, &key, 1)])
            .unwrap()
            .after(1, log[0].2);
        for (e, p, h, s) in &log[1..] {
            chain.check(e, 1, p, h, s).unwrap();
        }
        assert_eq!(chain.len(), 3);
        let mut chain = Chain::new(&[signer(1, &key, 1)]).unwrap().after(1, [9; 32]);
        let (e, p, h, s) = &log[1];
        assert_eq!(
            chain.check(e, 1, p, h, s),
            Err(Broken {
                n: 2,
                why: "wrong prev"
            })
        );

        let mut chain = Chain::new(&[signer(1, &key, 1)]).unwrap();
        let (e, p, h, s) = &log[0];
        let mut forged = e.clone();
        forged.actor = "mallory@lanterne.example".into();
        assert_eq!(
            chain.check(&forged, 1, p, h, s),
            Err(Broken {
                n: 1,
                why: "hash mismatch"
            })
        );
        let (e, p, h, s) = &log[1];
        assert_eq!(
            chain.check(e, 1, p, h, s),
            Err(Broken {
                n: 2,
                why: "gap in numbering"
            })
        );

        let other = Key::from_seed(&[8; 32]).unwrap();
        let mut chain = Chain::new(&[signer(1, &other, 1)]).unwrap();
        let (e, p, h, s) = &log[0];
        assert_eq!(
            chain.check(e, 1, p, h, s),
            Err(Broken {
                n: 1,
                why: "signature invalid"
            })
        );
    }

    fn signer(id: i32, key: &Key, since: i64) -> Signer {
        Signer {
            id,
            public: key.public(),
            since,
        }
    }

    #[test]
    fn a_rotated_key_signs_from_its_entry_and_the_retired_one_never_again() {
        let (first, second) = (
            Key::from_seed(&[7; 32]).unwrap(),
            Key::from_seed(&[8; 32]).unwrap(),
        );
        let mut log = Vec::new();
        let mut prev = GENESIS;
        for n in 1..=4 {
            let e = entry(n);
            let h = hash(&prev, &e).unwrap();
            let (id, key) = if n < 3 { (1, &first) } else { (2, &second) };
            log.push((e, id, prev, h, key.sign(&h)));
            prev = h;
        }
        let signers = [signer(1, &first, 1), signer(2, &second, 3)];
        let mut chain = Chain::new(&signers).unwrap();
        for (e, id, p, h, s) in &log {
            chain.check(e, *id, p, h, s).unwrap();
        }
        assert_eq!(chain.len(), 4);

        // The retired key signs entry 3, and says it is still in office.
        let (e, _, p, h, _) = &log[2];
        let mut chain = Chain::new(&signers).unwrap();
        for (e, id, p, h, s) in &log[..2] {
            chain.check(e, *id, p, h, s).unwrap();
        }
        let late = first.sign(h);
        assert_eq!(
            chain.check(e, 1, p, h, &late),
            Err(Broken {
                n: 3,
                why: "signed by a key that was not in office"
            })
        );
        assert_eq!(
            chain.check(e, 2, p, h, &late),
            Err(Broken {
                n: 3,
                why: "signature invalid"
            })
        );

        assert!(Chain::new(&[signer(2, &first, 1)]).is_err());
        assert!(Chain::new(&[signer(1, &first, 2)]).is_err());
        assert!(Chain::new(&[signer(1, &first, 1), signer(2, &second, 1)]).is_err());
    }

    #[test]
    fn receipts_bind_the_member_signature_and_the_entry() {
        use crate::sign::request_digest;
        use ed25519_dalek::SigningKey;

        let notary = Key::from_seed(&[7; 32]).unwrap();
        let device = SigningKey::from_bytes(&[9; 32]);
        let request = request_digest(
            &json!({"member": "ines@lanterne.example", "shares": 20, "motion": "m-2026-012"}),
            &"ab".repeat(32),
        )
        .unwrap();
        let mut r = Receipt {
            n: 41,
            op: "membership:member:admit".into(),
            actor: "camille@lanterne.example".into(),
            device: device.verifying_key().to_bytes(),
            nonce: "00112233445566778899aabbccddeeff".into(),
            request,
            signature: [0; 64],
            payload: entry(1).payload,
            time: "2026-10-31T09:00:00.000000Z".into(),
        };
        r.signature = device
            .sign(r.request("lanterne.example").message().unwrap().as_bytes())
            .to_bytes();
        let mut e = entry(1);
        e.basis = Basis::Receipt {
            n: 41,
            hash: r.hash(),
        };
        let chain = Chain::new(&[signer(1, &notary, 1)]).unwrap();
        let sig = notary.sign(&r.hash());
        assert_eq!(
            chain.check_receipt("lanterne.example", &e, 1, &r, &r.hash(), &sig),
            Ok(())
        );

        let broken = |why| Err(Broken { n: 1, why });
        assert_eq!(
            chain.check_receipt("other.example", &e, 1, &r, &r.hash(), &sig),
            broken("the member's signature does not verify")
        );
        let mut late = r.clone();
        late.time = "2026-11-01T09:00:00.000000Z".into();
        assert_eq!(
            chain.check_receipt("lanterne.example", &e, 1, &late, &r.hash(), &sig),
            broken("receipt hash mismatch")
        );
        let mut other = e.clone();
        other.op = "membership:member:exclude".into();
        assert_eq!(
            chain.check_receipt("lanterne.example", &other, 1, &r, &r.hash(), &sig),
            broken("the receipt is another write's")
        );
        let forged = Key::from_seed(&[8; 32]).unwrap().sign(&r.hash());
        assert_eq!(
            chain.check_receipt("lanterne.example", &e, 1, &r, &r.hash(), &forged),
            broken("receipt signature invalid")
        );
        assert_eq!(
            chain.check_receipt("lanterne.example", &e, 2, &r, &r.hash(), &sig),
            broken("signed by a key that was not in office")
        );
    }

    const CLOSE: &str = "motion:motion:close";
    const ADMIT: &str = "membership:member:admit";
    const SUBSCRIBE: &str = "account:capital:subscribe";

    fn follows() -> Vec<Follows> {
        vec![
            Follows {
                cause: CLOSE.into(),
                op: ADMIT.into(),
                required: false,
                since: 1,
            },
            Follows {
                cause: ADMIT.into(),
                op: SUBSCRIBE.into(),
                required: true,
                since: 1,
            },
            Follows {
                cause: SUBSCRIBE.into(),
                op: SUBSCRIBE.into(),
                required: false,
                since: 1,
            },
        ]
    }

    /// A log of `(op, basis)` rows, each `None` basis a decision on its own
    /// receipt and `Some((cause, settled))` an effect citing entry `cause`
    /// by its hash, appended and signed in turn.
    fn written(rows: &[(&str, Option<(i64, bool)>)]) -> Vec<(Entry, [u8; 32], [u8; 32], [u8; 64])> {
        let key = Key::from_seed(&[7; 32]).unwrap();
        let mut log: Vec<(Entry, [u8; 32], [u8; 32], [u8; 64])> = Vec::new();
        let mut prev = GENESIS;
        for (i, (op, effect)) in rows.iter().enumerate() {
            let mut e = entry(i64::try_from(i).unwrap() + 1);
            e.op = (*op).into();
            if let Some((cause, settled)) = *effect {
                let hash = log
                    .get(usize::try_from(cause).unwrap() - 1)
                    .map_or([1; 32], |c| c.2);
                e.basis = Basis::Cause {
                    n: cause,
                    hash,
                    settled,
                };
            }
            let h = hash(&prev, &e).unwrap();
            log.push((e, prev, h, key.sign(&h)));
            prev = h;
        }
        log
    }

    fn walk(log: &[(Entry, [u8; 32], [u8; 32], [u8; 64])]) -> std::result::Result<i64, Broken> {
        let key = Key::from_seed(&[7; 32]).unwrap();
        let mut chain = Chain::new(&[signer(1, &key, 1)])
            .unwrap()
            .following(follows());
        for (e, p, h, s) in log {
            chain.check(e, 1, p, h, s)?;
        }
        chain.finish()?;
        Ok(chain.len())
    }

    #[test]
    fn a_decision_and_its_effects_verify_as_one_write() {
        let log = written(&[
            (CLOSE, None),
            (ADMIT, Some((1, true))),
            (SUBSCRIBE, Some((2, true))),
            (CLOSE, None),
        ]);
        assert_eq!(walk(&log), Ok(4));
        // A refused subscription forgoes the admission it follows.
        let log = written(&[
            (CLOSE, None),
            (ADMIT, Some((1, false))),
            (SUBSCRIBE, Some((2, false))),
        ]);
        assert_eq!(walk(&log), Ok(3));
    }

    #[test]
    fn an_effect_and_its_entry_hash_apart() {
        let decision = written(&[(CLOSE, None), (ADMIT, None)]);
        let effect = written(&[(CLOSE, None), (ADMIT, Some((1, true)))]);
        assert_ne!(decision[1].2, effect[1].2);
        let forgone = written(&[(CLOSE, None), (ADMIT, Some((1, false)))]);
        assert_ne!(effect[1].2, forgone[1].2);
    }

    #[test]
    fn an_effect_follows_only_an_entry_of_its_own_write() {
        let broken = |n, why| Err(Broken { n, why });
        let elsewhere = written(&[(CLOSE, None), (CLOSE, None), (ADMIT, Some((1, true)))]);
        assert_eq!(
            walk(&elsewhere),
            broken(3, "an effect cites no entry of its own write")
        );
        let first = written(&[(ADMIT, Some((1, true)))]);
        assert_eq!(
            walk(&first),
            broken(1, "an effect cites no entry of its own write")
        );
        let mut moved = written(&[(CLOSE, None), (ADMIT, Some((1, true)))]);
        moved[1].0.basis = Basis::Cause {
            n: 1,
            hash: [3; 32],
            settled: true,
        };
        let key = Key::from_seed(&[7; 32]).unwrap();
        moved[1].2 = hash(&moved[1].1, &moved[1].0).unwrap();
        moved[1].3 = key.sign(&moved[1].2);
        assert_eq!(
            walk(&moved),
            broken(2, "an effect names its cause by another hash")
        );
        let mut impersonating = written(&[
            (CLOSE, None),
            (ADMIT, Some((1, true))),
            (SUBSCRIBE, Some((2, true))),
        ]);
        impersonating[2].0.actor = "mallory@lanterne.example".into();
        impersonating[2].2 = hash(&impersonating[2].1, &impersonating[2].0).unwrap();
        impersonating[2].3 = key.sign(&impersonating[2].2);
        assert_eq!(
            walk(&impersonating),
            broken(3, "an effect acts for another actor than its decision's")
        );
        let unregistered = written(&[(CLOSE, None), (SUBSCRIBE, Some((1, true)))]);
        assert_eq!(
            walk(&unregistered),
            broken(2, "an effect's op may not follow its cause's")
        );
        let on_forgone = written(&[
            (CLOSE, None),
            (ADMIT, Some((1, false))),
            (SUBSCRIBE, Some((2, true))),
        ]);
        assert_eq!(
            walk(&on_forgone),
            broken(3, "a settled effect cites a forgone entry")
        );
    }

    #[test]
    fn a_write_goes_five_effects_deep() {
        let mut rows = vec![
            (CLOSE, None),
            (ADMIT, Some((1, true))),
            (SUBSCRIBE, Some((2, true))),
        ];
        for n in 3..=5 {
            rows.push((SUBSCRIBE, Some((n, true))));
        }
        assert_eq!(walk(&written(&rows)), Ok(6));
        rows.push((SUBSCRIBE, Some((6, true))));
        assert_eq!(
            walk(&written(&rows)),
            Err(Broken {
                n: 7,
                why: "an effect is deeper than a write goes"
            })
        );
    }

    #[test]
    fn a_settled_entry_never_lacks_an_effect_it_requires() {
        let lacks = |rows: &[(&str, Option<(i64, bool)>)]| walk(&written(rows));
        let broken = |n| {
            Err(Broken {
                n,
                why: "a settled entry lacks an effect it requires",
            })
        };
        assert_eq!(
            lacks(&[(CLOSE, None), (ADMIT, Some((1, true))), (CLOSE, None)]),
            broken(2)
        );
        assert_eq!(
            lacks(&[
                (CLOSE, None),
                (ADMIT, Some((1, true))),
                (SUBSCRIBE, Some((2, false)))
            ]),
            broken(2)
        );
        assert_eq!(lacks(&[(ADMIT, None)]), broken(1));
        let follows = follows();
        let write = [Written {
            n: 1,
            op: ADMIT.into(),
            hash: [0; 32],
            cause: None,
            settled: true,
            depth: 0,
        }];
        assert_eq!(
            lacking(&write, &follows).map(|(w, op)| (w.n, op)),
            Some((1, SUBSCRIBE))
        );
        // A requirement registered after an entry does not bind it.
        let later: Vec<Follows> = follows
            .into_iter()
            .map(|f| Follows { since: 2, ..f })
            .collect();
        assert_eq!(lacking(&write, &later), None);
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
