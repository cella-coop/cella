//! Multi-scheme signing identity — the v1 identity type behind every cell.
//!
//! An [`Identity`] owns a signing key of one scheme and speaks the
//! **length-discriminated wire forms** the v1 envelope uses (the PQ
//! cutover's clean cut, D8 2026-08-15):
//!
//! - **public form**: 32 raw bytes = Ed25519 (v0, ids stay stable), any
//!   other length = `MULTISIG_*`-prefixed blob (ML-DSA-44 = 1 + 1312).
//! - **signature form**: 64 raw bytes = Ed25519, else prefixed blob
//!   (ML-DSA-44 = 1 + 2420).
//! - a cell's id is the BLAKE3 of its public form, whichever form that is —
//!   Ed25519 ids equal the v0 fingerprint, PQ ids get domain separation
//!   from the prefix byte.
//!
//! [`Identity::generate`] defaults to **ML-DSA-44** per D8; Ed25519 remains
//! constructible for legacy cells. Every identity derives from a 32-byte
//! seed, so shamir shares and guardianship protect the same thing
//! regardless of scheme.

use zeroize::Zeroizing;

use crate::signing_scheme::{verify_blob, MlDsa44, SigningScheme};
use crate::{hash, CryptoError, Hash, Keypair, MULTISIG_ML_DSA_44};

/// The signature schemes an [`Identity`] can hold.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SigScheme {
    /// v0 scheme, carried forward for existing cells.
    Ed25519,
    /// v1 default (D8).
    MlDsa44,
}

impl SigScheme {
    /// Stable name, used by the keystore's scheme marker.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ed25519 => "ed25519",
            Self::MlDsa44 => "ml-dsa-44",
        }
    }

    /// The scheme a public wire form belongs to: 32 raw bytes is bare
    /// Ed25519, a `MULTISIG_ML_DSA_44`-prefixed blob of the right length is
    /// ML-DSA-44, anything else is unrecognized (fail closed).
    #[must_use]
    pub fn of_public_form(public_form: &[u8]) -> Option<Self> {
        match (public_form.len(), public_form.first()) {
            (32, _) => Some(Self::Ed25519),
            (1313, Some(&MULTISIG_ML_DSA_44)) => Some(Self::MlDsa44),
            _ => None,
        }
    }
}

impl std::str::FromStr for SigScheme {
    type Err = CryptoError;

    /// Parse a keystore scheme marker.
    fn from_str(s: &str) -> Result<Self, CryptoError> {
        match s.trim() {
            "ed25519" => Ok(Self::Ed25519),
            "ml-dsa-44" => Ok(Self::MlDsa44),
            _ => Err(CryptoError::UnknownAlgorithm),
        }
    }
}

/// A cell's signing identity — one scheme, seed-derived, wire-form aware.
pub enum Identity {
    /// v0 Ed25519 identity wrapping the concrete [`Keypair`].
    Ed25519(Keypair),
    /// v1 ML-DSA-44 identity. The seed re-derives the keypair
    /// deterministically; the expanded keys are kept (boxed — they are
    /// kilobytes) for signing.
    MlDsa44 {
        /// The 32-byte identity seed (what recovery protects).
        seed: Zeroizing<[u8; 32]>,
        /// Expanded verifying key.
        pk: Box<fips204::ml_dsa_44::PublicKey>,
        /// Expanded signing key.
        sk: Box<fips204::ml_dsa_44::PrivateKey>,
    },
}

impl std::fmt::Debug for Identity {
    /// Redacted — scheme and id only, never key material.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Identity")
            .field("scheme", &self.scheme().as_str())
            .field("id", &self.id())
            .finish_non_exhaustive()
    }
}

impl Identity {
    /// Generate a fresh identity in the current default scheme (ML-DSA-44).
    #[must_use]
    pub fn generate() -> Self {
        let mut seed = [0u8; 32];
        getrandom_fill(&mut seed);
        Self::from_seed(SigScheme::MlDsa44, seed)
    }

    /// Generate a fresh Ed25519 identity (legacy interop).
    #[must_use]
    pub fn generate_ed25519() -> Self {
        Self::Ed25519(Keypair::generate())
    }

    /// Rebuild an identity from its scheme and 32-byte seed. Deterministic.
    #[must_use]
    pub fn from_seed(scheme: SigScheme, seed: [u8; 32]) -> Self {
        match scheme {
            SigScheme::Ed25519 => Self::Ed25519(Keypair::from_seed(seed)),
            SigScheme::MlDsa44 => {
                let (pk, sk) = MlDsa44::keygen_from_seed(&seed);
                Self::MlDsa44 {
                    seed: Zeroizing::new(seed),
                    pk: Box::new(pk),
                    sk: Box::new(sk),
                }
            }
        }
    }

    /// This identity's scheme.
    #[must_use]
    pub fn scheme(&self) -> SigScheme {
        match self {
            Self::Ed25519(_) => SigScheme::Ed25519,
            Self::MlDsa44 { .. } => SigScheme::MlDsa44,
        }
    }

