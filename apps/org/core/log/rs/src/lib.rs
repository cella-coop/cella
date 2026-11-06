//! Signed log of claims for Cella cells.
//!
//! Every cell's authoritative state is its log of signed claims. This crate
//! defines the on-the-wire shape of a single log entry — its serialization,
//! its signing semantics, its hash-chain invariants, and the open set of
//! claim-body categories that mods extend.
//!
//! v0.1 scope:
//!
//!   - [`Claim`] type + uniform [`ClaimBody`] envelope (schema + content)
//!   - [`build`] to construct + sign a single claim at a known log position
//!   - [`verify`] for one claim; [`ChainCursor`] for a chain, claim by claim
//!     from genesis or from a held tail; [`verify_chain`] for a slice
//!   - [`encode`] / [`decode`] using canonical CBOR
//!
//! Persistence lives in `cella-cell` (`OpenedCell::append`, `read_log`).
//!
//! Deferred to a later version (specced; not implemented):
//!
//!   - The `Subscriber` trait and stream-side filtering (will live in
//!     `cella-runtime`, since subscriptions are a runtime concern)
//!
//! corpus:article/architecture
//! Rests on cella-old:change/26-06-26-the-log-entry-is-the-claim.

#![warn(missing_docs)]

pub mod encrypted;

use std::fmt::Write;

use cella_crypto::{CryptoError, PublicKey, hash};
use serde::{Deserialize, Serialize};
use thiserror::Error;

// The crypto types this crate's surface names — a claim's hashes and
// `build`'s signer — so a consumer of the log needs no `cella-crypto`
// dependency for an alias.
pub use cella_crypto::{Hash, Identity};

/// Cell identifier — the BLAKE3 fingerprint of the cell's public key.
/// Re-exposed here as a strongly-typed wrapper around [`Hash`].
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CellId(pub Hash);

impl From<&PublicKey> for CellId {
    fn from(pk: &PublicKey) -> Self {
        Self(pk.fingerprint())
    }
}

impl CellId {
    /// Identity of a public wire form (32 raw bytes = Ed25519, else an
    /// algorithm-prefixed blob) — BLAKE3 over the bytes as given. Equals
    /// the v0 fingerprint for the raw Ed25519 form.
    #[must_use]
    pub fn from_public_form(public_form: &[u8]) -> Self {
        Self(cella_crypto::public_id(public_form))
    }
}

/// Content-hashed identifier for a claim's schema — the BLAKE3 of the canonical
/// CDDL definition that describes a claim's content shape.
///
/// Additive scaffolding for content-hashed schema identifiers:
/// `SchemaId` is the migration target for the open-ended string `schema`
/// fields that claims currently carry to name their content shape.
/// Unused in this revision; see the schema-id migration.
///
/// Identity discipline:
///
///   - `SchemaId = blake3(canonical-CDDL-bytes)` — the hash is the stable
///     identity of the schema; a schema's human-readable name is metadata
///     that can evolve without breaking claims that reference the hash.
///   - Two schemas with identical canonical CDDL bytes are *the same schema*.
///   - Schema evolution is additive: publish a new CDDL file with a new hash;
///     old claims keep decoding because their hash still resolves to the
///     original definition.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SchemaId(pub Hash);

impl SchemaId {
    /// Derive a [`SchemaId`] from canonical CDDL bytes.
    #[must_use]
    pub fn from_cddl_bytes(bytes: &[u8]) -> Self {
        Self(hash(bytes))
    }

    /// Lowercase hex encoding of the underlying hash.
    #[must_use]
    pub fn as_hex(&self) -> String {
        let mut s = String::with_capacity(self.0.len() * 2);
        for b in &self.0 {
            let _ = write!(s, "{b:02x}");
        }
        s
    }
}

/// Author's wall-clock at signing time, as Unix epoch milliseconds.
/// Signed `i64` so pre-1970 values don't accidentally underflow.
pub type Timestamp = i64;

/// The genesis sentinel for the `prev` field on the first claim in a log.
pub const GENESIS_PREV: Hash = [0u8; 32];

