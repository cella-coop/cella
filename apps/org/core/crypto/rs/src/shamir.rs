//! Shamir's Secret Sharing over the 32-byte Ed25519 seed.
//!
//! This is the K >= 2 guardian path from `app::secret`: the root-identity
//! seed ([`crate::Keypair::seed_bytes`]) is split into N shares with
//! threshold K, such that any K shares reconstruct the seed and any K-1
//! reveal nothing. Each share is then (by the app, not here) age-encrypted
//! to its guardian, so a share at rest is useless without that guardian's
//! key.
//!
//! Backed by `sharks`, a vetted GF(2^8) Shamir implementation that splits
//! per-byte. The split target is specifically the seed bytes — the recovered
//! artefact is byte-identical to a freshly-seeded keypair via
//! [`crate::Keypair::from_seed`], with no coupling to age's identity format.
//!
//! # The K = 1 degenerate case
//!
//! `app::secret` routes K = 1 through age multi-recipient encryption and does
//! NOT invoke this module — that is the zero-new-crypto guarantee. This
//! module still handles K = 1 correctly for completeness: a threshold-1 share
//! carries the secret bytes verbatim (degree-0 polynomial), so any single
//! share reconstructs the seed. Callers MUST treat a K = 1 share as secret
//! material equivalent to the seed itself.

use sharks::{Share, Sharks};
use zeroize::Zeroizing;

use crate::CryptoError;

/// Length of the Ed25519 seed that gets split, in bytes.
pub const SEED_LEN: usize = 32;

/// One Shamir share of a split seed.
///
/// Opaque; serialize to bytes with [`Share32::to_bytes`] for storage (each
/// share is then age-encrypted to a guardian by `app::secret`) and parse back
/// with [`Share32::from_bytes`].
#[derive(Clone)]
pub struct Share32(Share);

impl Share32 {
    /// Serialize this share to bytes for storage.
    ///
    /// The encoding is `sharks`' own: a 1-byte x-coordinate followed by the
    /// per-byte y-values (33 bytes for a 32-byte seed). A K = 1 share carries
    /// the seed verbatim; even K >= 2 shares are sensitive, so the buffer is
    /// returned in [`Zeroizing`] and scrubbed on drop. Derefs to `Vec<u8>`.
    #[must_use]
    pub fn to_bytes(&self) -> Zeroizing<Vec<u8>> {
        Zeroizing::new(Vec::from(&self.0))
    }

    /// Parse a share from its [`Share32::to_bytes`] encoding.
    ///
    /// # Errors
    /// Returns [`CryptoError::MalformedShare`] if the bytes do not decode as
    /// a valid share.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        Share::try_from(bytes)
            .map(Self)
            .map_err(|_| CryptoError::MalformedShare)
    }
}

/// Split a 32-byte seed into `count` shares with reconstruction threshold
/// `threshold`.
///
/// Any `threshold` of the returned shares reconstruct the seed via
/// [`reconstruct`]; any fewer reveal nothing. `threshold` is the K and
/// `count` is the N of the (K, N) placement.
///
/// # Errors
/// Returns [`CryptoError::InvalidThreshold`] if `threshold` is 0 or greater
/// than `count`, or if `count` is 0.
///
/// # Note on K = 1
/// `threshold == 1` produces shares each carrying the seed verbatim; the
/// sharded model uses age multi-recipient encryption for that case instead
/// (see module docs).
pub fn split(seed: &[u8; SEED_LEN], threshold: u8, count: u8) -> Result<Vec<Share32>, CryptoError> {
    if threshold == 0 || count == 0 || threshold > count {
        return Err(CryptoError::InvalidThreshold);
    }

    let scheme = Sharks(threshold);
    let shares: Vec<Share32> = scheme
        .dealer(seed)
        .take(count as usize)
        .map(Share32)
        .collect();

    Ok(shares)
}

