//! Age encryption/decryption helpers for the sharded-secret model.
//!
//! This module wraps the `age` crate's X25519 path with a small, honest
//! surface: generate a recipient identity, encrypt a payload to one or more
//! recipients, and decrypt with an identity. Multi-recipient encryption is
//! the K = 1 guardian path from `app::secret` — "any one of N holders can
//! recover" is exactly age's native multi-recipient mode, with no
//! secret-sharing layer.
//!
//! The split between this lib and `app::secret`: this lib owns the raw age
//! mechanics over X25519 keys; resolving cell-graph names or SSH pubkeys to
//! recipient strings is an app concern. Recipients and identities round-trip
//! through their canonical `age1…` / `AGE-SECRET-KEY-1…` string forms so the
//! app can persist and resolve them however it likes.

use std::str::FromStr;

use ::age::secrecy::ExposeSecret;
use ::age::x25519;
use zeroize::Zeroizing;

use crate::CryptoError;

/// An age recipient — the public half used to encrypt a payload.
///
/// Wraps an X25519 recipient (`age1…`). Parse one from its string form with
/// [`Recipient::from_str`] or derive it from an [`AgeIdentity`].
#[derive(Clone, Debug)]
pub struct Recipient(x25519::Recipient);

impl Recipient {
    /// The canonical `age1…` string form of this recipient.
    #[must_use]
    pub fn to_age_string(&self) -> String {
        self.0.to_string()
    }
}

impl FromStr for Recipient {
    type Err = CryptoError;

    /// Parse an `age1…` recipient string.
    ///
    /// # Errors
    /// Returns [`CryptoError::MalformedRecipient`] if the string is not a
    /// valid age X25519 recipient.
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        x25519::Recipient::from_str(s)
            .map(Self)
            .map_err(|_| CryptoError::MalformedRecipient)
    }
}

/// An age identity — the secret half used to decrypt a payload.
///
/// Wraps an X25519 identity (`AGE-SECRET-KEY-1…`). This is age's own keypair
/// format, distinct from the signing [`crate::Identity`] and its seed: the
/// sharded model uses age identities for *encryption* of payloads and
/// shares, and signing identities for *signing* and as the recovered root
/// secret. Its name keeps it apart from that type, so a caller can name both.
#[derive(Clone)]
pub struct AgeIdentity(x25519::Identity);

impl AgeIdentity {
    /// Generate a fresh age identity from the OS entropy source.
    #[must_use]
    pub fn generate() -> Self {
        Self(x25519::Identity::generate())
    }

    /// The public recipient derived from this identity.
    #[must_use]
    pub fn to_public(&self) -> Recipient {
        Recipient(self.0.to_public())
    }

    /// The canonical `AGE-SECRET-KEY-1…` string form of this identity.
    ///
    /// The returned string is secret key material, so it is wrapped in
    /// [`Zeroizing`] and scrubbed on drop. Derefs to `str`/`String`, so a
    /// caller persisting it (route through `age`/storage) is unchanged beyond
    /// the borrow. Do not log it. (The *public* half — [`Recipient`] — is not
    /// secret and stays a plain `String`.)
    #[must_use]
    pub fn to_age_string(&self) -> Zeroizing<String> {
        Zeroizing::new(self.0.to_string().expose_secret().to_owned())
    }
}

impl FromStr for AgeIdentity {
    type Err = CryptoError;

    /// Parse an `AGE-SECRET-KEY-1…` identity string.
    ///
    /// # Errors
    /// Returns [`CryptoError::MalformedIdentity`] if the string is not a
    /// valid age X25519 identity.
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        x25519::Identity::from_str(s)
            .map(Self)
            .map_err(|_| CryptoError::MalformedIdentity)
    }
}

/// Encrypt `plaintext` to one or more recipients.
///
/// Any single recipient's matching [`AgeIdentity`] can later [`decrypt`] the
/// output. This is the K = 1 guardian path: pass all N guardian recipients
/// and the seed (or any payload) is recoverable by any one of them.
///
/// Returns binary age ciphertext.
///
/// # Errors
/// Returns [`CryptoError::EncryptionFailed`] if `recipients` is empty or the
/// age encryptor fails.
pub fn encrypt(recipients: &[Recipient], plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    use std::io::Write;

    if recipients.is_empty() {
        return Err(CryptoError::EncryptionFailed);
    }

    let recipients_dyn = recipients
        .iter()
        .map(|r| &r.0 as &dyn ::age::Recipient);
    let encryptor =
        ::age::Encryptor::with_recipients(recipients_dyn).map_err(|_| CryptoError::EncryptionFailed)?;

    let mut ciphertext = Vec::with_capacity(plaintext.len());
    let mut writer = encryptor
        .wrap_output(&mut ciphertext)
        .map_err(|_| CryptoError::EncryptionFailed)?;
    writer
        .write_all(plaintext)
        .map_err(|_| CryptoError::EncryptionFailed)?;
    writer.finish().map_err(|_| CryptoError::EncryptionFailed)?;

    Ok(ciphertext)
}