    /// The 32-byte seed, zeroized on drop. With [`Self::scheme`], enough to
    /// rebuild the identity — this is what the keystore persists and what
    /// recovery (shamir/guardians) protects.
    #[must_use]
    pub fn seed_bytes(&self) -> Zeroizing<[u8; 32]> {
        match self {
            Self::Ed25519(kp) => kp.seed_bytes(),
            Self::MlDsa44 { seed, .. } => seed.clone(),
        }
    }

    /// The public wire form: 32 raw bytes (Ed25519) or a prefixed blob.
    #[must_use]
    pub fn public_form(&self) -> Vec<u8> {
        match self {
            Self::Ed25519(kp) => kp.public_key().as_bytes().to_vec(),
            Self::MlDsa44 { pk, .. } => {
                let mut blob = vec![MULTISIG_ML_DSA_44];
                blob.extend_from_slice(&MlDsa44::public_key_to_bytes(pk));
                blob
            }
        }
    }

    /// This identity's id — BLAKE3 of the public form.
    #[must_use]
    pub fn id(&self) -> Hash {
        public_id(&self.public_form())
    }

    /// Sign `msg`, producing the signature wire form for this scheme.
    #[must_use = "the signature must be carried on the claim"]
    pub fn sign(&self, msg: &[u8]) -> Result<Vec<u8>, CryptoError> {
        match self {
            Self::Ed25519(kp) => Ok(kp.sign(msg).to_bytes().to_vec()),
            Self::MlDsa44 { sk, .. } => {
                let sig = MlDsa44::sign(sk, msg)?;
                let mut blob = vec![MULTISIG_ML_DSA_44];
                blob.extend_from_slice(&sig);
                Ok(blob)
            }
        }
    }
}

/// A public form's identity hash — BLAKE3 over the bytes as given. For the
/// 32-byte Ed25519 raw form this equals the v0 fingerprint, so existing
/// cell ids are unchanged; prefixed blobs get domain separation from the
/// algorithm byte.
#[must_use]
pub fn public_id(public_form: &[u8]) -> Hash {
    hash(public_form)
}

/// Verify a wire-form signature against a wire-form public key.
///
/// Dispatch is by length: 32-byte public + 64-byte signature is bare
/// Ed25519; anything else must be a matched pair of algorithm-prefixed
/// blobs (routed through [`verify_blob`], which fails closed on unknown or
/// mismatched algorithms). Mixed forms are an error, never a fall-through.
pub fn verify_detached(
    public_form: &[u8],
    msg: &[u8],
    sig: &[u8],
) -> Result<(), CryptoError> {
    match (public_form.len(), sig.len()) {
        (32, 64) => {
            let pk_arr: &[u8; 32] =
                public_form.try_into().map_err(|_| CryptoError::MalformedPublicKey)?;
            let pk = crate::PublicKey::from_bytes(pk_arr)?;
            let sig_arr: &[u8; 64] =
                sig.try_into().map_err(|_| CryptoError::MalformedSignature)?;
            let sig = crate::Signature::from_bytes(sig_arr)?;
            pk.verify(msg, &sig)
        }
        (32, _) | (_, 64) => Err(CryptoError::UnknownAlgorithm),
        _ => verify_blob(public_form, msg, sig),
    }
}

fn getrandom_fill(buf: &mut [u8; 32]) {
    use rand_core::RngCore as _;
    rand_core::OsRng.fill_bytes(buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_identity_is_pq_and_seed_deterministic() {
        let id = Identity::generate();
        assert_eq!(id.scheme(), SigScheme::MlDsa44);
        let rebuilt = Identity::from_seed(id.scheme(), *id.seed_bytes());
        assert_eq!(id.public_form(), rebuilt.public_form());
        assert_eq!(id.id(), rebuilt.id());
    }

    #[test]
    fn both_schemes_sign_and_verify_by_wire_form() {
        for identity in [Identity::generate(), Identity::generate_ed25519()] {
            let public = identity.public_form();
            let sig = identity.sign(b"claim body").unwrap();
            verify_detached(&public, b"claim body", &sig).unwrap();
            assert!(verify_detached(&public, b"tampered", &sig).is_err());
        }
    }

    #[test]
    fn ed25519_form_ids_match_v0_fingerprints() {
        let id = Identity::generate_ed25519();
        let Identity::Ed25519(kp) = &id else { unreachable!() };
        assert_eq!(id.id(), kp.public_key().fingerprint());
    }

    #[test]
    fn mixed_wire_forms_fail_closed() {
        let pq = Identity::generate();
        let ed = Identity::generate_ed25519();
        let pq_sig = pq.sign(b"m").unwrap();
        let ed_sig = ed.sign(b"m").unwrap();
        // Ed25519 key with PQ blob signature, and vice versa.
        assert!(verify_detached(&ed.public_form(), b"m", &pq_sig).is_err());
        assert!(verify_detached(&pq.public_form(), b"m", &ed_sig).is_err());
        // Cross-identity same-scheme also fails (plain wrong key).
        let pq2 = Identity::generate();
        assert!(verify_detached(&pq2.public_form(), b"m", &pq_sig).is_err());
    }
}
