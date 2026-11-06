//! `encrypted::V1` — claim bodies only named recipients can read.
//!
//! The envelope stays public and verifiable (signature, chain, author);
//! **comprehension** is what this module gates, exactly as the claims spec
//! frames it. The construction is the D8 hybrid KEM-DEM from
//! [`cella_crypto::kem_hybrid`]: one sealed payload, per-recipient wraps,
//! every artifact suite-tagged so a future audit can read the protection
//! level of any claim from the log alone.
//!
//! What a wrapped body carries (CBOR, inside `ClaimBody.content` under
//! schema `encrypted::V1`):
//!
//! - `inner_schema` — what the plaintext decodes as once opened. Visible
//!   on purpose: replicas and folds can route/count without reading.
//!   Callers for whom the schema itself is sensitive can wrap under the
//!   generic `"encrypted::Opaque"` inner name.
//! - `suite`, `nonce`, `sealed` — the DEM.
//! - `wraps` — one `(recipient id, kem material, wrapped key)` triple per
//!   recipient. Identifying recipients by `CellId` is a deliberate v1
//!   trade-off (recipient anonymity would need trial decryption).
//!
//! Recipient keys travel as claims too: a cell announces its current
//! encryption key with schema [`SCHEMA_KEM_RECIPIENT`] carrying the
//! hybrid public key's wire form; senders fold the latest announcement
//! per cell. Rotation = announce again.

use cella_crypto::CryptoError;
use cella_crypto::kem_hybrid::{
    HybridPublicKey, HybridSecretKey, KeyWrap, SealedMulti, open_multi, seal_multi,
};
use serde::{Deserialize, Serialize};

use crate::{CellId, ClaimBody};

/// Schema of an encrypted claim body.
pub const SCHEMA_ENCRYPTED_V1: &str = "encrypted::V1";

/// Schema of a cell's encryption-key announcement; content = the hybrid
/// public key's wire form. Latest announcement per cell wins.
pub const SCHEMA_KEM_RECIPIENT: &str = "keys::KemRecipient";

/// Inner-schema name for callers who consider the schema itself sensitive.
pub const INNER_OPAQUE: &str = "encrypted::Opaque";

