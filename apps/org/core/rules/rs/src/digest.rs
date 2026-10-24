//! Content digests: the plain BLAKE3 of some bytes, as `b3sum` computes it,
//! so anyone holding a saved text can check it against its digest without
//! cella. The log's own digests are domain-separated in `log`; these name
//! content, such as a document version's canonical text.

#[must_use]
pub fn digest(bytes: &[u8]) -> [u8; 32] {
    *blake3::hash(bytes).as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(b: &[u8]) -> String {
        b.iter().map(|x| format!("{x:02x}")).collect()
    }

    #[test]
    fn is_b3sum() {
        assert_eq!(hex(&digest(b"")), "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262");
    }

    #[test]
    fn differs_from_the_log_digests() {
        assert_ne!(digest(b"x"), crate::log::rule_digest("x"));
    }
}
