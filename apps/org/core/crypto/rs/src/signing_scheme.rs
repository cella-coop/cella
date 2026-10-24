//! Multi-algorithm signing — the v1 `SigningScheme` seam, now real.
//!
//! v0 of `lib::crypto` uses Ed25519 directly via concrete types ([`Keypair`],
//! [`PublicKey`], [`Signature`] in the parent module). v1 dispatches over a
//! trait, with ML-DSA-44 (FIPS 204) as the primary post-quantum scheme and
//! Ed25519 retained for backward compatibility with v0 data.
//!
//! This module carries the trait, both scheme impls, and the
//! algorithm-prefixed blob encoding that runtime dispatch routes on. The
//! workspace's signing call sites author through [`Identity`](super::Identity),
//! which dispatches here (the envelope cutover shipped 2026-08-15).
//!
//! ## Wire encoding
//!
//! A *blob* is `[MULTISIG_* algorithm-ID byte] ++ [scheme-native bytes]`, for
//! both public keys and signatures. [`verify_blob`] reads the prefix and
//! routes to the matching scheme's verify; unknown IDs and mismatched
//! key/signature algorithms fail closed. New schemes register additively via
//! a new `MULTISIG_*` constant + trait impl + dispatch arm.
//!
//! ## RNG note
//!
//! `keygen`/`sign` take no caller-supplied RNG: ML-DSA hedged signing needs
//! randomness internally, and fips204's `default-rng` feature sources it
//! from the OS. Deterministic recovery uses [`MlDsa44::keygen_from_seed`]
//! (fips204's seeded keygen), so both schemes rebuild from a 32-byte seed.

use fips204::traits::{KeyGen as _, SerDes as _, Signer as _, Verifier as _};

use crate::{CryptoError, MultisigAlgo, MULTISIG_ED25519, MULTISIG_ML_DSA_44};

/// A signature scheme: keygen, sign, verify, and byte-level (de)serialization
/// for its key and signature types. One impl per `MULTISIG_*` algorithm.
pub trait SigningScheme {
    /// Multisig algorithm ID this scheme's blobs are prefixed with.
    const ALGO_ID: MultisigAlgo;

    /// Verifying half.
    type PublicKey;
    /// Signing half.
    type SecretKey;
    /// Detached signature.
    type Signature;

    /// Generate a fresh keypair from OS randomness.
    fn keygen() -> Result<(Self::PublicKey, Self::SecretKey), CryptoError>;

    /// Sign `msg` with `sk`.
    fn sign(sk: &Self::SecretKey, msg: &[u8]) -> Result<Self::Signature, CryptoError>;

    /// Verify `sig` over `msg` against `pk`.
    fn verify(pk: &Self::PublicKey, msg: &[u8], sig: &Self::Signature)
        -> Result<(), CryptoError>;

    /// Serialize a public key to scheme-native bytes (no algorithm prefix).
    fn public_key_to_bytes(pk: &Self::PublicKey) -> Vec<u8>;

    /// Deserialize a public key from scheme-native bytes.
    fn public_key_from_bytes(bytes: &[u8]) -> Result<Self::PublicKey, CryptoError>;

    /// Serialize a signature to scheme-native bytes (no algorithm prefix).
    fn signature_to_bytes(sig: &Self::Signature) -> Vec<u8>;

    /// Deserialize a signature from scheme-native bytes.
    fn signature_from_bytes(bytes: &[u8]) -> Result<Self::Signature, CryptoError>;

    /// Public key as an algorithm-prefixed blob.
    fn public_key_blob(pk: &Self::PublicKey) -> Vec<u8> {
        prefixed(Self::ALGO_ID, &Self::public_key_to_bytes(pk))
    }

    /// Signature as an algorithm-prefixed blob.
    fn signature_blob(sig: &Self::Signature) -> Vec<u8> {
        prefixed(Self::ALGO_ID, &Self::signature_to_bytes(sig))
    }
}

/// Prefix `bytes` with an algorithm-ID byte.
fn prefixed(algo: MultisigAlgo, bytes: &[u8]) -> Vec<u8> {
    let mut blob = Vec::with_capacity(1 + bytes.len());
    blob.push(algo);
    blob.extend_from_slice(bytes);
    blob
}

/// Split an algorithm-prefixed blob into `(algo, bytes)`.
fn split(blob: &[u8]) -> Result<(MultisigAlgo, &[u8]), CryptoError> {
    match blob.split_first() {
        Some((algo, rest)) => Ok((*algo, rest)),
        None => Err(CryptoError::MalformedSignature),
    }
}

