//! The extension's whole SQL surface, in one place. Every type, function,
//! aggregate, operator, cast and table `cella` exposes is declared here and
//! nowhere else; each is a thin wrapper over `cella-guards` or the notary's
//! plumbing, so a second binding (`PGlite`, a future runtime) wraps this list.
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
//! | `cella.share(member, stance, receipt, num, den)` | aggregate | `Tally::share` |
//! | `cella.verdict_date()` | function | the transaction's verdict date |
//! | `cella.receipt()` | function | the transaction's receipt number |
//! | `cella.begin(op, actor, device)` | function | opens a write: the transaction may write the registered state tables and commits only with its verdict |
//! | `cella.submit(op, payload, actor, signed)` | function | checks the write was begun, the member's signature, that the payload restates the request where it carries the same field, the device and the nonce, runs the op's guards, signs the receipt and appends the verdict |
//! | `cella.action()`, `cella.actor()`, `cella.device()` | functions | the action being judged, for guards |
//! | `cella.verify_log()` | function | `log::Chain` over the whole log and its receipts, each under the signer that names it |
//! | `cella.signed(n, request)` | function, the owner's | `sign::request_digest`: whether a request is what receipt `n`'s member signed, under the salt it keeps |
//! | `cella.notary_key()` | function | the scope's public key, from `cella.key_file` |
//! | `cella.head`, `cella.log`, `cella.receipt`, `cella.receipt_seq` | tables, sequence | the log and its signed receipts |
//! | `cella.signer` | table | every key the notary has signed with, by id, and the first entry each signed |
//! | `cella.guard`, `cella.guard_text`, `cella.keyring`, `cella.power` | tables | the registries: guards per op, the keyring, the power each op needs |
//! | `cella.state`, `cella.notarise(tab)`, `cella.notarised()` | table, function, trigger | the registered state tables, each refusing a row no begun transaction writes |
//! | `cella.retention`, `cella.personal` | tables | the retention classes and their clocks; the columns holding personal data, each feat's own |
//! | `cella.redact(subject, class)` | function, the owner's | redacts a subject's columns of a class in the read models |
//! | `vault.key`, `vault.secret`, `vault.erased`, `vault.swept` | tables, the owner's but `erased` | sealed keys, the salts and sealed values that open commitments, erasures, sweeps |
//! | `cella.opened(n)` | function | an entry's logged payload, its commitments opened from the vault |
//! | `cella.redacting()` | function | whether the notary is redacting, for a feat's trigger that keeps a row fixed |
//! | `cella.vault_sweep()` | function, a superuser's | restricted data erased once its clock runs out |
//! | `cella.vault_rewrap()` | function, a superuser's | every vault key sealed under the current wrap key, those under the previous one moved |
//! | `cella.vault_reerase(erasures)` | function, a superuser's | each erasure of a backup's list the restored vault lacks, carried out again |

use crate::{notary, vault};
use cella_guards::{Amount as Cents, Tally};
use pgrx::prelude::*;
use pgrx::{InOutFuncs, JsonB, StringInfo};
use serde::{Deserialize, Serialize};
use std::ffi::CStr;

fn refuse(e: &cella_guards::Error) -> ! {
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

    fn primitive(self) -> Cents {
        Cents::new(self.cents).unwrap_or_else(|e| refuse(&e))
    }
}

impl InOutFuncs for Amount {
    fn input(input: &CStr) -> Self {
        let a = Cents::parse(input.to_str().unwrap_or("")).unwrap_or_else(|e| refuse(&e));
        Self { cents: a.cents() }
    }

