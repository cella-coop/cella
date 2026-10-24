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
//! | `cella.document_canonical(bytea)`, `cella.document_hash(bytea)`, `cella.document_text(bytea)` | functions | `document::canonical`, `document::hash`, `document::plain`, over a Loro snapshot |
//! | `cella.consent(member, stance, receipt)` | aggregate | `Tally::consent` |
//! | `cella.majority(member, stance, receipt)` | aggregate | `Tally::majority` |
//! | `cella.verdict_date()` | function | the transaction's verdict date |
//! | `cella.receipt()` | function | the transaction's receipt number |
//! | `cella.submit(op, payload, actor, signed)` | function | checks the member's signature, the device and the nonce, runs the op's rules, signs the receipt and appends the verdict |
//! | `cella.op()`, `cella.actor()`, `cella.device()` | functions | the write being judged, for rules |
//! | `cella.verify_log()` | function | `log::Chain` over the whole log and its receipts |
//! | `cella.notary_key()` | function | the scope's public key |
//! | `cella.head`, `cella.log`, `cella.receipt`, `cella.receipt_seq` | tables, sequence | the log and its signed receipts |
//! | `cella.rule`, `cella.rule_text`, `cella.keyring`, `cella.power` | tables | the registries: rules per op, the keyring, the power each op needs |
//! | `cella.retention`, `cella.personal` | tables | the retention classes and their clocks; the columns holding personal data, each feat's own |
//! | `cella.redact(subject, class)` | function, the owner's | redacts a subject's columns of a class in the read models |
//! | `vault.key`, `vault.secret`, `vault.erased`, `vault.swept` | tables, the owner's but `erased` | sealed keys, the salts and sealed values that open commitments, erasures, sweeps |
//! | `cella.opened(n)` | function | an entry's logged payload, its commitments opened from the vault |
//! | `cella.redacting()` | function | whether the notary is redacting, for a feat's trigger that keeps a row fixed |
//! | `cella.vault_sweep()` | function, a superuser's | restricted data erased once its clock runs out |

use crate::{notary, vault};
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

// Documents: the canonical JSON of a Loro snapshot's block tree, its
// BLAKE3, and its plain text. Deterministic for a pinned `loro`, so a
// generated column may hold them.

#[pg_extern(immutable, parallel_safe)]
fn document_canonical(snapshot: &[u8]) -> String {
    cella_rules::document::canonical(snapshot).unwrap_or_else(|e| refuse(&e))
}

#[pg_extern(immutable, parallel_safe)]
fn document_hash(snapshot: &[u8]) -> Vec<u8> {
    cella_rules::document::hash(snapshot).unwrap_or_else(|e| refuse(&e)).to_vec()
}

#[pg_extern(immutable, parallel_safe)]
fn document_text(snapshot: &[u8]) -> String {
    cella_rules::document::plain(snapshot).unwrap_or_else(|e| refuse(&e))
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

// The notary: the log, numbered from a locked head row, each entry naming
// its signed receipt; the rule registry, whose rules submit runs for an op,
// each returning NULL to accept or a reason to refuse; the keyring, the one
// function that says whether a device is an actor's current key; and the
// power each op needs, which a graft's rule reads. Only these functions
// write the log and the receipts; migrations register; everyone reads.

extension_sql!(
    r"
CREATE TABLE cella.head (
    one boolean PRIMARY KEY DEFAULT true CHECK (one),
    n bigint NOT NULL,
    hash bytea NOT NULL
);
INSERT INTO cella.head VALUES (true, 0, '\x0000000000000000000000000000000000000000000000000000000000000000');
CREATE TABLE cella.receipt (
    n bigint PRIMARY KEY,
    op text NOT NULL,
    actor text NOT NULL,
    device bytea NOT NULL,
    nonce text NOT NULL,
    request bytea NOT NULL,
    signature bytea NOT NULL,
    payload bytea NOT NULL,
    at text NOT NULL,
    hash bytea NOT NULL,
    sig bytea NOT NULL,
    UNIQUE (device, nonce)
);
CREATE TABLE cella.log (
    n bigint PRIMARY KEY,
    op text NOT NULL,
    actor text NOT NULL,
    date date NOT NULL,
    payload bytea NOT NULL,
    form jsonb NOT NULL,
    receipt bigint NOT NULL UNIQUE REFERENCES cella.receipt,
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
CREATE TABLE cella.keyring (
    one boolean PRIMARY KEY DEFAULT true CHECK (one),
    fn regprocedure NOT NULL,
    owner text NOT NULL
);
CREATE TABLE cella.power (
    op text PRIMARY KEY,
    power text NOT NULL,
    amount text,
    owner text NOT NULL
);
CREATE SEQUENCE cella.receipt_seq;
REVOKE ALL ON cella.head, cella.log, cella.receipt, cella.rule, cella.rule_text, cella.keyring, cella.power, cella.receipt_seq FROM PUBLIC;
GRANT SELECT ON cella.head, cella.log, cella.receipt, cella.rule, cella.rule_text, cella.keyring, cella.power TO PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.head', '');
SELECT pg_catalog.pg_extension_config_dump('cella.log', '');
SELECT pg_catalog.pg_extension_config_dump('cella.receipt', '');
SELECT pg_catalog.pg_extension_config_dump('cella.rule', '');
SELECT pg_catalog.pg_extension_config_dump('cella.rule_text', '');
SELECT pg_catalog.pg_extension_config_dump('cella.keyring', '');
SELECT pg_catalog.pg_extension_config_dump('cella.power', '');
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

/// The transaction's receipt number: one write, one receipt, taken at its
/// first use, by the handler or by `submit`, which signs it. Receipts order
/// stances; a write that rolls back leaves a gap here, never in the log.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn receipt() -> i64 {
    notary::receipt()
}

/// Checks the member's signature on the request, that the device is the
/// actor's current key and that its nonce is new, then runs the op's rules,
/// signs the receipt and appends a numbered, signed verdict naming it. Call
/// it last in the handler's transaction. `signed` is `{request, device,
/// nonce, sig}`, bytes in hex. A refusal raises SQLSTATE 09000 with its
/// reason, so the transaction rolls back and no number is used; the rows
/// returned are therefore always settled.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn submit(
    op: &str,
    payload: JsonB,
    actor: &str,
    signed: JsonB,
) -> TableIterator<'static, (name!(verdict, i64), name!(state, String), name!(reason, Option<String>))> {
    let n = notary::submit(op, &payload, actor, &signed);
    TableIterator::once((n, "settled".to_string(), None))
}

