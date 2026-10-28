//! Signing, verification, and hashing for Cella cells.
//!
//! Every cell has a keypair — that keypair is the cell's signing identity.
//! Every message in a cell's log carries the signature of the cell that
//! authored it. The hash chain across a cell's log gives tamper-evidence.
//!
//! The signing surface is [`Identity`] — Ed25519 or ML-DSA-44 (FIPS 204,
//! the default for new identities), dispatched through [`SigningScheme`].
//! Wire forms are length-discriminated: a 64-byte signature / 32-byte
//! public key is bare v0 Ed25519, anything longer is a `MULTISIG_*`-prefixed
//! blob, and [`verify_detached`] routes on that (failing closed on unknown
//! forms). BLAKE3 hashes throughout. The concrete v0 [`Keypair`] types
//! remain for legacy Ed25519 material.
//!
//! corpus:article/architecture
//! Rests on cella-old:change/26-08-15-post-quantum-by-default.

#![warn(missing_docs)]

pub mod age;
pub mod identity;
pub mod kem_hybrid;
pub mod shamir;
pub mod signing_scheme;

pub use identity::{public_id, verify_detached, Identity, SigScheme};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use zeroize::Zeroizing;

/// Length of a raw public key in bytes.
pub const PUBLIC_KEY_LEN: usize = 32;

/// Length of a raw signature in bytes.
pub const SIGNATURE_LEN: usize = 64;

/// Length of a hash digest in bytes (BLAKE3, truncated/native 32 bytes).
pub const HASH_LEN: usize = 32;

// ─── Multihash / multisig algorithm registry ────────────────────────────────
//
// Additive scaffolding for algorithm agility. The v0 wire format does not yet
// prefix hashes or signatures with algorithm bytes; these constants reserve
// the IDs so the prefix can slot in additively when v1 lands.

/// Algorithm-ID byte type for hash multihash prefixes.
///
/// IDs follow the multihash standard where practical.
pub type MultihashAlgo = u8;

/// BLAKE3-256 multihash algorithm ID. Current default.
pub const MULTIHASH_BLAKE3_256: MultihashAlgo = 0x1e;

/// SHA2-256 multihash algorithm ID. Reserved for future agility.
pub const MULTIHASH_SHA2_256: MultihashAlgo = 0x12;

/// Algorithm-ID byte type for signature multisig prefixes.
pub type MultisigAlgo = u8;

/// Ed25519 multisig algorithm ID. Current default (v0.1).
pub const MULTISIG_ED25519: MultisigAlgo = 0x00;

/// ML-DSA-44 multisig algorithm ID. Reserved for the v1 post-quantum target.
pub const MULTISIG_ML_DSA_44: MultisigAlgo = 0x01;

/// Errors produced by this crate.
#[derive(Debug, Error)]
pub enum CryptoError {
    /// Bytes did not decode as a valid public key.
    #[error("malformed public key")]
    MalformedPublicKey,

    /// Bytes did not decode as a valid signature.
    #[error("malformed signature")]
    MalformedSignature,

    /// A signature did not verify against the message and public key.
    #[error("signature verification failed")]
    VerificationFailed,

    /// Bytes did not decode as a valid age recipient.
    #[error("malformed age recipient")]
    MalformedRecipient,

    /// Bytes did not decode as a valid age identity.
    #[error("malformed age identity")]
    MalformedIdentity,

    /// Bytes did not decode as a valid Shamir share.
    #[error("malformed shamir share")]
    MalformedShare,

    /// age encryption failed (no recipients, or encryptor error).
    #[error("age encryption failed")]
    EncryptionFailed,

    /// age decryption failed (no matching identity, or malformed ciphertext).
    #[error("age decryption failed")]
    DecryptionFailed,

    /// A Shamir threshold was invalid (zero, or greater than the share count).
    #[error("invalid shamir threshold")]
    InvalidThreshold,

    /// Fewer than `threshold` distinct shares were supplied for reconstruction.
    #[error("not enough shares to reconstruct the secret")]
    InsufficientShares,

