//! Folding stances into outcomes. Each member's stance with the highest
//! receipt counts and the others are superseded, so the fold is the same in
//! any order: receipts order the votes, never their dates.

use crate::{Error, Result};
use std::collections::BTreeMap;
use std::fmt;
use std::str::FromStr;

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Stance {
    For,
    Against,
    Abstain,
    Consent,
    Object,
}

impl Stance {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::For => "for",
            Self::Against => "against",
            Self::Abstain => "abstain",
            Self::Consent => "consent",
            Self::Object => "object",
        }
    }
}

impl FromStr for Stance {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "for" => Ok(Self::For),
            "against" => Ok(Self::Against),
            "abstain" => Ok(Self::Abstain),
            "consent" => Ok(Self::Consent),
            "object" => Ok(Self::Object),
            _ => Err(Error::UnknownStance(s.to_string())),
        }
    }
}

impl fmt::Display for Stance {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Each member's latest stance and the receipt it came with.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Tally {
    latest: BTreeMap<String, (i64, Stance)>,
}

impl Tally {
    pub fn record(&mut self, member: &str, stance: &str, receipt: i64) -> Result<()> {
        let stance = stance.parse::<Stance>()?;
        match self.latest.get(member) {
            Some((r, s)) if *r == receipt && *s != stance => Err(Error::Conflict {
                member: member.to_string(),
                receipt,
            }),
            Some((r, _)) if *r >= receipt => Ok(()),
            _ => {
                self.latest.insert(member.to_string(), (receipt, stance));
                Ok(())
            }
        }
    }

    pub fn merge(&mut self, other: &Self) -> Result<()> {
        for (member, (receipt, stance)) in &other.latest {
            self.record(member, stance.as_str(), *receipt)?;
        }
        Ok(())
    }

    /// How many members' latest stance is each stance.
    #[must_use]
    pub fn count(&self, stance: Stance) -> usize {
        self.latest.values().filter(|(_, s)| *s == stance).count()
    }

    pub fn entries(&self) -> impl Iterator<Item = (&str, i64, Stance)> {
        self.latest.iter().map(|(m, (r, s))| (m.as_str(), *r, *s))
    }

    fn only(&self, rule: &'static str, allowed: &[Stance]) -> Result<()> {
        match self.latest.values().find(|(_, s)| !allowed.contains(s)) {
            Some((_, stance)) => Err(Error::Misplaced { stance: *stance, rule }),
            None => Ok(()),
        }
    }

    /// Passes when someone consents and no one objects.
    pub fn consent(&self) -> Result<bool> {
        self.only("consent", &[Stance::Consent, Stance::Object, Stance::Abstain])?;
        Ok(self.count(Stance::Object) == 0 && self.count(Stance::Consent) > 0)
    }

    /// Passes when more are for than against; abstentions count for neither.
    pub fn majority(&self) -> Result<bool> {
        self.only("majority", &[Stance::For, Stance::Against, Stance::Abstain])?;
        Ok(self.count(Stance::For) > self.count(Stance::Against))
    }

