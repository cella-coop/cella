//! cella core inside Postgres: the amount type, the stance aggregates and the notary log.
//! A feasibility spike, not the product: the signing key is a fixed test seed.

use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey, Signature};
use pgrx::prelude::*;
use pgrx::{InOutFuncs, JsonB, StringInfo};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ffi::CStr;

::pgrx::pg_module_magic!(name, version);

// amount: positive cents

#[derive(
    Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash,
    Serialize, Deserialize, PostgresType, PostgresEq, PostgresOrd,
)]
#[inoutfuncs]
pub struct Amount {
    cents: i64,
}

fn positive(cents: i64) -> Amount {
    if cents <= 0 {
        ereport!(
            ERROR,
            PgSqlErrorCode::ERRCODE_CHECK_VIOLATION,
            format!("cella.amount must be positive, got {cents} cents"),
            "an amount is a positive number of cents; a signed balance is a numeric"
        );
    }
    Amount { cents }
}

fn parse_cents(s: &str) -> Option<i64> {
    let s = s.trim();
    let (neg, s) = match s.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, s),
    };
    let (whole, frac) = s.split_once('.').unwrap_or((s, ""));
    if whole.is_empty() || frac.len() > 2 || !whole.bytes().chain(frac.bytes()).all(|b| b.is_ascii_digit()) {
        return None;
    }
    let frac = format!("{frac:0<2}");
    let cents = whole.parse::<i64>().ok()?.checked_mul(100)?.checked_add(frac.parse::<i64>().ok()?)?;
    Some(if neg { -cents } else { cents })
}

impl InOutFuncs for Amount {
    #[allow(unreachable_code)] // ereport!(ERROR) diverges, but its type does not say so
    fn input(input: &CStr) -> Self {
        let s = input.to_str().unwrap_or("");
        match parse_cents(s) {
            Some(cents) => positive(cents),
            None => {
                ereport!(
                    ERROR,
                    PgSqlErrorCode::ERRCODE_INVALID_TEXT_REPRESENTATION,
                    format!("invalid cella.amount: {s:?}"),
                    "write euros with at most two decimals, e.g. 12.50"
                );
                unreachable!()
            }
        }
    }

    fn output(&self, buffer: &mut StringInfo) {
        buffer.push_str(&format!("{}.{:02}", self.cents / 100, self.cents % 100));
    }
}

#[pg_extern(immutable, parallel_safe)]
fn amount(cents: i64) -> Amount {
    positive(cents)
}

#[pg_extern(immutable, parallel_safe)]
fn cents(a: Amount) -> i64 {
    a.cents
}

#[pg_operator(immutable, parallel_safe)]
#[opname(+)]
fn amount_add(a: Amount, b: Amount) -> Amount {
    match a.cents.checked_add(b.cents) {
        Some(c) => Amount { cents: c },
        None => error!("cella.amount overflow"),
    }
}

extension_sql!(
    r#"
CREATE FUNCTION cella.to_numeric(a cella.amount) RETURNS numeric
    IMMUTABLE PARALLEL SAFE LANGUAGE sql
    RETURN cella.cents(a)::numeric * 0.01;
CREATE CAST (cella.amount AS numeric) WITH FUNCTION cella.to_numeric(cella.amount);
CREATE CAST (bigint AS cella.amount) WITH FUNCTION cella.amount(bigint);
"#,
    name = "amount_casts",
    requires = [Amount, amount, cents, amount_add],
);

// stances: only each member's latest stance counts (callers pass ORDER BY at)

const STANCES: [&str; 6] = ["for", "against", "abstain", "consent", "object", "block"];

#[derive(Clone, Default, Debug, Serialize, Deserialize, PostgresType)]
pub struct Stances {
    latest: BTreeMap<String, String>,
}

impl Stances {
    fn record(mut self, member: String, stance: String) -> Self {
        if !STANCES.contains(&stance.as_str()) {
            error!("unknown stance {stance:?}; expected one of {STANCES:?}");
        }
        self.latest.insert(member, stance);
        self
    }
}

#[derive(AggregateName)]
#[aggregate_name = "consent"]
pub struct Consent;

#[pg_aggregate]
impl Aggregate<Consent> for Consent {
    type State = Stances;
    type Args = (name!(member, String), name!(stance, String));
    type Finalize = bool;
    const INITIAL_CONDITION: Option<&'static str> = Some(r#"{"latest":{}}"#);

    #[pgrx(immutable, parallel_safe)]
    fn state(current: Self::State, (member, stance): Self::Args, _: pg_sys::FunctionCallInfo) -> Self::State {
        current.record(member, stance)
    }

    #[pgrx(immutable, parallel_safe)]
    fn finalize(current: Self::State, _: Self::OrderedSetArgs, _: pg_sys::FunctionCallInfo) -> Self::Finalize {
        !current.latest.values().any(|s| s == "object" || s == "block")
    }
}

#[derive(AggregateName)]
#[aggregate_name = "tally"]
pub struct Tally;

#[pg_aggregate]
impl Aggregate<Tally> for Tally {
    type State = Stances;
    type Args = (name!(member, String), name!(stance, String));
    type Finalize = JsonB;
    const INITIAL_CONDITION: Option<&'static str> = Some(r#"{"latest":{}}"#);