    fn output(&self, buffer: &mut StringInfo) {
        buffer.push_str(&self.primitive().to_string());
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
    let sum = a.primitive().checked_add(b.primitive()).unwrap_or_else(|e| refuse(&e));
    Amount { cents: sum.cents() }
}

#[pg_extern(immutable, parallel_safe)]
fn allocate(total: Amount, weights: Vec<i64>) -> Vec<i64> {
    cella_guards::allocate(total.primitive(), &weights).unwrap_or_else(|e| refuse(&e))
}

#[pg_extern(immutable, parallel_safe, name = "digest")]
fn digest_text(text: &str) -> Vec<u8> {
    cella_guards::digest(text.as_bytes()).to_vec()
}

#[pg_extern(immutable, parallel_safe, name = "digest")]
fn digest_bytes(bytes: &[u8]) -> Vec<u8> {
    cella_guards::digest(bytes).to_vec()
}

// Documents: the canonical JSON of a Loro snapshot's block tree, its
// BLAKE3, and its plain text. Deterministic for a pinned `loro`, so a
// generated column may hold them.

#[pg_extern(immutable, parallel_safe)]
fn document_canonical(snapshot: &[u8]) -> String {
    cella_guards::document::canonical(snapshot).unwrap_or_else(|e| refuse(&e))
}

#[pg_extern(immutable, parallel_safe)]
fn document_hash(snapshot: &[u8]) -> Vec<u8> {
    cella_guards::document::hash(snapshot).unwrap_or_else(|e| refuse(&e)).to_vec()
}

#[pg_extern(immutable, parallel_safe)]
fn document_text(snapshot: &[u8]) -> String {
    cella_guards::document::plain(snapshot).unwrap_or_else(|e| refuse(&e))
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

// A share of the votes cast, the fraction given with each row: the
// procedure's, the same on every row of a motion. With no rows no one
// is for, so the fold fails before the fraction is needed.
#[derive(Clone, Default, Debug, Serialize, Deserialize, PostgresType)]
pub struct Shares {
    votes: Votes,
    of: Option<(i64, i64)>,
}

#[derive(AggregateName)]
#[aggregate_name = "share"]
pub struct Share;

#[pg_aggregate]
impl Aggregate<Share> for Share {
    type State = Shares;
    type Args = (
        name!(member, String),
        name!(stance, String),
        name!(receipt, i64),
        name!(num, i64),
        name!(den, i64),
    );
    type Finalize = bool;
    const INITIAL_CONDITION: Option<&'static str> = Some(r#"{"votes":{"rows":[]},"of":null}"#);

    #[pgrx(immutable, parallel_safe)]
    fn state(mut current: Self::State, (member, stance, receipt, num, den): Self::Args, _: pg_sys::FunctionCallInfo) -> Self::State {
        if current.of.is_some_and(|of| of != (num, den)) {
            ereport!(ERROR, PgSqlErrorCode::ERRCODE_DATA_EXCEPTION, "a share of the votes is one fraction for every stance");
        }
        current.of = Some((num, den));
        current.votes.rows.push((member, stance, receipt));
        current
    }

    #[pgrx(immutable, parallel_safe)]
    fn finalize(current: Self::State, _: Self::OrderedSetArgs, _: pg_sys::FunctionCallInfo) -> Self::Finalize {
        match current.of {
            Some((num, den)) => current.votes.tally().share(num, den).unwrap_or_else(|e| refuse(&e)),
            None => false,
        }
    }
}

// The notary: the log, numbered from a locked head row, each entry naming
// its signed receipt; the guard registry, whose guards submit runs for an op,
// each returning NULL to accept or a reason to refuse; the keyring, the one
// function that says whether a device is an actor's current key; and the
// power each op needs, which a graft's guard reads. Only these functions
// write the log and the receipts; migrations register; everyone reads.
// The head row is made by the first write, not here, so a dump of the
// head restores into a fresh install; every key the notary signed with is
// kept in `cella.signer`, and each receipt and entry names its own. A
// receipt keeps the salt of the request its member signed, outside its
// hash, which holds the salted digest already; the salt is the owner's, as
// everyone else could confirm a guess of the request with it.

extension_sql!(
    r"
CREATE TABLE cella.head (
    one boolean PRIMARY KEY DEFAULT true CHECK (one),
    n bigint NOT NULL,
    hash bytea NOT NULL
);
CREATE TABLE cella.signer (
    id integer PRIMARY KEY CHECK (id > 0),
    public bytea NOT NULL UNIQUE CHECK (length(public) = 32),
    since bigint NOT NULL UNIQUE CHECK (since > 0)
);
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
    UNIQUE (device, nonce),
    key integer NOT NULL REFERENCES cella.signer,
    salt text
);
CREATE TABLE cella.log (
    n bigint PRIMARY KEY,
    op text NOT NULL,
    actor text NOT NULL,
    date date NOT NULL,
    payload bytea NOT NULL,
    form jsonb NOT NULL,
    receipt bigint NOT NULL UNIQUE REFERENCES cella.receipt,
    guards jsonb NOT NULL,
    prev bytea NOT NULL,
    hash bytea NOT NULL,
    sig bytea NOT NULL,
    key integer NOT NULL REFERENCES cella.signer
);
CREATE TABLE cella.guard (
    op text NOT NULL,
    fn regprocedure NOT NULL,
    owner text NOT NULL,
    PRIMARY KEY (op, fn)
);
CREATE TABLE cella.guard_text (
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
REVOKE ALL ON cella.head, cella.signer, cella.log, cella.receipt, cella.guard, cella.guard_text, cella.keyring, cella.power, cella.receipt_seq FROM PUBLIC;
GRANT SELECT ON cella.head, cella.signer, cella.log, cella.guard, cella.guard_text, cella.keyring, cella.power TO PUBLIC;
GRANT SELECT (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key) ON cella.receipt TO PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.head', '');
SELECT pg_catalog.pg_extension_config_dump('cella.signer', '');
SELECT pg_catalog.pg_extension_config_dump('cella.log', '');
SELECT pg_catalog.pg_extension_config_dump('cella.receipt', '');
SELECT pg_catalog.pg_extension_config_dump('cella.guard', '');
SELECT pg_catalog.pg_extension_config_dump('cella.guard_text', '');
SELECT pg_catalog.pg_extension_config_dump('cella.keyring', '');
SELECT pg_catalog.pg_extension_config_dump('cella.power', '');
SELECT pg_catalog.pg_extension_config_dump('cella.receipt_seq', '');
",
    name = "notary_tables",
    bootstrap,
);

/// The transaction's verdict date: fixed at its first use, by `submit` or
/// by a write before it, and recorded in the log. Guards read this, never
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

/// Checks the member's signature on the request, that the payload restates
/// the request wherever it carries the same field, that the device is the
/// actor's current key and that its nonce is new, then runs the op's guards,
/// signs the receipt, keeping the request's salt, and appends a numbered,
/// signed verdict naming it. Call it last in the handler's transaction.
/// `signed` is `{request, device, salt, nonce, sig}`, bytes in hex. A refusal raises SQLSTATE 09000 with its
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

/// Opens a write, after `BEGIN` and before its state: the op, the member it
/// is for and the device that signs it. Until it commits, the transaction
/// may write the registered state tables; it commits only with the verdict
/// `submit` appends for the same op, actor and device, and a savepoint
/// rolled back past it undoes it. One per transaction.
#[pg_extern(volatile)]
fn begin(op: &str, actor: &str, device: &[u8]) {
    notary::begin(op, actor, device);
}

/// The notary's trigger on every registered state table, row by row and
/// on a truncate: refuses a change no begun transaction makes, unless the
/// notary is redacting or a superuser set `cella.unbound`.
#[pg_trigger]
fn notarised<'a>(trigger: &'a PgTrigger<'a>) -> Result<Option<PgHeapTuple<'a, AllocatedByPostgres>>, PgTriggerError> {
    notary::notarised(&format!("{}.{}", trigger.table_schema()?, trigger.table_name()?));
    Ok(None)
}

// The registered state tables: every table whose rows only a write may
// change, each with the notary's trigger, installed by `cella.notarise`,
// which a superuser runs; the org core runs it on every table a feat or a
// graft makes. A table is named, not referenced by oid, so a dump keeps it.

extension_sql!(
    r"
CREATE TABLE cella.state (
    schema text NOT NULL,
    tab text NOT NULL,
    PRIMARY KEY (schema, tab)
);
CREATE FUNCTION cella.notarise(tab regclass) RETURNS boolean LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO cella.state (schema, tab)
  SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = notarise.tab
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  -- A partition takes its row trigger from its table, registered before
  -- or after it.
  IF NOT (SELECT c.relispartition FROM pg_class c WHERE c.oid = notarise.tab) THEN
    EXECUTE format('CREATE CONSTRAINT TRIGGER notarised AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION cella.notarised()', notarise.tab);
  END IF;
  EXECUTE format('CREATE TRIGGER notarised_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION cella.notarised()', notarise.tab);
  RETURN true;
END
$$;
REVOKE ALL ON cella.state FROM PUBLIC;
GRANT SELECT ON cella.state TO PUBLIC;
REVOKE EXECUTE ON FUNCTION cella.notarise(regclass) FROM PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.state', '');
",
    name = "state_tables",
    requires = ["notary_tables", notarised],
);

/// The id of the action `submit` is judging; NULL outside it.
#[pg_extern(stable)]
fn action() -> Option<String> {
    notary::action()
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
/// against the key in office at its entry, as `cella.signer` keeps it, and
/// that the head names the last entry. The key file is not read: a log
/// verifies after its key is rotated or lost.
#[pg_extern(stable, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn verify_log() -> bool {
    notary::verify_log()
}

/// Whether `request` is what receipt `n`'s member signed: salted with the
/// salt the receipt keeps, its digest is the one their signature names.
/// NULL for no such receipt, or one taken before 0.3.0, which kept no
/// salt. The owner's, since it would confirm a guess of a request.
#[pg_extern(stable, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn signed(n: i64, request: JsonB) -> Option<bool> {
    notary::was_signed(n, &request.0)
}

extension_sql!(
    r"
REVOKE EXECUTE ON FUNCTION cella.signed(bigint, jsonb) FROM PUBLIC;
",
    name = "signed_owner",
    requires = [signed],
);

/// The public key of `cella.key_file`, which signs the next entry.
#[pg_extern(stable, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn notary_key() -> Vec<u8> {
    notary::public_key().to_vec()
}

