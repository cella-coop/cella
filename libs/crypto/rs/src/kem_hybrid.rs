//! Hybrid encrypt-to-recipients — the D8 construction for encrypted claims.
//!
//! **KEM**: X25519 + ML-KEM-768, combined. The payload is protected if
//! *either* leg holds: the shared secret is a domain-separated KDF over
//! both legs' secrets, so breaking one scheme alone yields nothing.
//!
//! **DEM, multi-recipient**: one random 32-byte payload key seals the
//! content once (ChaCha20-Poly1305, AAD = the claim's envelope hash); the
//! payload key is then wrapped per recipient under that recipient's hybrid
//! shared secret. N recipients cost N small wraps, not N payload copies.
//!
//! **Self-describing**: every recipient key, wrap, and payload carries its
//! suite byte, so a future audit can answer "which suite protects this
//! claim" from the log alone, and new suites register additively.

use chacha20poly1305::aead::{Aead, AeadCore, KeyInit, OsRng, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use fips203::traits::{Decaps as _, Encaps as _, KeyGen as _, SerDes as _};
use zeroize::Zeroizing;

use crate::CryptoError;

/// KEM suite identifier byte.
pub type KemSuite = u8;

/// X25519 + ML-KEM-768 hybrid — the D8 default for encrypted claims.
pub const KEM_SUITE_HYBRID_X25519_MLKEM768: KemSuite = 0x01;

const X25519_LEN: usize = 32;
const MLKEM_EK_LEN: usize = fips203::ml_kem_768::EK_LEN;
const MLKEM_CT_LEN: usize = fips203::ml_kem_768::CT_LEN;
const KDF_CONTEXT: &str = "cella encrypted-claim hybrid v1";

/// A recipient's hybrid public key (both legs), suite-prefixed on the wire.
pub struct HybridPublicKey {
    x25519: x25519_dalek::PublicKey,
    mlkem: fips203::ml_kem_768::EncapsKey,
}

/// A recipient's hybrid secret key (both legs).
pub struct HybridSecretKey {
    x25519: x25519_dalek::StaticSecret,
    mlkem: fips203::ml_kem_768::DecapsKey,
}

impl HybridSecretKey {
    /// Serialize both legs (32 raw X25519 bytes ++ ML-KEM decaps key) for
    /// keystore persistence. Secret material — store 0600, zeroize copies.
    #[must_use]
    pub fn to_bytes(&self) -> Zeroizing<Vec<u8>> {
        let mut out = Zeroizing::new(Vec::with_capacity(32 + fips203::ml_kem_768::DK_LEN));
        out.extend_from_slice(self.x25519.as_bytes());
        let dk = Zeroizing::new(self.mlkem.clone().into_bytes());
        out.extend_from_slice(dk.as_ref());
        out
    }

    /// Rebuild from [`Self::to_bytes`] output.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() != 32 + fips203::ml_kem_768::DK_LEN {
            return Err(CryptoError::MalformedIdentity);
        }
        let (x_bytes, dk_bytes) = bytes.split_at(32);
        let x_arr: [u8; 32] = x_bytes.try_into().expect("split length");
        let dk_arr: Zeroizing<[u8; fips203::ml_kem_768::DK_LEN]> = Zeroizing::new(
            dk_bytes.try_into().map_err(|_| CryptoError::MalformedIdentity)?,
        );
        let mlkem = fips203::ml_kem_768::DecapsKey::try_from_bytes(*dk_arr)
            .map_err(|_| CryptoError::MalformedIdentity)?;
        Ok(Self { x25519: x25519_dalek::StaticSecret::from(x_arr), mlkem })
    }
}

/// Generate a hybrid recipient keypair from OS randomness.
pub fn hybrid_keygen() -> Result<(HybridPublicKey, HybridSecretKey), CryptoError> {
    let x_secret = x25519_dalek::StaticSecret::random_from_rng(rand_core::OsRng);
    let x_public = x25519_dalek::PublicKey::from(&x_secret);
    let (ek, dk) =
        fips203::ml_kem_768::KG::try_keygen().map_err(|_| CryptoError::KeygenFailed)?;
    Ok((
        HybridPublicKey { x25519: x_public, mlkem: ek },
        HybridSecretKey { x25519: x_secret, mlkem: dk },
    ))
}

