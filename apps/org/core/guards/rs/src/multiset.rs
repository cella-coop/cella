//! A multiset hash: `LtHash16`, as Lewi, Kim, Maykov and Weis give it, the
//! hash of a set of elements as the lane-wise sum of each element's hash,
//! so adding an element or taking one away costs one sum whatever the
//! set's size, and the hash is the same whatever order the elements came
//! in. An element hashes to the BLAKE3 output of its bytes extended to
//! 2048 bytes, read as 1024 little-endian 16-bit lanes, under a key of its
//! own, so no other digest of cella's is ever an element's. The lanes add
//! modulo 2^16: a sum here wraps by design, being a group's, never an
//! amount's. The fold keeps one for each state table (architecture.md,
//! "Folds").

/// How many 16-bit lanes a multiset hash has.
pub const LANES: usize = 1024;

/// How many bytes a multiset hash is.
pub const BYTES: usize = 2 * LANES;

const CONTEXT: &str = "cella 2026-11-11 multiset lthash16";

/// The hash of the empty multiset.
#[must_use]
pub fn zero() -> Vec<u8> {
    vec![0; BYTES]
}

/// The hash of the multiset holding the element alone.
#[must_use]
pub fn element(bytes: &[u8]) -> Vec<u8> {
    let mut out = vec![0; BYTES];
    blake3::Hasher::new_derive_key(CONTEXT)
        .update(bytes)
        .finalize_xof()
        .fill(&mut out);
    out
}

/// A hash that is no multiset hash, being of another length.
#[derive(Debug, PartialEq, Eq)]
pub struct Width(pub usize);

impl std::fmt::Display for Width {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "a multiset hash is {BYTES} bytes, not {}: hash an element with cella.lthash",
            self.0
        )
    }
}

fn lanes(h: &[u8]) -> Result<impl Iterator<Item = u16> + '_, Width> {
    if h.len() == BYTES {
        Ok(h.as_chunks::<2>().0.iter().map(|l| u16::from_le_bytes(*l)))
    } else {
        Err(Width(h.len()))
    }
}

/// The hash of the union of two multisets.
pub fn add(a: &[u8], b: &[u8]) -> Result<Vec<u8>, Width> {
    Ok(lanes(a)?
        .zip(lanes(b)?)
        .flat_map(|(x, y)| x.wrapping_add(y).to_le_bytes())
        .collect())
}

/// The hash of a multiset with each element `k` times as often: `-1` its
/// inverse, which added takes the multiset away again.
pub fn times(a: &[u8], k: i64) -> Result<Vec<u8>, Width> {
    // Modulo 2^16, k is its low 16 bits, a negative k's too.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let k = k as u16;
    Ok(lanes(a)?
        .flat_map(|x| x.wrapping_mul(k).to_le_bytes())
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(elements: &[&str]) -> Vec<u8> {
        elements.iter().fold(zero(), |h, e| {
            add(&h, &element(e.as_bytes())).expect("a width")
        })
    }

    #[test]
    fn a_multiset_hashes_the_same_whatever_its_order() {
        assert_eq!(set(&["a", "b", "c"]), set(&["c", "a", "b"]));
        assert_ne!(set(&["a", "b"]), set(&["a", "c"]));
        // A multiset, not a set: an element twice is not an element once.
        assert_ne!(set(&["a", "a"]), set(&["a"]));
        assert_eq!(
            set(&["a", "a", "a"]),
            add(&set(&["a"]), &times(&element(b"a"), 2).expect("a width")).expect("a width")
        );
    }

    #[test]
    fn an_element_taken_away_leaves_the_multiset_without_it() {
        let taken = add(
            &set(&["a", "b", "c"]),
            &times(&element(b"b"), -1).expect("a width"),
        )
        .expect("a width");
        assert_eq!(taken, set(&["a", "c"]));
        let all = add(&set(&["a"]), &times(&set(&["a"]), -1).expect("a width")).expect("a width");
        assert_eq!(all, zero());
    }

    #[test]
    fn an_element_is_keyed_apart_from_a_plain_digest() {
        assert_eq!(element(b"x").len(), BYTES);
        assert_ne!(&element(b"x")[..32], &crate::digest(b"x")[..]);
    }

    #[test]
    fn a_hash_of_another_width_is_refused() {
        assert_eq!(add(&zero(), &[0; 32]), Err(Width(32)));
        assert_eq!(times(&[0; 3], 2), Err(Width(3)));
    }
}