/// A signed log entry — the unit of state change in a cell. The whole signed
/// entry *is* the claim.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Claim {
    /// Strictly monotonic per cell, starting at `0` for the genesis claim.
    pub seq: u64,

    /// Hash of the claim at `seq - 1`. The genesis claim uses
    /// [`GENESIS_PREV`] (all-zero).
    pub prev: Hash,

    /// Author's wall-clock when signing. Unreliable on its own; combine with
    /// `seq` and `prev` for ordering.
    pub timestamp: Timestamp,

    /// Cell that authored this claim. Its public key verifies `author_sig`.
    pub author: CellId,

    /// The typed body this claim carries — see [`ClaimBody`].
    pub body: ClaimBody,

    /// Signature over the canonical CBOR encoding of every other field
    /// (`seq`, `prev`, `timestamp`, `author`, `body`), in wire form:
    /// 64 raw bytes = Ed25519 (v0), any other length = an
    /// algorithm-prefixed blob (ML-DSA-44 and onward).
    #[serde(with = "serde_bytes")]
    pub author_sig: Vec<u8>,
}

/// A claim's typed body — uniform `{schema, content}` envelope.
///
/// A claim body is a schema identifier plus opaque content. The earlier
/// 7-variant categorization (Edit / Decision / Proposal / Ratification /
/// Notification / Vouch / Mod) was collapsed 2026-04-20: claim category is now
/// a property of the **schema** itself, not a wire-level enum. See
/// `clients/docs/claims.md`.
///
/// Naming conventions for the `schema` field follow the flat layout:
///
///   - `"host::Provisioned"`, `"members::PositionGrant"` — domain claims
///   - `"decision::..."`, `"proposal::..."`, `"ratification::..."` — governance
///   - `"nest::Add"`, `"edge::Subscribe"`, `"vouch::..."` — relational
///   - `"notify::..."` — ephemeral (routed, not persisted) by convention
///
/// The `schema` field will migrate from `String` to content-hashed
/// [`SchemaId`] in the v1 freeze.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClaimBody {
    /// Schema identifier. v0: string name; v1: content-hashed [`SchemaId`].
    pub schema: String,

    /// Opaque bytes encoded per the schema (typically canonical CBOR).
    #[serde(with = "serde_bytes")]
    pub content: Vec<u8>,
}

impl ClaimBody {
    /// Construct a claim body with the given schema and content bytes.
    pub fn new(schema: impl Into<String>, content: impl Into<Vec<u8>>) -> Self {
        Self {
            schema: schema.into(),
            content: content.into(),
        }
    }
}

/// Errors produced when constructing a claim.
#[derive(Debug, Error)]
pub enum BuildError {
    /// CBOR encoding of the to-be-signed body failed.
    #[error("failed to encode claim body for signing: {0}")]
    Encode(String),

    /// Signing failed (scheme-internal error).
    #[error("signing failed: {0}")]
    Sign(#[from] CryptoError),
}

/// Errors produced when verifying a claim or chain.
#[derive(Debug, Error)]
pub enum VerifyError {
    /// The supplied `prev` did not match the claim's recorded `prev`.
    #[error("prev hash mismatch: expected {expected:?}, got {actual:?}")]
    PrevMismatch {
        /// What `verify`'s caller said the prev should be.
        expected: Hash,
        /// What the claim's `prev` field actually is.
        actual: Hash,
    },

    /// `seq` is not the one the chain expects next.
    #[error("seq not monotonic: expected {expected}, got {actual}")]
    SeqNotMonotonic {
        /// The seq the chain expects: `0` at genesis, else one past the
        /// prior claim's.
        expected: u64,
        /// The seq of this claim.
        actual: u64,
    },

    /// The chain's key lookup resolves no public key for the claim's author:
    /// whoever wrote it is not among the chain's writers.
    #[error("no key for the claim's author")]
    UnknownAuthor,