impl HybridPublicKey {
    /// Wire form: `[suite byte][x25519 pk 32][ml-kem ek 1184]`.
    #[must_use]
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = vec![KEM_SUITE_HYBRID_X25519_MLKEM768];
        out.extend_from_slice(self.x25519.as_bytes());
        out.extend_from_slice(&self.mlkem.clone().into_bytes());
        out
    }

    /// Parse the wire form; fails closed on an unknown suite byte.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        let (&suite, rest) =
            bytes.split_first().ok_or(CryptoError::MalformedPublicKey)?;
        if suite != KEM_SUITE_HYBRID_X25519_MLKEM768 {
            return Err(CryptoError::UnknownAlgorithm);
        }
        if rest.len() != X25519_LEN + MLKEM_EK_LEN {
            return Err(CryptoError::MalformedPublicKey);
        }
        let (x_bytes, ek_bytes) = rest.split_at(X25519_LEN);
        let x_arr: [u8; 32] = x_bytes.try_into().expect("split length");
        let ek_arr: [u8; MLKEM_EK_LEN] =
            ek_bytes.try_into().map_err(|_| CryptoError::MalformedPublicKey)?;
        let mlkem = fips203::ml_kem_768::EncapsKey::try_from_bytes(ek_arr)
            .map_err(|_| CryptoError::MalformedPublicKey)?;
        Ok(Self { x25519: x25519_dalek::PublicKey::from(x_arr), mlkem })
    }
}

/// One recipient's wrapped copy of the payload key.
pub struct KeyWrap {
    /// KEM material: `[suite][x25519 ephemeral pk 32][ml-kem ct 1088]`.
    pub kem: Vec<u8>,
    /// The payload key sealed under the hybrid shared secret.
    pub wrapped: Vec<u8>,
}

/// A payload sealed once for many recipients.
pub struct SealedMulti {
    /// KEM suite the wraps use.
    pub suite: KemSuite,
    /// ChaCha20-Poly1305 nonce for the payload seal.
    pub nonce: [u8; 12],
    /// AEAD ciphertext + tag of the content.
    pub sealed: Vec<u8>,
    /// One wrap per recipient, in the order given to [`seal_multi`].
    pub wraps: Vec<KeyWrap>,
}

/// Combine both legs into the wrapping key. Domain-separated; the transcript
/// binds both public contributions so a leg cannot be swapped out.
fn combine(
    dh: &x25519_dalek::SharedSecret,
    mlkem_ss: &[u8],
    eph_pk: &x25519_dalek::PublicKey,
    mlkem_ct: &[u8],
) -> Zeroizing<[u8; 32]> {
    // The IKM concatenation holds both shared secrets — scrub it on drop
    // like every other secret buffer in this crate.
    let mut ikm = Zeroizing::new(Vec::with_capacity(32 + 32 + 32 + MLKEM_CT_LEN));
    ikm.extend_from_slice(dh.as_bytes());
    ikm.extend_from_slice(mlkem_ss);
    ikm.extend_from_slice(eph_pk.as_bytes());
    ikm.extend_from_slice(mlkem_ct);
    let key = blake3::derive_key(KDF_CONTEXT, &ikm);
    Zeroizing::new(key)
}