    /// Shamir reconstruction produced bytes that were not a valid seed length.
    #[error("shamir reconstruction failed")]
    ReconstructionFailed,

    /// An algorithm-ID prefix named a scheme this build does not know, or the
    /// key and signature prefixes disagreed.
    #[error("unknown or mismatched signature algorithm")]
    UnknownAlgorithm,

    /// Key generation failed (scheme-internal RNG or parameter error).
    #[error("key generation failed")]
    KeygenFailed,

    /// Signing failed (scheme-internal error; hedged schemes can fail on RNG).
    #[error("signing failed")]
    SigningFailed,
}

/// A cell's keypair. Holds the private signing key; the public half can
/// be derived via [`Keypair::public_key`].
#[derive(Debug)]
pub struct Keypair {
    signing: ed25519_dalek::SigningKey,
}

impl Keypair {
    /// Generate a new random keypair using the OS entropy source.
    #[must_use]
    pub fn generate() -> Self {
        let mut rng = rand_core::OsRng;
        Self {
            signing: ed25519_dalek::SigningKey::generate(&mut rng),
        }
    }

    /// Produce a detached signature over `message`.
    #[must_use]
    pub fn sign(&self, message: &[u8]) -> Signature {
        use ed25519_dalek::Signer;
        Signature(self.signing.sign(message))
    }

    /// The public key derived from this keypair.
    #[must_use]
    pub fn public_key(&self) -> PublicKey {
        PublicKey(self.signing.verifying_key())
    }

    /// Expose the raw 32-byte seed for this keypair, wrapped in [`Zeroizing`]
    /// so the extracted copy is scrubbed on drop. The seed *is* the secret
    /// identity — handle it as such (route through `age`/storage; do not log).
    /// `Zeroizing<[u8; 32]>` derefs to `[u8; 32]`, so callers that only read
    /// the bytes (compare, hash, write) need no change beyond a `*`/`&` where
    /// a bare array is required.
    #[must_use]
    pub fn seed_bytes(&self) -> Zeroizing<[u8; 32]> {
        Zeroizing::new(self.signing.to_bytes())
    }

    /// Reconstruct a keypair from a 32-byte seed. The seed must be a
    /// cryptographically-random secret — do not construct one yourself.
    #[must_use]
    pub fn from_seed(seed: [u8; 32]) -> Self {
        Self {
            signing: ed25519_dalek::SigningKey::from_bytes(&seed),
        }
    }
}

/// A cell's public key — the verifying half of a [`Keypair`].
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicKey(ed25519_dalek::VerifyingKey);

impl PublicKey {
    /// Verify a detached signature over `message`.
    ///
    /// # Errors
    /// Returns [`CryptoError::VerificationFailed`] if the signature does
    /// not correspond to this public key and the given message.
    pub fn verify(&self, message: &[u8], signature: &Signature) -> Result<(), CryptoError> {
        use ed25519_dalek::Verifier;
        self.0
            .verify(message, &signature.0)
            .map_err(|_| CryptoError::VerificationFailed)
    }

    /// The raw 32-byte public key.
    #[must_use]
    pub fn as_bytes(&self) -> &[u8; PUBLIC_KEY_LEN] {
        self.0.as_bytes()
    }

    /// Construct from raw bytes.
    ///
    /// # Errors
    /// Returns [`CryptoError::MalformedPublicKey`] if the bytes do not
    /// decode as a valid Ed25519 verifying key.
    pub fn from_bytes(bytes: &[u8; PUBLIC_KEY_LEN]) -> Result<Self, CryptoError> {
        ed25519_dalek::VerifyingKey::from_bytes(bytes)
            .map(Self)
            .map_err(|_| CryptoError::MalformedPublicKey)
    }

    /// The fingerprint of this key — a BLAKE3 hash of its raw bytes.
    /// Used as the `CellId` across the rest of the framework.
    #[must_use]
    pub fn fingerprint(&self) -> Hash {
        hash(self.as_bytes())
    }
}