#[derive(Serialize, Deserialize)]
struct WrapWire {
    recipient: CellId,
    #[serde(with = "serde_bytes")]
    kem: Vec<u8>,
    #[serde(with = "serde_bytes")]
    wrapped: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
struct EncryptedWire {
    inner_schema: String,
    suite: u8,
    nonce: [u8; 12],
    #[serde(with = "serde_bytes")]
    sealed: Vec<u8>,
    wraps: Vec<WrapWire>,
}

/// Failures wrapping or opening encrypted bodies.
#[derive(Debug, thiserror::Error)]
pub enum EncryptedError {
    /// CBOR encode/decode of the wire structure failed.
    #[error("codec: {0}")]
    Codec(String),
    /// The claim body is not `encrypted::V1`.
    #[error("not an encrypted body: schema {0}")]
    WrongSchema(String),
    /// No wrap addressed to the given cell.
    #[error("no wrap for this recipient")]
    NotARecipient,
    /// The cryptographic open failed (wrong key, tamper, wrong aad).
    #[error(transparent)]
    Crypto(#[from] CryptoError),
}

/// Seal `content` (which decodes as `inner_schema` once opened) to the
/// given recipients. `aad` binds external context — pass the enclosing
/// claim's chain position (e.g. the `prev` hash) so a body cannot be
/// replayed under another envelope.
pub fn wrap_body(
    inner_schema: &str,
    content: &[u8],
    recipients: &[(CellId, &HybridPublicKey)],
    aad: &[u8],
) -> Result<ClaimBody, EncryptedError> {
    let keys: Vec<&HybridPublicKey> = recipients.iter().map(|(_, k)| *k).collect();
    let sealed = seal_multi(&keys, content, aad)?;
    let wire = EncryptedWire {
        inner_schema: inner_schema.to_string(),
        suite: sealed.suite,
        nonce: sealed.nonce,
        sealed: sealed.sealed,
        wraps: recipients
            .iter()
            .zip(sealed.wraps)
            .map(|((cell, _), w)| WrapWire {
                recipient: *cell,
                kem: w.kem,
                wrapped: w.wrapped,
            })
            .collect(),
    };
    let mut content = Vec::new();
    ciborium::ser::into_writer(&wire, &mut content)
        .map_err(|e| EncryptedError::Codec(e.to_string()))?;
    Ok(ClaimBody::new(SCHEMA_ENCRYPTED_V1, content))
}

/// The recipients an encrypted body is addressed to (readable without keys —
/// the v1 trade-off, documented above).
pub fn recipients_of(body: &ClaimBody) -> Result<Vec<CellId>, EncryptedError> {
    let wire = decode_wire(body)?;
    Ok(wire.wraps.into_iter().map(|w| w.recipient).collect())
}

/// Open an encrypted body as `me`, returning `(inner_schema, plaintext)`.
/// `aad` must match what the sender bound.
pub fn open_body(
    body: &ClaimBody,
    me: CellId,
    secret: &HybridSecretKey,
    aad: &[u8],
) -> Result<(String, zeroize::Zeroizing<Vec<u8>>), EncryptedError> {
    let wire = decode_wire(body)?;
    let wrap = wire
        .wraps
        .iter()
        .find(|w| w.recipient == me)
        .ok_or(EncryptedError::NotARecipient)?;
    let sealed = SealedMulti {
        suite: wire.suite,
        nonce: wire.nonce,
        sealed: wire.sealed.clone(),
        wraps: Vec::new(),
    };
    let key_wrap = KeyWrap {
        kem: wrap.kem.clone(),
        wrapped: wrap.wrapped.clone(),
    };
    let plain = open_multi(secret, &key_wrap, &sealed, aad)?;
    Ok((wire.inner_schema, plain))
}

fn decode_wire(body: &ClaimBody) -> Result<EncryptedWire, EncryptedError> {
    if body.schema != SCHEMA_ENCRYPTED_V1 {
        return Err(EncryptedError::WrongSchema(body.schema.clone()));
    }
    ciborium::de::from_reader(body.content.as_slice())
        .map_err(|e| EncryptedError::Codec(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use cella_crypto::hash;
    use cella_crypto::kem_hybrid::hybrid_keygen;

    fn cell(n: u8) -> CellId {
        CellId(hash(&[n]))
    }

    #[test]
    fn wrap_open_roundtrip_multi_recipient() {
        let (pk_a, sk_a) = hybrid_keygen().unwrap();
        let (pk_b, sk_b) = hybrid_keygen().unwrap();
        let body = wrap_body(
            "note::Private",
            b"for the stewards only",
            &[(cell(1), &pk_a), (cell(2), &pk_b)],
            b"prev-hash",
        )
        .unwrap();
        assert_eq!(body.schema, SCHEMA_ENCRYPTED_V1);
        assert_eq!(recipients_of(&body).unwrap(), vec![cell(1), cell(2)]);

        let (schema_a, plain_a) = open_body(&body, cell(1), &sk_a, b"prev-hash").unwrap();
        let (schema_b, plain_b) = open_body(&body, cell(2), &sk_b, b"prev-hash").unwrap();
        assert_eq!(schema_a, "note::Private");
        assert_eq!(schema_b, "note::Private");
        assert_eq!(plain_a.as_slice(), b"for the stewards only");
        assert_eq!(plain_b.as_slice(), b"for the stewards only");
    }

    #[test]
    fn non_recipient_and_wrong_key_fail() {
        let (pk_a, _) = hybrid_keygen().unwrap();
        let (_, sk_c) = hybrid_keygen().unwrap();
        let body = wrap_body("note::Private", b"secret", &[(cell(1), &pk_a)], b"").unwrap();
        // Not addressed at all.
        assert!(matches!(
            open_body(&body, cell(3), &sk_c, b""),
            Err(EncryptedError::NotARecipient)
        ));
        // Addressed, but the wrong secret key.
        assert!(matches!(
            open_body(&body, cell(1), &sk_c, b""),
            Err(EncryptedError::Crypto(_))
        ));
    }

    #[test]
    fn wrong_aad_fails() {
        let (pk, sk) = hybrid_keygen().unwrap();
        let body = wrap_body("x", b"secret", &[(cell(1), &pk)], b"claim-7").unwrap();
        assert!(open_body(&body, cell(1), &sk, b"claim-8").is_err());
    }

    #[test]
    fn opaque_inner_schema_hides_intent() {
        let (pk, sk) = hybrid_keygen().unwrap();
        let body = wrap_body(INNER_OPAQUE, b"???", &[(cell(1), &pk)], b"").unwrap();
        let (schema, _) = open_body(&body, cell(1), &sk, b"").unwrap();
        assert_eq!(schema, INNER_OPAQUE);
    }
}