/// The op of the write `submit` is judging; NULL outside it.
#[pg_extern(stable)]
fn op() -> Option<String> {
    notary::op()
}

/// The member the write being judged is for; NULL outside `submit`.
#[pg_extern(stable)]
fn actor() -> Option<String> {
    notary::actor()
}

/// The public key of the device that signed the write being judged; NULL
/// outside `submit`.
#[pg_extern(stable)]
fn device() -> Option<Vec<u8>> {
    notary::device()
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

// Personal data: the retention classes and their clocks, which columns
// hold personal data and of whom, each feat registering its own; and the
// vault, which only these functions write: each subject's keys per class
// and year, sealed under a key derived from the scope's seed, the salts
// and sealed values that open the log's commitments, the erasures asked
// and the sweeps carried out. No role but the extension's owner reads the
// keys or the secrets.

extension_sql!(
    r#"
CREATE TABLE cella.retention (
    class text PRIMARY KEY CHECK (class ~ '^[a-z][a-z-]*$'),
    years integer NOT NULL CHECK (years >= 0),
    restricted boolean NOT NULL,
    basis text NOT NULL
);
INSERT INTO cella.retention (class, years, restricted, basis) VALUES
  ('member-profile', 0, false, 'none: erased when asked (GDPR art. 17)'),
  ('contact', 0, false, 'none: erased when asked (GDPR art. 17)'),
  ('payroll', 5, true, 'Code du travail, art. L3243-4: the employer keeps a copy of each payslip for five years'),
  ('expense-receipt', 10, true, 'Code de commerce, art. L123-22: supporting vouchers are kept for ten years'),
  ('books', 10, true, 'Code de commerce, art. L123-22: accounting documents are kept for ten years');
CREATE TABLE cella.personal (
    schema text NOT NULL,
    tab text NOT NULL,
    col text NOT NULL,
    class text NOT NULL REFERENCES cella.retention,
    subject text NOT NULL,
    owner text NOT NULL,
    PRIMARY KEY (schema, tab, col)
);

-- A registered column exists, names its subject by another, and can be
-- redacted: text or JSON, which take the marker, or nullable.
CREATE FUNCTION cella.personal_checked() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  rel regclass := to_regclass(format('%I.%I', NEW.schema, NEW.tab));
  t regtype;
  required boolean;
BEGIN
  IF rel IS NULL THEN
    RAISE EXCEPTION 'cella.personal: no table %.%', NEW.schema, NEW.tab;
  END IF;
  SELECT a.atttypid::regtype, a.attnotnull INTO t, required
  FROM pg_attribute a WHERE a.attrelid = rel AND a.attname = NEW.col AND NOT a.attisdropped;
  IF t IS NULL THEN
    RAISE EXCEPTION 'cella.personal: no column %.%.%', NEW.schema, NEW.tab, NEW.col;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid = rel AND a.attname = NEW.subject AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'cella.personal: %.% has no column % naming the subject', NEW.schema, NEW.tab, NEW.subject;
  END IF;
  IF required AND t NOT IN ('text'::regtype, 'character varying'::regtype, 'jsonb'::regtype, 'json'::regtype) THEN
    RAISE EXCEPTION 'cella.personal: %.%.% is % and NOT NULL, so erasure cannot redact it', NEW.schema, NEW.tab, NEW.col, t;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER checked BEFORE INSERT OR UPDATE ON cella.personal
  FOR EACH ROW EXECUTE FUNCTION cella.personal_checked();

-- Redacts a subject's columns of a class in the read models: text takes
-- the marker `redacted`, JSON the string, anything else NULL.
CREATE FUNCTION cella.redact(subject text, class text) RETURNS integer LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  p record;
  t regtype;
  done integer := 0;
  n integer;
BEGIN
  FOR p IN SELECT x.schema, x.tab, x.col, x.subject AS who FROM cella.personal x WHERE x.class = redact.class ORDER BY 1, 2, 3 LOOP
    SELECT a.atttypid::regtype INTO t FROM pg_attribute a
    WHERE a.attrelid = format('%I.%I', p.schema, p.tab)::regclass AND a.attname = p.col;
    EXECUTE format('UPDATE %I.%I SET %I = %s WHERE %I = $1 AND %I IS NOT NULL', p.schema, p.tab, p.col,
      CASE WHEN t IN ('text'::regtype, 'character varying'::regtype) THEN '''redacted'''
           WHEN t IN ('jsonb'::regtype, 'json'::regtype) THEN '''"redacted"'''
           ELSE 'NULL' END,
      p.who, p.col) USING redact.subject;
    GET DIAGNOSTICS n = ROW_COUNT;
    done := done + n;
  END LOOP;
  RETURN done;
END
$$;

CREATE SCHEMA vault;
CREATE TABLE vault.key (
    subject text NOT NULL,
    class text NOT NULL REFERENCES cella.retention,
    year integer NOT NULL,
    sealed bytea NOT NULL,
    restricted date,
    PRIMARY KEY (subject, class, year)
);
CREATE TABLE vault.secret (
    commitment bytea PRIMARY KEY CHECK (length(commitment) = 32),
    receipt bigint NOT NULL,
    subject text NOT NULL,
    class text NOT NULL,
    year integer NOT NULL,
    field text NOT NULL,
    salt bytea NOT NULL CHECK (length(salt) = 32),
    sealed bytea NOT NULL,
    FOREIGN KEY (subject, class, year) REFERENCES vault.key ON DELETE CASCADE
);
CREATE TABLE vault.erased (
    subject text NOT NULL,
    class text NOT NULL REFERENCES cella.retention,
    receipt bigint NOT NULL,
    date date NOT NULL,
    restricted boolean NOT NULL,
    PRIMARY KEY (subject, class)
);
CREATE TABLE vault.swept (
    subject text NOT NULL,
    class text NOT NULL,
    year integer NOT NULL,
    date date NOT NULL,
    PRIMARY KEY (subject, class, year)
);
REVOKE ALL ON cella.retention, cella.personal FROM PUBLIC;
GRANT SELECT ON cella.retention, cella.personal TO PUBLIC;
REVOKE ALL ON SCHEMA vault FROM PUBLIC;
REVOKE ALL ON vault.key, vault.secret, vault.erased, vault.swept FROM PUBLIC;
GRANT USAGE ON SCHEMA vault TO PUBLIC;
GRANT SELECT ON vault.erased TO PUBLIC;
REVOKE EXECUTE ON FUNCTION cella.redact(text, text), cella.personal_checked() FROM PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.personal', '');
SELECT pg_catalog.pg_extension_config_dump('vault.key', '');
SELECT pg_catalog.pg_extension_config_dump('vault.secret', '');
SELECT pg_catalog.pg_extension_config_dump('vault.erased', '');
SELECT pg_catalog.pg_extension_config_dump('vault.swept', '');
"#,
    name = "vault_tables",
    requires = ["notary_tables"],
);

/// Whether the notary is redacting personal data right now, the one
/// change a record that never changes takes: a feat's trigger that keeps a
/// row fixed lets it through. No role can set it.
#[pg_extern(stable)]
fn redacting() -> bool {
    vault::redacting()
}

/// An entry's payload as the log keeps it, each commitment opened: the
/// value the vault still holds, `restricted` for a class kept only by law,
/// `redacted` once erased. NULL for no such entry. The app may call it for
/// a read it has authorised.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn opened(n: i64) -> Option<JsonB> {
    vault::opened(n).map(JsonB)
}

/// Carries out what restricted erasures wait on once their legal clock
/// runs out on the verdict date: keys past their clock destroyed, and each
/// erasure whose clock has run out completed, its columns redacted. One row
/// per subject and class touched. A superuser's, run by `cella vault sweep`.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn vault_sweep() -> TableIterator<'static, (name!(subject, String), name!(class, String), name!(keys, i64), name!(redacted, bool))> {
    TableIterator::new(vault::sweep(&notary::iso(&notary::verdict_date())))
}