/// Verify an algorithm-prefixed signature blob over `msg` against an
/// algorithm-prefixed public-key blob. The two prefixes must agree, and the
/// algorithm must be known; both failures are [`CryptoError::UnknownAlgorithm`]
/// territory rather than a silent fall-through.
pub fn verify_blob(pk_blob: &[u8], msg: &[u8], sig_blob: &[u8]) -> Result<(), CryptoError> {
    let (pk_algo, pk_bytes) =
        split(pk_blob).map_err(|_| CryptoError::MalformedPublicKey)?;
    let (sig_algo, sig_bytes) = split(sig_blob)?;
    if pk_algo != sig_algo {
        return Err(CryptoError::UnknownAlgorithm);
    }
    match pk_algo {
        MULTISIG_ED25519 => {
            let pk = Ed25519::public_key_from_bytes(pk_bytes)?;
            let sig = Ed25519::signature_from_bytes(sig_bytes)?;
            Ed25519::verify(&pk, msg, &sig)
        }
        MULTISIG_ML_DSA_44 => {
            let pk = MlDsa44::public_key_from_bytes(pk_bytes)?;
            let sig = MlDsa44::signature_from_bytes(sig_bytes)?;
            MlDsa44::verify(&pk, msg, &sig)
        }
        _ => Err(CryptoError::UnknownAlgorithm),
    }
}

// ─── Ed25519 (carried forward from v0) ──────────────────────────────────────

/// Ed25519 — `MULTISIG_ED25519`. Wraps the v0 concrete types so blobs signed
/// before the v1 cutover keep verifying through the same dispatch path.
pub struct Ed25519;

impl SigningScheme for Ed25519 {
    const ALGO_ID: MultisigAlgo = MULTISIG_ED25519;

    type PublicKey = crate::PublicKey;
    type SecretKey = crate::Keypair;
    type Signature = crate::Signature;

    fn keygen() -> Result<(Self::PublicKey, Self::SecretKey), CryptoError> {
        let kp = crate::Keypair::generate();
        Ok((kp.public_key(), kp))
    }

    fn sign(sk: &Self::SecretKey, msg: &[u8]) -> Result<Self::Signature, CryptoError> {
        Ok(sk.sign(msg))
    }

    fn verify(
        pk: &Self::PublicKey,
        msg: &[u8],
        sig: &Self::Signature,
    ) -> Result<(), CryptoError> {
        pk.verify(msg, sig)
    }

    fn public_key_to_bytes(pk: &Self::PublicKey) -> Vec<u8> {
        pk.as_bytes().to_vec()
    }

    fn public_key_from_bytes(bytes: &[u8]) -> Result<Self::PublicKey, CryptoError> {
        let arr: &[u8; crate::PUBLIC_KEY_LEN] =
            bytes.try_into().map_err(|_| CryptoError::MalformedPublicKey)?;
        crate::PublicKey::from_bytes(arr)
    }

    fn signature_to_bytes(sig: &Self::Signature) -> Vec<u8> {
        sig.to_bytes().to_vec()
    }

    fn signature_from_bytes(bytes: &[u8]) -> Result<Self::Signature, CryptoError> {
        let arr: &[u8; crate::SIGNATURE_LEN] =
            bytes.try_into().map_err(|_| CryptoError::MalformedSignature)?;
        crate::Signature::from_bytes(arr)
    }
}

// ─── ML-DSA-44 (FIPS 204) ───────────────────────────────────────────────────

/// ML-DSA-44 — `MULTISIG_ML_DSA_44`. The primary v1 post-quantum scheme, via
/// the pure-Rust `fips204` crate. Signing is hedged (randomized) per FIPS 204;
/// the empty context string is used until the spec assigns one.
pub struct MlDsa44;

impl MlDsa44 {
    /// Deterministic keygen from a 32-byte seed — recovery parity with
    /// [`crate::Keypair::from_seed`], so shamir shares and guardianship
    /// keep protecting a 32-byte seed regardless of scheme (the D8
    /// decision). Same seed, same keypair, always.
    #[must_use]
    pub fn keygen_from_seed(seed: &[u8; 32]) -> (
        <Self as SigningScheme>::PublicKey,
        <Self as SigningScheme>::SecretKey,
    ) {
        fips204::ml_dsa_44::KG::keygen_from_seed(seed)
    }
}

impl SigningScheme for MlDsa44 {
    const ALGO_ID: MultisigAlgo = MULTISIG_ML_DSA_44;

    type PublicKey = fips204::ml_dsa_44::PublicKey;
    type SecretKey = fips204::ml_dsa_44::PrivateKey;
    type Signature = [u8; fips204::ml_dsa_44::SIG_LEN];

    fn keygen() -> Result<(Self::PublicKey, Self::SecretKey), CryptoError> {
        fips204::ml_dsa_44::try_keygen().map_err(|_| CryptoError::KeygenFailed)
    }

    fn sign(sk: &Self::SecretKey, msg: &[u8]) -> Result<Self::Signature, CryptoError> {
        sk.try_sign(msg, &[]).map_err(|_| CryptoError::SigningFailed)
    }

    fn verify(
        pk: &Self::PublicKey,
        msg: &[u8],
        sig: &Self::Signature,
    ) -> Result<(), CryptoError> {
        if pk.verify(msg, sig, &[]) {
            Ok(())
        } else {
            Err(CryptoError::VerificationFailed)
        }
    }

