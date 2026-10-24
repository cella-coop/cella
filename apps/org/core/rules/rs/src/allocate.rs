//! Splitting an amount in proportion to weights, exactly: each part gets
//! its floor, and the cents left over go one each to the largest
//! remainders, ties to the earlier part. The parts always sum to the total.

use crate::{Amount, Error, Result};

pub fn allocate(total: Amount, weights: &[i64]) -> Result<Vec<i64>> {
    if let Some(w) = weights.iter().find(|w| **w < 0) {
        return Err(Error::NegativeWeight(*w));
    }
    let sum = weights
        .iter()
        .try_fold(0i128, |s, w| s.checked_add(i128::from(*w)))
        .ok_or(Error::Overflow)?;
    if sum == 0 {
        return Err(Error::NoWeight);
    }
    let total = i128::from(total.cents());
    let mut parts = Vec::with_capacity(weights.len());
    let mut rems = Vec::with_capacity(weights.len());
    for (i, w) in weights.iter().enumerate() {
        let product = total.checked_mul(i128::from(*w)).ok_or(Error::Overflow)?;
        parts.push(product / sum);
        rems.push((product % sum, i));
    }
    let given: i128 = parts.iter().sum();
    let left = usize::try_from(total - given).map_err(|_| Error::Overflow)?;
    rems.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    for (_, i) in rems.into_iter().take(left) {
        parts[i] += 1;
    }
    parts
        .into_iter()
        .map(|p| i64::try_from(p).map_err(|_| Error::Overflow))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lanterne_surplus_2025() {
        let surplus = Amount::new(6_140_000).unwrap();
        assert_eq!(allocate(surplus, &[45, 40, 15]), Ok(vec![2_763_000, 2_456_000, 921_000]));
    }

    #[test]
    fn remainders_sum_exactly() {
        let one = Amount::new(100).unwrap();
        assert_eq!(allocate(one, &[1, 1, 1]), Ok(vec![34, 33, 33]));
        assert_eq!(allocate(one, &[1, 2]), Ok(vec![33, 67]));
        let odd = Amount::new(1001).unwrap();
        let parts = allocate(odd, &[40, 20, 20, 20, 20, 0]).unwrap();
        assert_eq!(parts.iter().sum::<i64>(), 1001);
        assert_eq!(parts[5], 0);
    }

    #[test]
    fn refuses_bad_weights() {
        let a = Amount::new(10).unwrap();
        assert_eq!(allocate(a, &[]), Err(Error::NoWeight));
        assert_eq!(allocate(a, &[0, 0]), Err(Error::NoWeight));
        assert_eq!(allocate(a, &[1, -1]), Err(Error::NegativeWeight(-1)));
    }

    #[test]
    fn large_values_do_not_overflow() {
        let a = Amount::new(i64::MAX).unwrap();
        let parts = allocate(a, &[i64::MAX, i64::MAX]).unwrap();
        assert_eq!(i128::from(parts[0]) + i128::from(parts[1]), i128::from(i64::MAX));
    }
}