/// A detached signature over a message.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Signature(ed25519_dalek::Signature);

impl Signature {
    /// The raw 64-byte signature.
    #[must_use]
    pub fn to_bytes(&self) -> [u8; SIGNATURE_LEN] {
        self.0.to_bytes()
    }

    /// Construct from raw bytes.
    ///
    /// # Errors
    /// Returns [`CryptoError::MalformedSignature`] if the bytes do not
    /// decode as a valid Ed25519 signature.
    pub fn from_bytes(bytes: &[u8; SIGNATURE_LEN]) -> Result<Self, CryptoError> {
        Ok(Self(ed25519_dalek::Signature::from_bytes(bytes)))
    }
}

/// A 32-byte BLAKE3 hash digest — used for message-chain tamper evidence
/// and as the underlying form for a cell's fingerprint.
pub type Hash = [u8; HASH_LEN];

/// Hash arbitrary bytes with BLAKE3.
#[must_use]
pub fn hash(bytes: &[u8]) -> Hash {
    blake3::hash(bytes).into()
}

/// Domain-separated key derivation (BLAKE3 `derive_key`). Use this whenever
/// a subsystem needs its own key from a cell's seed — handing the raw seed
/// to two different cryptographic roles (e.g. claim signing and transport
/// TLS) creates cross-protocol signature oracles on one key.
#[must_use]
pub fn derive_key(context: &str, ikm: &[u8]) -> [u8; 32] {
    blake3::derive_key(context, ikm)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_and_verify_roundtrip() {
        let kp = Keypair::generate();
        let msg = b"hello cella";
        let sig = kp.sign(msg);
        kp.public_key().verify(msg, &sig).expect("fresh sig must verify");
    }

    #[test]
    fn verify_fails_on_tampered_message() {
        let kp = Keypair::generate();
        let sig = kp.sign(b"original");
        assert!(matches!(
            kp.public_key().verify(b"tampered", &sig),
            Err(CryptoError::VerificationFailed),
        ));
    }

    #[test]
    fn verify_fails_under_wrong_key() {
        let a = Keypair::generate();
        let b = Keypair::generate();
        let msg = b"cross-identity";
        let sig = a.sign(msg);
        assert!(b.public_key().verify(msg, &sig).is_err());
    }

    #[test]
    fn seed_roundtrip_preserves_keypair() {
        let kp = Keypair::generate();
        let reconstructed = Keypair::from_seed(*kp.seed_bytes());
        assert_eq!(kp.public_key(), reconstructed.public_key());

        let msg = b"same identity after roundtrip";
        let sig = reconstructed.sign(msg);
        kp.public_key().verify(msg, &sig).expect("same-identity sig verifies");
    }

    #[test]
    fn public_key_bytes_roundtrip() {
        let kp = Keypair::generate();
        let pk = kp.public_key();
        let bytes = *pk.as_bytes();
        let restored = PublicKey::from_bytes(&bytes).expect("valid bytes decode");
        assert_eq!(pk, restored);
    }

    #[test]
    fn signature_bytes_roundtrip() {
        let kp = Keypair::generate();
        let sig = kp.sign(b"message");
        let bytes = sig.to_bytes();
        let restored = Signature::from_bytes(&bytes).expect("valid bytes decode");
        assert_eq!(sig, restored);
    }

    #[test]
    fn fingerprint_is_stable() {
        let kp = Keypair::generate();
        let pk = kp.public_key();
        assert_eq!(pk.fingerprint(), pk.fingerprint());
    }

    #[test]
    fn different_keys_have_different_fingerprints() {
        let a = Keypair::generate();
        let b = Keypair::generate();
        assert_ne!(a.public_key().fingerprint(), b.public_key().fingerprint());
    }

    #[test]
    fn hash_is_deterministic() {
        assert_eq!(hash(b"hello"), hash(b"hello"));
        assert_ne!(hash(b"hello"), hash(b"world"));
    }
}