/// Seal `plaintext` once for every recipient, binding `aad` (the claim's
/// envelope hash) into the payload seal.
pub fn seal_multi(
    recipients: &[&HybridPublicKey],
    plaintext: &[u8],
    aad: &[u8],
) -> Result<SealedMulti, CryptoError> {
    // Zero recipients would succeed with zero wraps — a permanently
    // unopenable ciphertext a caller could append to a log believing it
    // sealed something. Refuse loudly instead.
    if recipients.is_empty() {
        return Err(CryptoError::EncryptionFailed);
    }
    // The DEM: one random payload key, one seal.
    let mut key_bytes = Zeroizing::new([0u8; 32]);
    {
        use rand_core::RngCore as _;
        rand_core::OsRng.fill_bytes(key_bytes.as_mut());
    }
    let payload_key = key_bytes;
    let cipher = ChaCha20Poly1305::new(Key::from_slice(payload_key.as_ref()));
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let sealed = cipher
        .encrypt(&nonce, Payload { msg: plaintext, aad })
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // The KEM: wrap the payload key per recipient under both legs.
    let mut wraps = Vec::with_capacity(recipients.len());
    for recipient in recipients {
        let eph = x25519_dalek::EphemeralSecret::random_from_rng(rand_core::OsRng);
        let eph_pk = x25519_dalek::PublicKey::from(&eph);
        let dh = eph.diffie_hellman(&recipient.x25519);
        let (mlkem_ss, mlkem_ct) =
            recipient.mlkem.try_encaps().map_err(|_| CryptoError::EncryptionFailed)?;
        let ct_bytes = mlkem_ct.into_bytes();
        let ss = Zeroizing::new(mlkem_ss.into_bytes());
        let wrap_key = combine(&dh, ss.as_ref(), &eph_pk, &ct_bytes);

        let wrap_cipher = ChaCha20Poly1305::new(Key::from_slice(wrap_key.as_ref()));
        // Zero nonce is safe: every wrap key is unique to this (recipient,
        // message) pair by construction.
        let wrapped = wrap_cipher
            .encrypt(Nonce::from_slice(&[0u8; 12]), payload_key.as_slice())
            .map_err(|_| CryptoError::EncryptionFailed)?;

        let mut kem = vec![KEM_SUITE_HYBRID_X25519_MLKEM768];
        kem.extend_from_slice(eph_pk.as_bytes());
        kem.extend_from_slice(&ct_bytes);
        wraps.push(KeyWrap { kem, wrapped });
    }

    Ok(SealedMulti {
        suite: KEM_SUITE_HYBRID_X25519_MLKEM768,
        nonce: nonce.into(),
        sealed,
        wraps,
    })
}

