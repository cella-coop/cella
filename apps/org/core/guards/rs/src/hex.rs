//! Lowercase hex, as signed messages and the log's JSON carry bytes.

use std::fmt::Write;

#[must_use]
pub fn hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
            let _ = write!(s, "{b:02x}");
            s
        })
}

/// Bytes from lowercase hex; `None` for odd lengths, uppercase or other
/// characters, so each byte string has one spelling.
#[must_use]
pub fn unhex(s: &str) -> Option<Vec<u8>> {
    if !s.len().is_multiple_of(2)
        || !s
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_and_has_one_spelling() {
        assert_eq!(hex(&[0, 171, 255]), "00abff");
        assert_eq!(unhex("00abff"), Some(vec![0, 171, 255]));
        assert_eq!(unhex("00ABFF"), None);
        assert_eq!(unhex("abc"), None);
        assert_eq!(unhex("zz"), None);
    }
}