// Personal data: the retention classes and their clocks, which columns
// hold personal data and of whom, each feat registering its own; and the
// vault, which only these functions write: each subject's keys per class
// and year, sealed under the wrap key derived from the vault's own key
// file, never the notary's, the salts
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
  ('profile', 0, false, 'none: erased when asked (GDPR art. 17)'),
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
    receipt bigint,
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
    TableIterator::new(vault::sweep(&notary::iso(notary::verdict_date())))
}

/// Seals every vault key under the wrap key of `cella.vault_key_file`:
/// each one that opens only under `cella.vault_key_previous` is opened with
/// it and sealed again. Returns how many moved; then the previous file may
/// be destroyed. A superuser's, run by `cella vault rewrap`.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn vault_rewrap() -> i64 {
    vault::rewrap()
}

extension_sql!(
    r"
REVOKE EXECUTE ON FUNCTION cella.vault_rewrap() FROM PUBLIC;
",
    name = "vault_rewrap_owner",
    requires = [vault_rewrap],
);

/// Carries out again each erasure of a list, as `cella backup` writes it,
/// that the vault holds no tombstone for, or holds still restricted where
/// the list's was carried out in full: as the erasure did, under its date,
/// its tombstone naming no entry. Returns how many it carried out; run
/// again, none. A superuser's, run by `cella restore` before the database
/// opens to the app.
#[pg_extern(volatile, security_definer)]
#[search_path(pg_catalog, pg_temp)]
fn vault_reerase(erasures: JsonB) -> i64 {
    vault::reerase(&erasures.0)
}

extension_sql!(
    r"
REVOKE EXECUTE ON FUNCTION cella.vault_reerase(jsonb) FROM PUBLIC;
",
    name = "vault_reerase_owner",
    requires = [vault_reerase],
);
