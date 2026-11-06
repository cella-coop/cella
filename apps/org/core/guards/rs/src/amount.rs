//! Money in cents. An `Amount` is what moves and is always positive; a
//! `Balance` is what is left and may be negative.

use crate::{Error, Result};
use std::fmt;

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Amount(i64);

#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Balance(i64);

impl Amount {
    pub fn new(cents: i64) -> Result<Self> {
        if cents <= 0 {
            return Err(Error::NotPositive(cents));
        }
        Ok(Self(cents))
    }

    #[must_use]
    pub fn cents(self) -> i64 {
        self.0
    }

    pub fn checked_add(self, other: Self) -> Result<Self> {
        self.0.checked_add(other.0).map(Self).ok_or(Error::Overflow)
    }

    pub fn parse(s: &str) -> Result<Self> {
        Self::new(parse_cents(s)?)
    }
}

impl Balance {
    #[must_use]
    pub fn new(cents: i64) -> Self {
        Self(cents)
    }

    #[must_use]
    pub fn cents(self) -> i64 {
        self.0
    }

    pub fn credit(self, a: Amount) -> Result<Self> {
        self.0.checked_add(a.0).map(Self).ok_or(Error::Overflow)
    }

    pub fn debit(self, a: Amount) -> Result<Self> {
        self.0.checked_sub(a.0).map(Self).ok_or(Error::Overflow)
    }
}

fn parse_cents(s: &str) -> Result<i64> {
    let bad = || Error::Parse(s.to_string());
    let t = s.trim();
    let (neg, t) = match t.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, t),
    };
    let (whole, frac) = t.split_once('.').unwrap_or((t, ""));
    let digits = whole
        .bytes()
        .chain(frac.bytes())
        .all(|b| b.is_ascii_digit());
    if whole.is_empty() || frac.len() > 2 || !digits {
        return Err(bad());
    }
    let frac = format!("{frac:0<2}");
    let cents = whole
        .parse::<i64>()
        .ok()
        .and_then(|w| w.checked_mul(100))
        .and_then(|w| w.checked_add(frac.parse::<i64>().ok()?))
        .ok_or_else(bad)?;
    Ok(if neg { -cents } else { cents })
}

fn write_cents(f: &mut fmt::Formatter<'_>, cents: i64) -> fmt::Result {
    let sign = if cents < 0 { "-" } else { "" };
    let abs = cents.unsigned_abs();
    write!(f, "{sign}{}.{:02}", abs / 100, abs % 100)
}

impl fmt::Display for Amount {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write_cents(f, self.0)
    }
}

impl fmt::Display for Balance {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write_cents(f, self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positive_only() {
        assert_eq!(Amount::new(0), Err(Error::NotPositive(0)));
        assert_eq!(Amount::new(-5), Err(Error::NotPositive(-5)));
        assert_eq!(Amount::new(1).unwrap().cents(), 1);
    }

    #[test]
    fn parses_and_prints() {
        assert_eq!(Amount::parse("12.5").unwrap().cents(), 1250);
        assert_eq!(Amount::parse("61400").unwrap().to_string(), "61400.00");
        assert!(Amount::parse("1.234").is_err());
        assert!(Amount::parse("abc").is_err());
        assert_eq!(Amount::parse("-3"), Err(Error::NotPositive(-300)));
    }

    #[test]
    fn overflow_is_an_error() {
        let max = Amount::new(i64::MAX).unwrap();
        assert_eq!(
            max.checked_add(Amount::new(1).unwrap()),
            Err(Error::Overflow)
        );
        assert_eq!(
            Balance::new(i64::MIN).debit(Amount::new(1).unwrap()),
            Err(Error::Overflow)
        );
    }

    #[test]
    fn balances_go_negative() {
        let b = Balance::default()
            .debit(Amount::new(4205).unwrap())
            .unwrap();
        assert_eq!(b.to_string(), "-42.05");
    }
}