/// Open a [`SealedMulti`] with one recipient's secret key and its wrap.
pub fn open_multi(
    recipient: &HybridSecretKey,
    wrap: &KeyWrap,
    sealed: &SealedMulti,
    aad: &[u8],
) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
    let (&suite, rest) =
        wrap.kem.split_first().ok_or(CryptoError::DecryptionFailed)?;
    if suite != KEM_SUITE_HYBRID_X25519_MLKEM768 || sealed.suite != suite {
        return Err(CryptoError::UnknownAlgorithm);
    }
    if rest.len() != X25519_LEN + MLKEM_CT_LEN {
        return Err(CryptoError::DecryptionFailed);
    }
    let (eph_bytes, ct_bytes) = rest.split_at(X25519_LEN);
    let eph_arr: [u8; 32] = eph_bytes.try_into().expect("split length");
    let eph_pk = x25519_dalek::PublicKey::from(eph_arr);
    let dh = recipient.x25519.diffie_hellman(&eph_pk);
    let ct_arr: [u8; MLKEM_CT_LEN] =
        ct_bytes.try_into().map_err(|_| CryptoError::DecryptionFailed)?;
    let ct = fips203::ml_kem_768::CipherText::try_from_bytes(ct_arr)
        .map_err(|_| CryptoError::DecryptionFailed)?;
    let mlkem_ss =
        recipient.mlkem.try_decaps(&ct).map_err(|_| CryptoError::DecryptionFailed)?;
    let ss = Zeroizing::new(mlkem_ss.into_bytes());
    let wrap_key = combine(&dh, ss.as_ref(), &eph_pk, ct_bytes);

    let wrap_cipher = ChaCha20Poly1305::new(Key::from_slice(wrap_key.as_ref()));
    let payload_key = Zeroizing::new(
        wrap_cipher
            .decrypt(Nonce::from_slice(&[0u8; 12]), wrap.wrapped.as_slice())
            .map_err(|_| CryptoError::DecryptionFailed)?,
    );
    let key: &[u8; 32] =
        payload_key.as_slice().try_into().map_err(|_| CryptoError::DecryptionFailed)?;

    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let plain = cipher
        .decrypt(
            Nonce::from_slice(&sealed.nonce),
            Payload { msg: &sealed.sealed, aad },
        )
        .map_err(|_| CryptoError::DecryptionFailed)?;
    Ok(Zeroizing::new(plain))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multi_recipient_roundtrip() {
        let (pk1, sk1) = hybrid_keygen().unwrap();
        let (pk2, sk2) = hybrid_keygen().unwrap();
        let sealed =
            seal_multi(&[&pk1, &pk2], b"for both of you", b"envelope-hash").unwrap();
        assert_eq!(sealed.wraps.len(), 2);
        let p1 = open_multi(&sk1, &sealed.wraps[0], &sealed, b"envelope-hash").unwrap();
        let p2 = open_multi(&sk2, &sealed.wraps[1], &sealed, b"envelope-hash").unwrap();
        assert_eq!(p1.as_slice(), b"for both of you");
        assert_eq!(p2.as_slice(), b"for both of you");
    }

    #[test]
    fn wrong_recipient_and_wrong_wrap_fail() {
        let (pk1, _sk1) = hybrid_keygen().unwrap();
        let (pk2, sk2) = hybrid_keygen().unwrap();
        let (_, sk3) = hybrid_keygen().unwrap();
        let sealed = seal_multi(&[&pk1, &pk2], b"secret", b"").unwrap();
        // A non-recipient fails on any wrap.
        assert!(open_multi(&sk3, &sealed.wraps[0], &sealed, b"").is_err());
        // A recipient using the OTHER recipient's wrap fails.
        assert!(open_multi(&sk2, &sealed.wraps[0], &sealed, b"").is_err());
    }

    #[test]
    fn empty_recipients_refused() {
        assert!(seal_multi(&[], b"secret", b"aad").is_err());
    }

    #[test]
    fn tampered_payload_and_aad_fail() {
        let (pk, sk) = hybrid_keygen().unwrap();
        let mut sealed = seal_multi(&[&pk], b"secret", b"claim-1").unwrap();
        assert!(open_multi(&sk, &sealed.wraps[0], &sealed, b"claim-2").is_err());
        let last = sealed.sealed.len() - 1;
        sealed.sealed[last] ^= 1;
        assert!(open_multi(&sk, &sealed.wraps[0], &sealed, b"claim-1").is_err());
    }

    #[test]
    fn public_key_wire_form_roundtrips_and_fails_closed() {
        let (pk, sk) = hybrid_keygen().unwrap();
        let bytes = pk.to_bytes();
        assert_eq!(bytes[0], KEM_SUITE_HYBRID_X25519_MLKEM768);
        let pk2 = HybridPublicKey::from_bytes(&bytes).unwrap();
        let sealed = seal_multi(&[&pk2], b"via wire form", b"").unwrap();
        assert_eq!(
            open_multi(&sk, &sealed.wraps[0], &sealed, b"").unwrap().as_slice(),
            b"via wire form"
        );
        // Unknown suite byte fails closed.
        let mut alien = bytes.clone();
        alien[0] = 0x7e;
        assert!(matches!(
            HybridPublicKey::from_bytes(&alien),
            Err(CryptoError::UnknownAlgorithm)
        ));
    }

    #[test]
    fn a_broken_classical_leg_alone_reveals_nothing() {
        // Simulate "X25519 is pwned": the adversary knows the DH secret but
        // not the ML-KEM secret. They still cannot derive the wrap key,
        // because combine() needs both legs. We model this by decapsulating
        // with the WRONG ML-KEM key while everything classical is right.
        let (pk, sk) = hybrid_keygen().unwrap();
        let (_, wrong) = hybrid_keygen().unwrap();
        let sealed = seal_multi(&[&pk], b"post-quantum holds", b"").unwrap();
        let franken = HybridSecretKey { x25519: sk.x25519.clone(), mlkem: wrong.mlkem };
        assert!(open_multi(&franken, &sealed.wraps[0], &sealed, b"").is_err());
    }
}
