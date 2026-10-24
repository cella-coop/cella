//! Lanterne's rules as pure Rust functions over the fact base.
//! Money is integer cents, percentages basis points, dates ISO days
//! (which order correctly as strings). No floats, no hash-map iteration,
//! no clock: the same facts give the same answer on every target.

#![no_std]
// no_std: the rules cannot reach a clock, a file, the network or randomness.
#![deny(clippy::float_arithmetic)]
extern crate alloc;

use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Position {
    pub member: String,
    pub circle: String,
    pub role: Option<String>,
    pub since: Option<String>,
    pub until: Option<String>,
}

#[derive(Deserialize)]
pub struct Mandate {
    pub role: String,
    pub action: String,
    pub max: Option<i64>,
    pub own_circle: bool,
}

#[derive(Deserialize)]
pub struct Vote {
    pub seq: u64,
    pub member: String,
    pub stance: String,
    pub at: String,
}

#[derive(Deserialize)]
pub struct Decision {
    pub id: String,
    pub circle: String,
    pub rule: String,
    pub deadline: String,
    pub closed: Option<String>,
    pub votes: Vec<Vote>,
}

#[derive(Deserialize)]
pub struct Period {
    pub month: String,
    pub closed: Option<String>,
}

#[derive(Deserialize)]
pub struct Line {
    pub debit: i64,
    pub credit: i64,
}

#[derive(Deserialize)]
pub struct Entry {
    pub id: Option<String>,
    pub date: String,
    pub lines: Vec<Line>,
}

#[derive(Deserialize)]
pub struct Payment {
    pub amount: i64,
}

#[derive(Deserialize)]
pub struct Invoice {
    pub id: String,
    pub total: i64,
    pub voided: Option<String>,
    pub payments: Vec<Payment>,
}

#[derive(Deserialize)]
pub struct Facts {
    pub today: String,
    pub positions: Vec<Position>,
    pub mandates: Vec<Mandate>,
    pub decisions: Vec<Decision>,
    pub periods: Vec<Period>,
    pub entries: Vec<Entry>,
    pub invoices: Vec<Invoice>,
}

#[derive(Deserialize)]
pub struct Request {
    pub member: String,
    pub action: String,
    pub amount: Option<i64>,
    pub circle: Option<String>,
    pub decision: Option<String>,
    pub at: String,
}

fn holds(p: &Position, at: &str) -> bool {
    p.since.as_deref().is_none_or(|s| s <= at) && p.until.as_deref().is_none_or(|u| at < u)
}

/// Rule 1: mandates, and votes by members of the deciding circle.
pub fn allowed(f: &Facts, r: &Request) -> bool {
    let mine: Vec<&Position> = f
        .positions
        .iter()
        .filter(|p| p.member == r.member && holds(p, &r.at))
        .collect();
    if r.action == "vote" {
        let circle = f.decisions.iter().find(|d| Some(&d.id) == r.decision.as_ref()).map(|d| &d.circle);
        return circle.is_some_and(|c| mine.iter().any(|p| &p.circle == c));
    }
    f.mandates.iter().any(|m| {
        m.action == r.action
            && m.max.is_none_or(|max| r.amount.unwrap_or(0) <= max)
            && mine.iter().any(|p| {
                p.role.as_deref() == Some(m.role.as_str())
                    && (!m.own_circle || Some(&p.circle) == r.circle.as_ref())
            })
    })
}

/// Rule 2: invariants on a proposed write; returns the broken ones.
pub fn entry_faults(f: &Facts, e: &Entry) -> Vec<&'static str> {
    let mut faults = vec![];
    let open = f
        .periods
        .iter()
        .any(|p| p.month == e.date[..7] && p.closed.is_none());
    if !open {
        faults.push("closed_period");
    }
    let debit: i64 = e.lines.iter().map(|l| l.debit).sum();
    let credit: i64 = e.lines.iter().map(|l| l.credit).sum();
    if debit != credit {
        faults.push("unbalanced");
    }
    faults
}

pub fn payment_faults(inv: &Invoice, amount: i64) -> Vec<&'static str> {
    let mut faults = vec![];
    if inv.voided.is_some() {
        faults.push("voided");
    }
    let paid: i64 = inv.payments.iter().map(|p| p.amount).sum();
    if paid + amount > inv.total {
        faults.push("overpaid");
    }
    faults
}

/// Rule 3: each eligible member's latest stance before the deadline.
fn latest<'a>(f: &Facts, d: &'a Decision) -> BTreeMap<&'a str, &'a str> {
    let mut votes: Vec<&Vote> = d
        .votes
        .iter()
        .filter(|v| v.at <= d.deadline)
        .filter(|v| f.positions.iter().any(|p| p.circle == d.circle && p.member == v.member))
        .collect();
    votes.sort_by_key(|v| v.seq);
    votes.into_iter().map(|v| (v.member.as_str(), v.stance.as_str())).collect()
}

pub struct Outcome {
    pub passes: bool,
    pub open: bool,
}

pub fn outcome(f: &Facts, d: &Decision) -> Outcome {
    let stances = latest(f, d);
    let count = |s: &str| stances.values().filter(|x| **x == s).count();
    let passes = match d.rule.as_str() {
        "consent" => count("block") + count("object") == 0,
        "majority" => count("for") > count("against"),
        _ => false,
    };
    Outcome { passes, open: d.closed.is_none() && f.today < d.deadline }
}

/// Rule 4: the SCOP surplus split; reserves take the rounding remainder.
#[derive(Deserialize)]
pub struct Split {
    pub surplus: i64,
    pub work: i64,
    pub reserves: i64,
    pub interest: i64,
}

pub struct Allocation {
    pub work: i64,
    pub reserves: i64,
    pub interest: i64,
    pub violations: Vec<&'static str>,
}

pub fn split(s: &Split) -> Allocation {
    let work = s.surplus * s.work / 10000;
    let interest = s.surplus * s.interest / 10000;
    let checks = [
        (s.work + s.reserves + s.interest == 10000, "sum"),
        (s.work >= 2500, "work_min"),
        (s.reserves >= 1600, "reserves_min"),
        (s.interest <= 3300, "interest_max"),
        (s.interest <= s.work, "interest_le_work"),
        (s.interest <= s.reserves, "interest_le_reserves"),
    ];
    Allocation {
        work,
        reserves: s.surplus - work - interest,
        interest,
        violations: checks.iter().filter(|(ok, _)| !ok).map(|(_, n)| *n).collect(),
    }
}