    #[pgrx(immutable, parallel_safe)]
    fn state(current: Self::State, (member, stance): Self::Args, _: pg_sys::FunctionCallInfo) -> Self::State {
        current.record(member, stance)
    }

    #[pgrx(immutable, parallel_safe)]
    fn finalize(current: Self::State, _: Self::OrderedSetArgs, _: pg_sys::FunctionCallInfo) -> Self::Finalize {
        let mut counts: BTreeMap<&str, i64> = STANCES.iter().map(|s| (*s, 0)).collect();
        for s in current.latest.values() {
            *counts.entry(s.as_str()).or_default() += 1;
        }
        JsonB(serde_json::to_value(counts).unwrap())
    }
}

// the notary log: numbered from a locked head row, BLAKE3-chained, Ed25519-signed

extension_sql!(
    r#"
CREATE TABLE cella.head (
    one boolean PRIMARY KEY DEFAULT true CHECK (one),
    n bigint NOT NULL,
    hash bytea NOT NULL
);
INSERT INTO cella.head VALUES (true, 0, '\x0000000000000000000000000000000000000000000000000000000000000000');
CREATE TABLE cella.log (
    n bigint PRIMARY KEY,
    op text NOT NULL,
    payload jsonb NOT NULL,
    prev bytea NOT NULL,
    hash bytea NOT NULL,
    sig bytea NOT NULL
);
REVOKE ALL ON cella.head, cella.log FROM PUBLIC;
"#,
    name = "log_tables",
    bootstrap,
);

// Test key only: the product loads the scope's key from a superuser-only file.
fn key() -> SigningKey {
    SigningKey::from_bytes(&[7u8; 32])
}

fn digest(n: i64, op: &str, payload: &serde_json::Value, prev: &[u8]) -> [u8; 32] {
    let body = payload.to_string();
    let mut h = blake3::Hasher::new_derive_key("cella 2026-10 log entry");
    h.update(&n.to_be_bytes());
    h.update(&(op.len() as u64).to_be_bytes());
    h.update(op.as_bytes());
    h.update(&(body.len() as u64).to_be_bytes());
    h.update(body.as_bytes());
    h.update(prev);
    *h.finalize().as_bytes()
}

#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn submit(op: &str, payload: JsonB) -> i64 {
    let (n, prev) = Spi::get_two::<i64, Vec<u8>>("SELECT n, hash FROM cella.head FOR UPDATE")
        .expect("head row");
    let n = n.expect("head n") + 1;
    let prev = prev.expect("head hash");
    let hash = digest(n, op, &payload.0, &prev);
    let sig = key().sign(&hash).to_bytes().to_vec();
    Spi::run_with_args(
        "INSERT INTO cella.log (n, op, payload, prev, hash, sig) VALUES ($1, $2, $3, $4, $5, $6)",
        &[n.into(), op.to_string().into(), payload.into(), prev.into(), hash.to_vec().into(), sig.into()],
    )
    .expect("log insert");
    Spi::run_with_args(
        "UPDATE cella.head SET n = $1, hash = $2",
        &[n.into(), hash.to_vec().into()],
    )
    .expect("head update");
    n
}

#[pg_extern(immutable, parallel_safe)]
fn notary_key() -> Vec<u8> {
    key().verifying_key().to_bytes().to_vec()
}

/// Recompute the chain and check every signature; returns the number of entries verified.
#[pg_extern(stable)]
fn verify_log() -> i64 {
    let pk: VerifyingKey = key().verifying_key();
    Spi::connect(|c| {
        let rows = c
            .select("SELECT n, op, payload, prev, hash, sig FROM cella.log ORDER BY n", None, &[])
            .expect("log select");
        let mut want_prev = vec![0u8; 32];
        let mut want_n = 1i64;
        for row in rows {
            let n: i64 = row.get(1).unwrap().unwrap();
            let op: String = row.get(2).unwrap().unwrap();
            let payload: JsonB = row.get(3).unwrap().unwrap();
            let prev: Vec<u8> = row.get(4).unwrap().unwrap();
            let hash: Vec<u8> = row.get(5).unwrap().unwrap();
            let sig: Vec<u8> = row.get(6).unwrap().unwrap();
            if n != want_n || prev != want_prev {
                error!("log broken at {n}: gap or wrong prev");
            }
            if digest(n, &op, &payload.0, &prev).as_slice() != hash.as_slice() {
                error!("log broken at {n}: hash mismatch");
            }
            let sig = Signature::from_slice(&sig).unwrap_or_else(|_| error!("bad signature at {n}"));
            if pk.verify(&hash, &sig).is_err() {
                error!("log broken at {n}: signature invalid");
            }
            want_prev = hash;
            want_n += 1;
        }
        want_n - 1
    })
}

// crash evidence: a Rust panic, and a hard abort that bypasses pgrx's guard

#[pg_extern]
fn boom(kind: &str) -> &'static str {
    match kind {
        "panic" => panic!("boom: a Rust panic inside the notary"),
        "abort" => std::process::abort(),
        _ => "no boom",
    }
}