    fn public_key_to_bytes(pk: &Self::PublicKey) -> Vec<u8> {
        pk.clone().into_bytes().to_vec()
    }

    fn public_key_from_bytes(bytes: &[u8]) -> Result<Self::PublicKey, CryptoError> {
        let arr: [u8; fips204::ml_dsa_44::PK_LEN] =
            bytes.try_into().map_err(|_| CryptoError::MalformedPublicKey)?;
        fips204::ml_dsa_44::PublicKey::try_from_bytes(arr)
            .map_err(|_| CryptoError::MalformedPublicKey)
    }

    fn signature_to_bytes(sig: &Self::Signature) -> Vec<u8> {
        sig.to_vec()
    }

    fn signature_from_bytes(bytes: &[u8]) -> Result<Self::Signature, CryptoError> {
        bytes.try_into().map_err(|_| CryptoError::MalformedSignature)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ed25519_roundtrip_via_trait() {
        let (pk, sk) = Ed25519::keygen().unwrap();
        let sig = Ed25519::sign(&sk, b"claim body").unwrap();
        Ed25519::verify(&pk, b"claim body", &sig).unwrap();
        assert!(Ed25519::verify(&pk, b"tampered", &sig).is_err());
    }

    #[test]
    fn ml_dsa_44_roundtrip_via_trait() {
        let (pk, sk) = MlDsa44::keygen().unwrap();
        let sig = MlDsa44::sign(&sk, b"claim body").unwrap();
        MlDsa44::verify(&pk, b"claim body", &sig).unwrap();
        assert!(MlDsa44::verify(&pk, b"tampered", &sig).is_err());
    }

    #[test]
    fn ml_dsa_44_seeded_keygen_is_deterministic() {
        let seed = [7u8; 32];
        let (pk1, sk1) = MlDsa44::keygen_from_seed(&seed);
        let (pk2, _) = MlDsa44::keygen_from_seed(&seed);
        assert_eq!(
            MlDsa44::public_key_to_bytes(&pk1),
            MlDsa44::public_key_to_bytes(&pk2)
        );
        // A recovered identity signs; the original public key verifies.
        let sig = MlDsa44::sign(&sk1, b"recovered").unwrap();
        MlDsa44::verify(&pk2, b"recovered", &sig).unwrap();
        // A different seed yields a different identity.
        let (pk3, _) = MlDsa44::keygen_from_seed(&[8u8; 32]);
        assert_ne!(
            MlDsa44::public_key_to_bytes(&pk1),
            MlDsa44::public_key_to_bytes(&pk3)
        );
    }

    #[test]
    fn ml_dsa_44_serde_roundtrip() {
        let (pk, sk) = MlDsa44::keygen().unwrap();
        let sig = MlDsa44::sign(&sk, b"m").unwrap();
        let pk2 =
            MlDsa44::public_key_from_bytes(&MlDsa44::public_key_to_bytes(&pk)).unwrap();
        let sig2 =
            MlDsa44::signature_from_bytes(&MlDsa44::signature_to_bytes(&sig)).unwrap();
        MlDsa44::verify(&pk2, b"m", &sig2).unwrap();
    }

    #[test]
    fn blob_dispatch_routes_both_schemes() {
        let (epk, esk) = Ed25519::keygen().unwrap();
        let esig = Ed25519::sign(&esk, b"m").unwrap();
        verify_blob(&Ed25519::public_key_blob(&epk), b"m", &Ed25519::signature_blob(&esig))
            .unwrap();

        let (mpk, msk) = MlDsa44::keygen().unwrap();
        let msig = MlDsa44::sign(&msk, b"m").unwrap();
        verify_blob(&MlDsa44::public_key_blob(&mpk), b"m", &MlDsa44::signature_blob(&msig))
            .unwrap();
    }

    #[test]
    fn blob_dispatch_fails_closed() {
        let (epk, esk) = Ed25519::keygen().unwrap();
        let esig = Ed25519::sign(&esk, b"m").unwrap();
        let pk_blob = Ed25519::public_key_blob(&epk);
        let sig_blob = Ed25519::signature_blob(&esig);

        // Mismatched key/signature algorithms.
        let (mpk, _) = MlDsa44::keygen().unwrap();
        assert!(verify_blob(&MlDsa44::public_key_blob(&mpk), b"m", &sig_blob).is_err());

        // Unknown algorithm ID.
        let mut alien = sig_blob.clone();
        alien[0] = 0x7f;
        let mut alien_pk = pk_blob.clone();
        alien_pk[0] = 0x7f;
        assert!(matches!(
            verify_blob(&alien_pk, b"m", &alien),
            Err(CryptoError::UnknownAlgorithm)
        ));

        // Empty blobs.
        assert!(verify_blob(&[], b"m", &sig_blob).is_err());
        assert!(verify_blob(&pk_blob, b"m", &[]).is_err());
    }
}
