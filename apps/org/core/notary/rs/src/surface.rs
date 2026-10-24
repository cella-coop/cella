//! The extension's whole SQL surface, in one place. Every type, function,
//! aggregate, operator, cast and table `cella` exposes is declared here and
//! nowhere else; each is a thin wrapper over `cella-rules` or the notary's
//! plumbing, so a second binding (PGlite, a future runtime) wraps this list.
//!
//! | SQL | Kind | Wraps |
//! |---|---|---|
//! | `cella.amount` | type, with `=`, `<>`, `<`, `<=`, `>`, `>=`, `+` and casts from `bigint`, to `numeric` | `Amount` |
//! | `cella.amount(bigint)`, `cella.cents(amount)` | functions | `Amount::new`, `Amount::cents` |
//! | `cella.allocate(amount, bigint[])` | function | `allocate` |
//! | `cella.digest(text)`, `cella.digest(bytea)` | functions | `digest`, BLAKE3 of the UTF-8 text or the bytes |
//! | `cella.consent(member, stance, receipt)` | aggregate | `Tally::consent` |
//! | `cella.majority(member, stance, receipt)` | aggregate | `Tally::majority` |
//! | `cella.verdict_date()` | function | the transaction's verdict date |
//! | `cella.receipt()` | function | the next receipt number |
//! | `cella.submit(op, payload, actor)` | function | runs the op's rules, appends the verdict |
//! | `cella.verify_log()` | function | `log::Chain` over the whole log |
//! | `cella.notary_key()` | function | the scope's public key |
//! | `cella.head`, `cella.log`, `cella.rule`, `cella.rule_text`, `cella.receipt_seq` | tables, sequence | the log and the rule registry |

use crate::notary;
use cella_rules::{Amount as Cents, Tally};
use pgrx::prelude::*;
use pgrx::{InOutFuncs, JsonB, StringInfo};
use serde::{Deserialize, Serialize};
use std::ffi::CStr;

fn refuse(e: &cella_rules::Error) -> ! {
    ereport!(ERROR, PgSqlErrorCode::ERRCODE_DATA_EXCEPTION, e.to_string());
}

// Amounts: positive cents. Balances are numeric, derived.

#[derive(
    Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, PostgresType, PostgresEq, PostgresOrd,
)]
#[inoutfuncs]
pub struct Amount {
    cents: i64,
}

impl Amount {
    fn of(cents: i64) -> Self {
        let a = Cents::new(cents).unwrap_or_else(|e| refuse(&e));
        Self { cents: a.cents() }
    }

    fn rules(self) -> Cents {
        Cents::new(self.cents).unwrap_or_else(|e| refuse(&e))
    }
}

impl InOutFuncs for Amount {
    fn input(input: &CStr) -> Self {
        let a = Cents::parse(input.to_str().unwrap_or("")).unwrap_or_else(|e| refuse(&e));
        Self { cents: a.cents() }
    }

    fn output(&self, buffer: &mut StringInfo) {
        buffer.push_str(&self.rules().to_string());
    }
}

#[pg_extern(immutable, parallel_safe)]
fn amount(cents: i64) -> Amount {
    Amount::of(cents)
}

#[pg_extern(immutable, parallel_safe)]
fn cents(a: Amount) -> i64 {
    a.cents
}

#[pg_operator(immutable, parallel_safe)]
#[opname(+)]
fn amount_add(a: Amount, b: Amount) -> Amount {
    let sum = a.rules().checked_add(b.rules()).unwrap_or_else(|e| refuse(&e));
    Amount { cents: sum.cents() }
}

#[pg_extern(immutable, parallel_safe)]
fn allocate(total: Amount, weights: Vec<i64>) -> Vec<i64> {
    cella_rules::allocate(total.rules(), &weights).unwrap_or_else(|e| refuse(&e))
}

#[pg_extern(immutable, parallel_safe, name = "digest")]
fn digest_text(text: &str) -> Vec<u8> {
    cella_rules::digest(text.as_bytes()).to_vec()
}

#[pg_extern(immutable, parallel_safe, name = "digest")]
fn digest_bytes(bytes: &[u8]) -> Vec<u8> {
    cella_rules::digest(bytes).to_vec()
}

extension_sql!(
    r"
CREATE FUNCTION cella.to_numeric(a cella.amount) RETURNS numeric
    IMMUTABLE PARALLEL SAFE LANGUAGE sql
    RETURN cella.cents(a)::numeric / 100;
CREATE CAST (cella.amount AS numeric) WITH FUNCTION cella.to_numeric(cella.amount);
CREATE CAST (bigint AS cella.amount) WITH FUNCTION cella.amount(bigint);
",
    name = "amount_casts",
    requires = [Amount, amount, cents, amount_add],
);

// Stance folds. The state keeps every row; the fold in finalize picks each
// member's highest receipt, so no ORDER BY is needed or honoured.

#[derive(Clone, Default, Debug, Serialize, Deserialize, PostgresType)]
pub struct Votes {
    rows: Vec<(String, String, i64)>,
}

impl Votes {
    fn tally(&self) -> Tally {
        let mut t = Tally::default();
        for (member, stance, receipt) in &self.rows {
            t.record(member, stance, *receipt).unwrap_or_else(|e| refuse(&e));
        }
        t
    }
}