    /// Signature verification failed.
    #[error("signature verification failed: {0}")]
    BadSignature(#[from] CryptoError),

    /// Encoding the claim for signature verification failed.
    #[error("failed to encode claim for verification: {0}")]
    Encode(String),
}

/// Errors produced when encoding / decoding.
#[derive(Debug, Error)]
pub enum CodecError {
    /// CBOR encoding failed.
    #[error("encode failed: {0}")]
    Encode(String),
    /// CBOR decoding failed.
    #[error("decode failed: {0}")]
    Decode(String),
}

// -- The body that actually gets signed ---------------------------------------

#[derive(Serialize)]
struct ToBeSigned<'a> {
    seq: u64,
    prev: Hash,
    timestamp: Timestamp,
    author: CellId,
    body: &'a ClaimBody,
}

fn canonical_body_bytes(
    seq: u64,
    prev: Hash,
    timestamp: Timestamp,
    author: CellId,
    body: &ClaimBody,
) -> Result<Vec<u8>, String> {
    let to_sign = ToBeSigned {
        seq,
        prev,
        timestamp,
        author,
        body,
    };
    let mut buf = Vec::new();
    ciborium::ser::into_writer(&to_sign, &mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

// -- Public API ---------------------------------------------------------------

/// Build and sign a claim at the given log position. The caller is
/// responsible for passing the correct `seq` (one past the prior claim)
/// and `prev` (the prior claim's content hash) — those come from the
/// log handle, which lives in `cella-cell`.
pub fn build(
    seq: u64,
    prev: Hash,
    timestamp: Timestamp,
    author: CellId,
    body: ClaimBody,
    identity: &Identity,
) -> Result<Claim, BuildError> {
    let bytes =
        canonical_body_bytes(seq, prev, timestamp, author, &body).map_err(BuildError::Encode)?;
    let author_sig = identity.sign(&bytes)?;
    Ok(Claim {
        seq,
        prev,
        timestamp,
        author,
        body,
        author_sig,
    })
}

/// Verify a single claim — checks `prev` matches and the signature
/// validates against the author's public wire form (32 raw bytes =
/// Ed25519, else an algorithm-prefixed blob).
///
/// `expected_prev` is what the verifier knows should come before this
/// claim (e.g. the hash of the prior claim in their copy of the log).
/// For the genesis claim, pass [`GENESIS_PREV`].
pub fn verify(claim: &Claim, author_public: &[u8], expected_prev: Hash) -> Result<(), VerifyError> {
    if claim.prev != expected_prev {
        return Err(VerifyError::PrevMismatch {
            expected: expected_prev,
            actual: claim.prev,
        });
    }
    if CellId::from_public_form(author_public) != claim.author {
        return Err(VerifyError::BadSignature(CryptoError::VerificationFailed));
    }
    let bytes = canonical_body_bytes(
        claim.seq,
        claim.prev,
        claim.timestamp,
        claim.author,
        &claim.body,
    )
    .map_err(VerifyError::Encode)?;
    cella_crypto::verify_detached(author_public, &bytes, &claim.author_sig)?;
    Ok(())
}

/// Where a chain stands between claims: the `seq` its next claim must carry
/// and the hash that claim's `prev` must equal.
///
/// The chain rule lives here once. [`verify_chain`] folds a cursor from
/// genesis over a slice; a replica that holds a log's tail resumes one
/// [`after`](Self::after) it and feeds it claims as they arrive, as
/// `cella-transport`'s sync does.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ChainCursor {
    next_seq: u64,
    prev: Hash,
}

impl ChainCursor {
    /// An empty chain: the next claim is genesis, at `seq` `0` on
    /// [`GENESIS_PREV`].
    #[must_use]
    pub const fn genesis() -> Self {
        Self {
            next_seq: 0,
            prev: GENESIS_PREV,
        }
    }

    /// A chain whose last claim is at `seq` with content hash `hash`: the
    /// next claim is at `seq + 1` and links to `hash`.
    #[must_use]
    pub const fn after(seq: u64, hash: Hash) -> Self {
        Self {
            next_seq: seq + 1,
            prev: hash,
        }
    }

    /// The `seq` the next claim must carry.
    #[must_use]
    pub const fn next_seq(&self) -> u64 {
        self.next_seq
    }

    /// The hash the next claim's `prev` must equal: [`GENESIS_PREV`] at
    /// genesis, else the [`content_hash`] of the last claim accepted.
    #[must_use]
    pub const fn prev(&self) -> Hash {
        self.prev
    }

    /// Accept `claim` as the chain's next entry and advance past it.
    ///
    /// The checks, in order: `claim.seq` is [`next_seq`](Self::next_seq),
    /// else [`VerifyError::SeqNotMonotonic`]; `lookup` resolves
    /// `claim.author` to a public wire form, else
    /// [`VerifyError::UnknownAuthor`]; and [`verify`] passes against
    /// [`prev`](Self::prev) — the link, the author's binding to that key,
    /// the signature. On any error the cursor stays where it was.
    ///
    /// `lookup` says who may write the chain: a single-author log answers
    /// its own cell's key and nothing else; a circle walks its membership.
    pub fn accept<F, K>(&mut self, claim: &Claim, lookup: F) -> Result<(), VerifyError>
    where
        F: FnOnce(CellId) -> Option<K>,
        K: AsRef<[u8]>,
    {
        if claim.seq != self.next_seq {
            return Err(VerifyError::SeqNotMonotonic {
                expected: self.next_seq,
                actual: claim.seq,
            });
        }
        let key = lookup(claim.author).ok_or(VerifyError::UnknownAuthor)?;
        verify(claim, key.as_ref(), self.prev)?;
        self.prev = content_hash(claim).map_err(VerifyError::Encode)?;
        self.next_seq += 1;
        Ok(())
    }
}

/// Verify a slice of claims as a chain from genesis — each one's `prev` must
/// match the previous one's content hash, `seq` must be strictly monotonic,
/// and every signature must validate. A [`ChainCursor`] folded over the
/// slice.
///
/// `lookup` resolves each claim's [`CellId`] author to its public wire
/// form. In a single-author cell this is trivial; in multi-author cells (a
/// circle with multiple member writers) it walks the membership.
pub fn verify_chain<F>(claims: &[Claim], mut lookup: F) -> Result<(), VerifyError>
where
    F: FnMut(CellId) -> Option<Vec<u8>>,
{
    let mut cursor = ChainCursor::genesis();
    for claim in claims {
        cursor.accept(claim, &mut lookup)?;
    }
    Ok(())
}

/// Compute the content hash of a claim — the value the next claim's
/// `prev` field must contain. The hash is over the canonical CBOR encoding
/// of the claim minus its signature; including the signature would mean
/// chains were fragile to ancillary signature representations.
pub fn content_hash(claim: &Claim) -> Result<Hash, String> {
    let bytes = canonical_body_bytes(
        claim.seq,
        claim.prev,
        claim.timestamp,
        claim.author,
        &claim.body,
    )?;
    Ok(hash(&bytes))
}

/// Encode a claim as canonical CBOR — for storage and wire transmission.
pub fn encode(claim: &Claim) -> Result<Vec<u8>, CodecError> {
    let mut buf = Vec::new();
    ciborium::ser::into_writer(claim, &mut buf).map_err(|e| CodecError::Encode(e.to_string()))?;
    Ok(buf)
}

/// Decode a claim from canonical CBOR.
pub fn decode(bytes: &[u8]) -> Result<Claim, CodecError> {
    ciborium::de::from_reader(bytes).map_err(|e| CodecError::Decode(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use cella_crypto::{Identity, hash};

    fn fixture_edit(schema: &str, content: &[u8]) -> ClaimBody {
        ClaimBody::new(schema.to_string(), content.to_vec())
    }

    /// Tests default to the PQ identity (D8) — one test pins Ed25519.
    fn ident() -> (Identity, CellId, Vec<u8>) {
        let id = Identity::generate();
        let public = id.public_form();
        let author = CellId::from_public_form(&public);
        (id, author, public)
    }

    #[test]
    fn build_then_verify_genesis() {
        let (id, author, public) = ident();
        let body = fixture_edit("test::Genesis", b"hello");
        let claim =
            build(0, GENESIS_PREV, 1_700_000_000_000, author, body, &id).expect("build genesis");
        verify(&claim, &public, GENESIS_PREV).expect("verify genesis");
    }

    #[test]
    fn ed25519_identity_still_verifies() {
        let id = Identity::generate_ed25519();
        let public = id.public_form();
        let author = CellId::from_public_form(&public);
        let claim = build(
            0,
            GENESIS_PREV,
            1,
            author,
            fixture_edit("test::V0", b"x"),
            &id,
        )
        .unwrap();
        assert_eq!(claim.author_sig.len(), 64);
        verify(&claim, &public, GENESIS_PREV).expect("bare ed25519 form verifies");
    }

    #[test]
    fn verify_fails_when_author_mismatches_pk() {
        let (id, author, _) = ident();
        let (_, _, other_public) = ident();
        let body = fixture_edit("test::WrongAuthor", b"x");
        let claim = build(0, GENESIS_PREV, 0, author, body, &id).unwrap();
        let err = verify(&claim, &other_public, GENESIS_PREV).unwrap_err();
        assert!(matches!(err, VerifyError::BadSignature(_)));
    }

    #[test]
    fn verify_fails_on_tampered_body() {
        let (id, author, public) = ident();
        let body = fixture_edit("test::Original", b"original");
        let mut claim = build(0, GENESIS_PREV, 0, author, body, &id).unwrap();
        // Tamper with the body after signing.
        claim.body.content = b"tampered".to_vec();
        let err = verify(&claim, &public, GENESIS_PREV).unwrap_err();
        assert!(matches!(err, VerifyError::BadSignature(_)));
    }

    #[test]
    fn verify_fails_on_wrong_prev() {
        let (id, author, public) = ident();
        let body = fixture_edit("test::PrevCheck", b"x");
        let claim = build(0, GENESIS_PREV, 0, author, body, &id).unwrap();
        let bogus_prev = hash(b"not the genesis sentinel");
        let err = verify(&claim, &public, bogus_prev).unwrap_err();
        assert!(matches!(err, VerifyError::PrevMismatch { .. }));
    }

    #[test]
    fn build_chain_verifies_end_to_end() {
        let (id, author, public) = ident();

        let m0 = build(
            0,
            GENESIS_PREV,
            1,
            author,
            fixture_edit("test::A", b"a"),
            &id,
        )
        .unwrap();
        let m0_hash = content_hash(&m0).unwrap();

        let m1 = build(1, m0_hash, 2, author, fixture_edit("test::B", b"b"), &id).unwrap();
        let m1_hash = content_hash(&m1).unwrap();

        let m2 = build(2, m1_hash, 3, author, fixture_edit("test::C", b"c"), &id).unwrap();

        verify_chain(&[m0, m1, m2], |aid| (aid == author).then(|| public.clone()))
            .expect("chain verifies");
    }

    #[test]
    fn chain_rejects_seq_gap() {
        let (id, author, public) = ident();

        let m0 = build(
            0,
            GENESIS_PREV,
            1,
            author,
            fixture_edit("test::A", b"a"),
            &id,
        )
        .unwrap();
        let m0_hash = content_hash(&m0).unwrap();

        // Seq jumps from 0 to 2 — should reject.
        let m_skip = build(2, m0_hash, 2, author, fixture_edit("test::Skip", b"x"), &id).unwrap();

        let err =
            verify_chain(&[m0, m_skip], |aid| (aid == author).then(|| public.clone())).unwrap_err();
        assert!(matches!(
            err,
            VerifyError::SeqNotMonotonic {
                expected: 1,
                actual: 2
            }
        ));
    }

    /// `n` claims chained from genesis by one author, with the author's id
    /// and public form.
    fn chain(n: u64) -> (CellId, Vec<u8>, Vec<Claim>) {
        let (id, author, public) = ident();
        let mut claims: Vec<Claim> = Vec::new();
        for seq in 0..n {
            let prev = claims
                .last()
                .map_or(GENESIS_PREV, |c| content_hash(c).unwrap());
            let body = fixture_edit("test::Edit", &seq.to_le_bytes());
            claims.push(build(seq, prev, 1, author, body, &id).unwrap());
        }
        (author, public, claims)
    }

    #[test]
    fn chain_rejects_a_first_claim_past_genesis() {
        let (author, public, claims) = chain(2);
        let err =
            verify_chain(&claims[1..], |aid| (aid == author).then(|| public.clone())).unwrap_err();
        assert!(matches!(
            err,
            VerifyError::SeqNotMonotonic {
                expected: 0,
                actual: 1
            }
        ));
    }

    #[test]
    fn chain_rejects_an_author_it_has_no_key_for() {
        let (_, _, claims) = chain(1);
        let err = verify_chain(&claims, |_| None).unwrap_err();
        assert!(matches!(err, VerifyError::UnknownAuthor));
    }

    #[test]
    fn a_cursor_resumes_after_a_held_tail() {
        let (author, public, claims) = chain(3);
        let lookup = |aid: CellId| (aid == author).then_some(public.as_slice());
        let mut cursor = ChainCursor::after(0, content_hash(&claims[0]).unwrap());
        // The held claim, sent again, is a replay, not the next.
        let err = cursor.accept(&claims[0], lookup).unwrap_err();
        assert!(matches!(
            err,
            VerifyError::SeqNotMonotonic {
                expected: 1,
                actual: 0
            }
        ));
        for claim in &claims[1..] {
            cursor.accept(claim, lookup).expect("continues the tail");
        }
        assert_eq!(cursor.next_seq(), 3);
        assert_eq!(cursor.prev(), content_hash(&claims[2]).unwrap());
    }

    #[test]
    fn a_refused_claim_leaves_the_cursor_where_it_was() {
        let (author, public, claims) = chain(2);
        let lookup = |aid: CellId| (aid == author).then_some(public.as_slice());
        let mut cursor = ChainCursor::genesis();
        cursor.accept(&claims[0], lookup).expect("genesis");
        let held = cursor;

        let mut tampered = claims[1].clone();
        tampered.body.content = b"tampered".to_vec();
        let err = cursor.accept(&tampered, lookup).unwrap_err();
        assert!(matches!(err, VerifyError::BadSignature(_)));
        let err = cursor.accept(&claims[1], |_| None::<&[u8]>).unwrap_err();
        assert!(matches!(err, VerifyError::UnknownAuthor));
        assert_eq!(cursor, held);

        cursor
            .accept(&claims[1], lookup)
            .expect("the true claim still follows");
        assert_eq!(cursor.next_seq(), 2);
    }

    #[test]
    fn chain_rejects_broken_prev() {
        let (id, author, public) = ident();

        let m0 = build(
            0,
            GENESIS_PREV,
            1,
            author,
            fixture_edit("test::A", b"a"),
            &id,
        )
        .unwrap();
        // The bogus m1 reuses GENESIS_PREV instead of m0's content hash.
        let m1 = build(
            1,
            GENESIS_PREV,
            2,
            author,
            fixture_edit("test::B", b"b"),
            &id,
        )
        .unwrap();

        let err =
            verify_chain(&[m0, m1], |aid| (aid == author).then(|| public.clone())).unwrap_err();
        assert!(matches!(err, VerifyError::PrevMismatch { .. }));
    }

    #[test]
    fn encode_decode_roundtrip() {
        let (id, author, public) = ident();
        let claim = build(
            0,
            GENESIS_PREV,
            42,
            author,
            fixture_edit("test::Roundtrip", b"payload"),
            &id,
        )
        .unwrap();
        let bytes = encode(&claim).expect("encode");
        let restored = decode(&bytes).expect("decode");
        assert_eq!(claim, restored);
        verify(&restored, &public, GENESIS_PREV).expect("decoded claim verifies");
    }

    #[test]
    fn vouch_claim_roundtrips() {
        // Under the collapsed envelope, a vouch is a claim with schema
        // "vouch::..." and CBOR content encoding the vouch body.
        let (id, author, _) = ident();
        let subject = CellId(hash(b"subject-cell"));
        // Opaque placeholder content — real mods encode their own CBOR per schema.
        let mut content = Vec::new();
        content.extend_from_slice(&subject.0);
        let body = ClaimBody::new("vouch::unique-human", content);
        let claim = build(0, GENESIS_PREV, 0, author, body, &id).unwrap();
        let bytes = encode(&claim).unwrap();
        let restored = decode(&bytes).unwrap();
        assert_eq!(claim, restored);
        assert_eq!(restored.body.schema, "vouch::unique-human");
    }

    #[test]
    fn mod_claim_roundtrips() {
        let (id, author, _) = ident();
        let body = ClaimBody::new("invoices::InvoiceCreate", vec![1, 2, 3, 4, 5]);
        let claim = build(0, GENESIS_PREV, 0, author, body, &id).unwrap();
        let bytes = encode(&claim).unwrap();
        let restored = decode(&bytes).unwrap();
        assert_eq!(claim, restored);
    }

    #[test]
    fn cellid_from_public_key_matches_fingerprint() {
        let id = Identity::generate_ed25519();
        let cella_crypto::Identity::Ed25519(kp) = &id else {
            unreachable!()
        };
        let cell_id = CellId::from_public_form(&id.public_form());
        assert_eq!(cell_id.0, kp.public_key().fingerprint());
        assert_eq!(cell_id, CellId::from(&kp.public_key()));
    }
}