    /// Passes when someone is for and at least `num` in every `den` of the
    /// stances for and against are for, as two thirds of the votes cast do;
    /// abstentions count for neither.
    pub fn share(&self, num: i64, den: i64) -> Result<bool> {
        self.only("a share of the votes", &[Stance::For, Stance::Against, Stance::Abstain])?;
        if num <= 0 || den < num {
            return Err(Error::Share { num, den });
        }
        let yes = i128::try_from(self.count(Stance::For)).map_err(|_| Error::Overflow)?;
        let no = i128::try_from(self.count(Stance::Against)).map_err(|_| Error::Overflow)?;
        Ok(yes > 0 && yes * i128::from(den) >= i128::from(num) * (yes + no))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tally(votes: &[(&str, &str)]) -> Tally {
        let mut t = Tally::default();
        for (receipt, (member, stance)) in (1..).zip(votes) {
            t.record(member, stance, receipt).unwrap();
        }
        t
    }

    // Lanterne's m-2026-012, in file order: Hugo objects, then consents.
    const D012: [(&str, &str); 9] = [
        ("yusuf", "consent"),
        ("amina", "consent"),
        ("thomas", "consent"),
        ("lea", "consent"),
        ("camille", "consent"),
        ("julien", "consent"),
        ("chloe", "consent"),
        ("hugo", "object"),
        ("hugo", "consent"),
    ];

    #[test]
    fn d_2026_012_passes() {
        let t = tally(&D012);
        assert_eq!(t.consent(), Ok(true));
        assert_eq!(t.count(Stance::Consent), 8);
    }

    #[test]
    fn receipts_order_not_input() {
        let mut t = Tally::default();
        t.record("hugo", "consent", 9).unwrap();
        t.record("hugo", "object", 8).unwrap();
        assert_eq!(t.consent(), Ok(true));
        let mut late = Tally::default();
        late.record("hugo", "consent", 8).unwrap();
        late.record("hugo", "object", 9).unwrap();
        assert_eq!(late.consent(), Ok(false));
    }

    #[test]
    fn d_2026_011_fails_while_malik_objects() {
        let mut t = tally(&[("camille", "consent"), ("malik", "object")]);
        assert_eq!(t.consent(), Ok(false));
        t.record("malik", "consent", 3).unwrap();
        assert_eq!(t.consent(), Ok(true));
    }

    #[test]
    fn d_2026_006_majority() {
        let mut votes = vec![("m", "for"); 9];
        votes.push(("sofia", "abstain"));
        let mut t = Tally::default();
        for (i, (m, s)) in (1..).zip(votes) {
            t.record(&format!("{m}{i}"), s, i).unwrap();
        }
        assert_eq!(t.majority(), Ok(true));
        assert!(t.consent().is_err());
    }

    #[test]
    fn nobody_consenting_fails() {
        assert_eq!(Tally::default().consent(), Ok(false));
        assert_eq!(tally(&[("a", "abstain")]).consent(), Ok(false));
        assert_eq!(tally(&[("a", "for"), ("b", "against")]).majority(), Ok(false));
    }

    // Two thirds of the votes cast: six for and three against carry it, at
    // least two in three; six for and four against do not, though more are
    // for than against.
    #[test]
    fn two_thirds() {
        let mut votes = vec!["for"; 6];
        votes.extend(["against"; 3]);
        votes.push("abstain");
        let mut t = Tally::default();
        for (i, s) in (1..).zip(&votes) {
            t.record(&format!("m{i}"), s, i).unwrap();
        }
        assert_eq!(t.share(2, 3), Ok(true));
        t.record("m10", "against", 11).unwrap();
        assert_eq!(t.share(2, 3), Ok(false));
        assert_eq!(t.majority(), Ok(true));
        t.record("m10", "abstain", 12).unwrap();
        assert_eq!(t.share(2, 3), Ok(true));
    }

    #[test]
    fn a_share_needs_someone_for() {
        assert_eq!(Tally::default().share(2, 3), Ok(false));
        assert_eq!(tally(&[("a", "abstain")]).share(1, 2), Ok(false));
        assert_eq!(tally(&[("a", "for"), ("b", "against")]).share(1, 2), Ok(true));
        assert_eq!(tally(&[("a", "for"), ("b", "against")]).share(1, 1), Ok(false));
        assert_eq!(tally(&[("a", "for"), ("b", "abstain")]).share(1, 1), Ok(true));
    }

    #[test]
    fn a_share_is_more_than_none_and_at_most_all() {
        let t = tally(&[("a", "for")]);
        assert_eq!(t.share(0, 3), Err(Error::Share { num: 0, den: 3 }));
        assert_eq!(t.share(4, 3), Err(Error::Share { num: 4, den: 3 }));
        assert!(tally(&[("a", "consent")]).share(2, 3).is_err());
    }

    #[test]
    fn refuses_nonsense() {
        let mut t = Tally::default();
        assert!(t.record("a", "maybe", 1).is_err());
        t.record("a", "for", 1).unwrap();
        assert!(t.record("a", "against", 1).is_err());
        assert!(t.record("a", "for", 1).is_ok());
    }

    #[test]
    fn merge_is_order_free() {
        let (a, b) = D012.split_at(8);
        let mut left = tally(a);
        let mut right = Tally::default();
        right.record(b[0].0, b[0].1, 9).unwrap();
        let both = left.clone();
        left.merge(&right).unwrap();
        right.merge(&both).unwrap();
        assert_eq!(left, right);
        assert_eq!(left.consent(), Ok(true));
    }
}