#[derive(AggregateName)]
#[aggregate_name = "consent"]
pub struct Consent;

#[pg_aggregate]
impl Aggregate<Consent> for Consent {
    type State = Votes;
    type Args = (name!(member, String), name!(stance, String), name!(receipt, i64));
    type Finalize = bool;
    const INITIAL_CONDITION: Option<&'static str> = Some(r#"{"rows":[]}"#);

    #[pgrx(immutable, parallel_safe)]
    fn state(mut current: Self::State, (member, stance, receipt): Self::Args, _: pg_sys::FunctionCallInfo) -> Self::State {
        current.rows.push((member, stance, receipt));
        current
    }

    #[pgrx(immutable, parallel_safe)]
    fn finalize(current: Self::State, _: Self::OrderedSetArgs, _: pg_sys::FunctionCallInfo) -> Self::Finalize {
        current.tally().consent().unwrap_or_else(|e| refuse(&e))
    }
}

#[derive(AggregateName)]
#[aggregate_name = "majority"]
pub struct Majority;

#[pg_aggregate]
impl Aggregate<Majority> for Majority {
    type State = Votes;
    type Args = (name!(member, String), name!(stance, String), name!(receipt, i64));
    type Finalize = bool;
    const INITIAL_CONDITION: Option<&'static str> = Some(r#"{"rows":[]}"#);

    #[pgrx(immutable, parallel_safe)]
    fn state(mut current: Self::State, (member, stance, receipt): Self::Args, _: pg_sys::FunctionCallInfo) -> Self::State {
        current.rows.push((member, stance, receipt));
        current
    }

    #[pgrx(immutable, parallel_safe)]
    fn finalize(current: Self::State, _: Self::OrderedSetArgs, _: pg_sys::FunctionCallInfo) -> Self::Finalize {
        current.tally().majority().unwrap_or_else(|e| refuse(&e))
    }
}

// The notary: the log, numbered from a locked head row; the rule registry,
// whose rules submit runs for an op, each returning NULL to accept or a
// reason to refuse. Only these functions write either; the app role reads.

extension_sql!(
    r"
CREATE TABLE cella.head (
    one boolean PRIMARY KEY DEFAULT true CHECK (one),
    n bigint NOT NULL,
    hash bytea NOT NULL
);
INSERT INTO cella.head VALUES (true, 0, '\x0000000000000000000000000000000000000000000000000000000000000000');
CREATE TABLE cella.log (
    n bigint PRIMARY KEY,
    op text NOT NULL,
    actor text NOT NULL,
    date date NOT NULL,
    payload bytea NOT NULL,
    rules jsonb NOT NULL,
    prev bytea NOT NULL,
    hash bytea NOT NULL,
    sig bytea NOT NULL
);
CREATE TABLE cella.rule (
    op text NOT NULL,
    fn regprocedure NOT NULL,
    owner text NOT NULL,
    PRIMARY KEY (op, fn)
);
CREATE TABLE cella.rule_text (
    hash bytea PRIMARY KEY,
    fn text NOT NULL,
    body text NOT NULL
);
CREATE SEQUENCE cella.receipt_seq;
REVOKE ALL ON cella.head, cella.log, cella.rule, cella.rule_text, cella.receipt_seq FROM PUBLIC;
GRANT SELECT ON cella.head, cella.log, cella.rule, cella.rule_text TO PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.head', '');
SELECT pg_catalog.pg_extension_config_dump('cella.log', '');
SELECT pg_catalog.pg_extension_config_dump('cella.rule', '');
SELECT pg_catalog.pg_extension_config_dump('cella.rule_text', '');
SELECT pg_catalog.pg_extension_config_dump('cella.receipt_seq', '');
",
    name = "notary_tables",
    bootstrap,
);

/// The transaction's verdict date: fixed at its first use, by `submit` or
/// by a write before it, and recorded in the log. Rules read this, never
/// `now()`.
#[pg_extern(stable)]
fn verdict_date() -> pgrx::datum::Date {
    notary::verdict_date()
}

/// A receipt number for a write as it arrives. Receipts order stances;
/// a write that rolls back leaves a gap here, never in the log.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn receipt() -> i64 {
    notary::receipt()
}

/// Runs the op's rules and appends a numbered, signed verdict. Call it last
/// in the handler's transaction. A refusal raises SQLSTATE 09000 with the
/// rule's reason, so the transaction rolls back and no number is used; the
/// rows returned are therefore always settled.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn submit(
    op: &str,
    payload: JsonB,
    actor: &str,
) -> TableIterator<'static, (name!(verdict, i64), name!(state, String), name!(reason, Option<String>))> {
    let n = notary::submit(op, &payload, actor);
    TableIterator::once((n, "settled".to_string(), None))
}

/// Recomputes the chain from the first entry and checks every signature
/// against the scope's key, and that the head names the last entry.
#[pg_extern(stable, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn verify_log() -> bool {
    notary::verify_log()
}

#[pg_extern(stable, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn notary_key() -> Vec<u8> {
    notary::public_key().to_vec()
}
