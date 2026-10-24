//! Cella's rule primitives, pure and deterministic: no clock, no I/O, no
//! floats, every sum overflow-checked. The `cella` Postgres extension wraps
//! them as SQL; the same crate compiles to WASM for devices and auditors.

#![forbid(unsafe_code)]

pub mod allocate;
pub mod amount;
pub mod digest;
pub mod hex;
pub mod log;
pub mod sign;
pub mod vote;

pub use allocate::allocate;
pub use amount::{Amount, Balance};
pub use digest::digest;
pub use vote::{Stance, Tally};

use thiserror::Error;

/// Why a primitive refused its input.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum Error {
    #[error("an amount must be positive, got {0} cents")]
    NotPositive(i64),
    #[error("overflow")]
    Overflow,
    #[error("invalid amount {0:?}: write euros with at most two decimals, e.g. 12.50")]
    Parse(String),
    #[error("unknown stance {0:?}")]
    UnknownStance(String),
    #[error("stance {stance} does not count under {rule}")]
    Misplaced { stance: Stance, rule: &'static str },
    #[error("{member} has two stances at receipt {receipt}")]
    Conflict { member: String, receipt: i64 },
    #[error("allocation needs at least one positive weight")]
    NoWeight,
    #[error("a weight must not be negative, got {0}")]
    NegativeWeight(i64),
    #[error("invalid date {0:?}: expected YYYY-MM-DD")]
    Date(String),
    #[error("a payload holds integers only, never floats: {0}")]
    Float(String),
    #[error("invalid key: {0}")]
    Key(String),
    #[error("a signed {0} is empty, holds a control character or is malformed")]
    Field(&'static str),
    #[error("{0}")]
    Signature(&'static str),
}

pub type Result<T> = std::result::Result<T, Error>;