/// Reconstruct a 32-byte seed from a collection of shares.
///
/// At least `threshold` distinct shares (the K from [`split`]) must be
/// supplied; the same `threshold` value used to split MUST be passed here.
///
/// # Errors
/// Returns [`CryptoError::InsufficientShares`] if fewer than `threshold`
/// distinct shares are supplied, or [`CryptoError::ReconstructionFailed`] if
/// the recovered bytes are not exactly [`SEED_LEN`] (e.g. mismatched or
/// corrupt shares).
pub fn reconstruct(
    shares: &[Share32],
    threshold: u8,
) -> Result<Zeroizing<[u8; SEED_LEN]>, CryptoError> {
    let scheme = Sharks(threshold);
    let inner: Vec<&Share> = shares.iter().map(|s| &s.0).collect();

    // The recovered seed is the root secret — hold it in `Zeroizing` from the
    // first heap buffer `sharks` hands back through the final fixed array, so
    // no plaintext copy outlives the call uncleared.
    let secret = Zeroizing::new(
        scheme
            .recover(inner)
            .map_err(|_| CryptoError::InsufficientShares)?,
    );

    let arr: [u8; SEED_LEN] = secret
        .as_slice()
        .try_into()
        .map_err(|_| CryptoError::ReconstructionFailed)?;
    Ok(Zeroizing::new(arr))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Keypair;

    fn sample_seed() -> [u8; SEED_LEN] {
        *Keypair::generate().seed_bytes()
    }

    #[test]
    fn split_then_reconstruct_with_exactly_k() {
        let seed = sample_seed();
        let shares = split(&seed, 3, 5).expect("split 3-of-5");
        assert_eq!(shares.len(), 5);

        let recovered = reconstruct(&shares[..3], 3).expect("any 3 reconstruct");
        assert_eq!(*recovered, seed);
    }

    #[test]
    fn reconstruct_from_any_k_subset() {
        let seed = sample_seed();
        let shares = split(&seed, 2, 4).expect("split 2-of-4");

        // Every distinct pair must reconstruct the same seed.
        for i in 0..shares.len() {
            for j in (i + 1)..shares.len() {
                let subset = [shares[i].clone(), shares[j].clone()];
                let recovered = reconstruct(&subset, 2).expect("any 2 reconstruct");
                assert_eq!(*recovered, seed, "pair ({i},{j}) must recover the seed");
            }
        }
    }

    #[test]
    fn more_than_k_shares_also_reconstruct() {
        let seed = sample_seed();
        let shares = split(&seed, 3, 5).expect("split 3-of-5");
        let recovered = reconstruct(&shares, 3).expect("all 5 reconstruct");
        assert_eq!(*recovered, seed);
    }

    #[test]
    fn fewer_than_k_fails() {
        let seed = sample_seed();
        let shares = split(&seed, 3, 5).expect("split 3-of-5");
        assert!(matches!(
            reconstruct(&shares[..2], 3),
            Err(CryptoError::InsufficientShares),
        ));
    }

    #[test]
    fn k_equals_1_degenerates_to_secret() {
        // Threshold 1: each share carries the seed verbatim and any single
        // share reconstructs it. Round-trip must hold.
        let seed = sample_seed();
        let shares = split(&seed, 1, 3).expect("split 1-of-3");
        assert_eq!(shares.len(), 3);

        for share in &shares {
            let recovered =
                reconstruct(std::slice::from_ref(share), 1).expect("single share reconstructs");
            assert_eq!(*recovered, seed);

            // The share's y-bytes equal the secret (degree-0 polynomial):
            // a 1-byte x prefix followed by the 32 seed bytes verbatim.
            let bytes = share.to_bytes();
            assert_eq!(bytes.len(), SEED_LEN + 1);
            assert_eq!(&bytes[1..], &seed[..], "K=1 share body == secret");
        }
    }

    #[test]
    fn share_bytes_roundtrip() {
        let seed = sample_seed();
        let shares = split(&seed, 2, 3).expect("split 2-of-3");

        let reparsed: Vec<Share32> = shares
            .iter()
            .map(|s| Share32::from_bytes(&s.to_bytes()).expect("parse share"))
            .collect();

        let recovered = reconstruct(&reparsed[..2], 2).expect("reparsed shares reconstruct");
        assert_eq!(*recovered, seed);
    }

    #[test]
    fn invalid_thresholds_rejected() {
        let seed = sample_seed();
        assert!(matches!(
            split(&seed, 0, 3),
            Err(CryptoError::InvalidThreshold)
        ));
        assert!(matches!(
            split(&seed, 4, 3),
            Err(CryptoError::InvalidThreshold)
        ));
        assert!(matches!(
            split(&seed, 1, 0),
            Err(CryptoError::InvalidThreshold)
        ));
    }

    #[test]
    fn recovered_seed_rebuilds_same_keypair() {
        // The whole point: a reconstructed seed yields the original identity.
        let kp = Keypair::generate();
        let seed = *kp.seed_bytes();

        let shares = split(&seed, 2, 3).expect("split 2-of-3");
        let recovered = reconstruct(&shares[..2], 2).expect("reconstruct");
        let rebuilt = Keypair::from_seed(*recovered);

        assert_eq!(kp.public_key(), rebuilt.public_key());

        let msg = b"signed by the recovered identity";
        let sig = rebuilt.sign(msg);
        kp.public_key()
            .verify(msg, &sig)
            .expect("recovered identity signs validly");
    }
}