/// Decrypt age `ciphertext` with `identity`.
///
/// The identity must correspond to one of the recipients the ciphertext was
/// encrypted to.
///
/// The recovered plaintext is the secret payload (a data secret, a root seed,
/// or a Shamir share), so it is returned in [`Zeroizing`] and scrubbed on drop.
/// Derefs to `Vec<u8>`/`[u8]`.
///
/// # Errors
/// Returns [`CryptoError::DecryptionFailed`] if the identity does not match
/// any recipient or the ciphertext is malformed.
pub fn decrypt(
    identity: &AgeIdentity,
    ciphertext: &[u8],
) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
    use std::io::Read;

    let decryptor =
        ::age::Decryptor::new_buffered(ciphertext).map_err(|_| CryptoError::DecryptionFailed)?;
    let mut reader = decryptor
        .decrypt(std::iter::once(&identity.0 as &dyn ::age::Identity))
        .map_err(|_| CryptoError::DecryptionFailed)?;

    let mut plaintext = Zeroizing::new(Vec::new());
    reader
        .read_to_end(&mut plaintext)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_recipient_roundtrip() {
        let id = AgeIdentity::generate();
        let msg = b"a data secret addressed to one cell";

        let ct = encrypt(&[id.to_public()], msg).expect("encrypt");
        assert_ne!(ct.as_slice(), msg, "ciphertext must differ from plaintext");

        let pt = decrypt(&id, &ct).expect("decrypt with matching identity");
        assert_eq!(pt.as_slice(), msg);
    }

    #[test]
    fn multi_recipient_any_one_decrypts() {
        // K = 1 guardian path: three guardians, any one can recover.
        let g1 = AgeIdentity::generate();
        let g2 = AgeIdentity::generate();
        let g3 = AgeIdentity::generate();
        let seed = [0x42u8; 32];

        let ct = encrypt(
            &[g1.to_public(), g2.to_public(), g3.to_public()],
            &seed,
        )
        .expect("encrypt to three guardians");

        for g in [&g1, &g2, &g3] {
            let pt = decrypt(g, &ct).expect("each guardian decrypts");
            assert_eq!(pt.as_slice(), &seed);
        }
    }

    #[test]
    fn wrong_identity_fails() {
        let id = AgeIdentity::generate();
        let stranger = AgeIdentity::generate();
        let ct = encrypt(&[id.to_public()], b"secret").expect("encrypt");

        assert!(matches!(
            decrypt(&stranger, &ct),
            Err(CryptoError::DecryptionFailed),
        ));
    }

    #[test]
    fn empty_recipients_rejected() {
        assert!(matches!(
            encrypt(&[], b"secret"),
            Err(CryptoError::EncryptionFailed),
        ));
    }

    #[test]
    fn recipient_string_roundtrip() {
        let id = AgeIdentity::generate();
        let r = id.to_public();
        let s = r.to_age_string();
        let parsed = Recipient::from_str(&s).expect("parse age recipient");
        assert_eq!(parsed.to_age_string(), s);
    }

    #[test]
    fn identity_string_roundtrip() {
        let id = AgeIdentity::generate();
        let s = id.to_age_string();
        let parsed = AgeIdentity::from_str(&s).expect("parse age identity");
        assert_eq!(
            parsed.to_public().to_age_string(),
            id.to_public().to_age_string(),
        );

        // The reconstructed identity decrypts payloads addressed to the original.
        let ct = encrypt(&[id.to_public()], b"roundtrip").expect("encrypt");
        let pt = decrypt(&parsed, &ct).expect("decrypt with reparsed identity");
        assert_eq!(pt.as_slice(), b"roundtrip");
    }

    #[test]
    fn malformed_strings_rejected() {
        assert!(matches!(
            Recipient::from_str("not-an-age-recipient"),
            Err(CryptoError::MalformedRecipient),
        ));
        assert!(matches!(
            AgeIdentity::from_str("not-an-age-identity"),
            Err(CryptoError::MalformedIdentity),
        ));
    }
}
