//! The plumbing behind `submit` and `verify_log`: the head lock, the
//! registries, the key file, the receipts and the log rows, reached through
//! SPI. Hashing, signing and every signature check are `cella_rules`'s;
//! whether a device is current is the keyring's, and whether a write may
//! pass is its rules', both in SQL.

use crate::vault;
use crate::{CLOCK, KEY_FILE, SCOPE};
use cella_rules::hex::{hex, unhex};
use cella_rules::log::{self, Chain, Entry, Key, Receipt, Rule};
use cella_rules::sign::{self, Request};
use pgrx::prelude::*;
use pgrx::spi::SpiClient;
use pgrx::{JsonB, PgXactCallbackEvent, register_xact_callback};
use serde_json::{Value, json};
use std::cell::RefCell;

thread_local! {
    static DATE: RefCell<Option<(i32, u8, u8)>> = const { RefCell::new(None) };
    static KEY: RefCell<Option<(String, Key, [u8; 32])>> = const { RefCell::new(None) };
    static RECEIPT: RefCell<Option<(i64, String)>> = const { RefCell::new(None) };
    static WRITE: RefCell<Option<Context>> = const { RefCell::new(None) };
}

pub(crate) fn fail(msg: impl Into<String>) -> ! {
    ereport!(ERROR, PgSqlErrorCode::ERRCODE_INTERNAL_ERROR, msg.into());
}

/// A refusal: SQLSTATE 09000, which the handler maps to `Refused`.
pub(crate) fn refuse(reason: impl Into<String>, detail: impl Into<String>) -> ! {
    ereport!(ERROR, PgSqlErrorCode::ERRCODE_TRIGGERED_ACTION_EXCEPTION, reason.into(), detail.into());
}

pub(crate) fn spi<T>(r: Result<T, pgrx::spi::Error>) -> T {
    r.unwrap_or_else(|e| fail(format!("cella: {e}")))
}

/// The first column of the first row, or `None` when there is no row: a
/// rule whose query finds nothing accepts.
pub(crate) fn first<T: pgrx::datum::FromDatum + pgrx::datum::IntoDatum>(rows: pgrx::spi::SpiTupleTable<'_>) -> Option<T> {
    if rows.is_empty() {
        return None;
    }
    spi(rows.first().get_one::<T>())
}

fn setting(guc: &pgrx::guc::GucSetting<Option<std::ffi::CString>>) -> Option<String> {
    guc.get().and_then(|c| c.to_str().ok().map(str::to_string)).filter(|c| !c.is_empty())
}

pub fn verdict_date() -> pgrx::datum::Date {
    let (y, m, d) = DATE.with(|cell| {
        if let Some(date) = *cell.borrow() {
            return date;
        }
        let date: Option<pgrx::datum::Date> = spi(match setting(&CLOCK) {
            Some(c) => Spi::get_one_with_args("SELECT $1::date", &[c.into()]),
            None => Spi::get_one("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date"),
        });
        let date = date.unwrap_or_else(|| fail("cella: no verdict date"));
        let fixed = (date.year(), date.month(), date.day());
        *cell.borrow_mut() = Some(fixed);
        register_xact_callback(PgXactCallbackEvent::Commit, forget_date);
        register_xact_callback(PgXactCallbackEvent::Abort, forget_date);
        fixed
    });
    pgrx::datum::Date::new(y, m, d).unwrap_or_else(|e| fail(format!("cella: {e}")))
}

fn forget_date() {
    DATE.with(|c| c.borrow_mut().take());
}

pub(crate) fn iso(d: pgrx::datum::Date) -> String {
    format!("{:04}-{:02}-{:02}", d.year(), d.month(), d.day())
}

fn scope() -> String {
    setting(&SCOPE).unwrap_or_else(|| fail("cella.scope is not set: the scope's address, which every signature names"))
}

/// The scope's signing key and the key that seals the vault's keys, both
/// from the seed in the key file.
fn with_keys<T>(f: impl FnOnce(&Key, &[u8; 32]) -> T) -> T {
    let path = setting(&KEY_FILE).unwrap_or_else(|| fail("cella.key_file is not set"));
    KEY.with(|cell| {
        let stale = cell.borrow().as_ref().is_none_or(|(p, _, _)| *p != path);
        if stale {
            let seed = std::fs::read(&path).unwrap_or_else(|e| fail(format!("cella.key_file {path}: {e}")));
            let key = Key::from_seed(&seed).unwrap_or_else(|e| fail(format!("cella.key_file {path}: {e}")));
            *cell.borrow_mut() = Some((path, key, cella_rules::vault::wrap_key(&seed)));
        }
        let held = cell.borrow();
        let (_, key, wrap) = held.as_ref().expect("key loaded");
        f(key, wrap)
    })
}

fn with_key<T>(f: impl FnOnce(&Key) -> T) -> T {
    with_keys(|k, _| f(k))
}

pub(crate) fn wrap_key() -> [u8; 32] {
    with_keys(|_, w| *w)
}

pub fn public_key() -> [u8; 32] {
    with_key(Key::public)
}

/// The transaction's receipt: one write, one receipt, taken at its first
/// use and signed by `submit`. A write that rolls back leaves a gap in the
/// numbers, never in the log.
fn taken() -> (i64, String) {
    RECEIPT.with(|cell| {
        let held = cell.borrow().clone();
        if let Some(r) = held {
            return r;
        }
        let (n, at) = spi(Spi::get_two::<i64, String>(
            "SELECT nextval('cella.receipt_seq'),
                    to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
        ));
        let r = (n.unwrap_or_else(|| fail("cella: no receipt")), at.unwrap_or_else(|| fail("cella: no receipt time")));
        *cell.borrow_mut() = Some(r.clone());
        register_xact_callback(PgXactCallbackEvent::Commit, forget_receipt);
        register_xact_callback(PgXactCallbackEvent::Abort, forget_receipt);
        r
    })
}

fn forget_receipt() {
    RECEIPT.with(|c| c.borrow_mut().take());
}

pub fn receipt() -> i64 {
    taken().0
}

/// The write `submit` is judging, for the rules to read through
/// `cella.op()`, `cella.actor()` and `cella.device()`.
#[derive(Clone)]
struct Context {
    op: String,
    actor: String,
    device: [u8; 32],
}

/// Holds the context while a write is judged, and clears it on return and
/// on unwind.
struct During;

impl During {
    fn enter(ctx: Context) -> Self {
        WRITE.with(|c| *c.borrow_mut() = Some(ctx));
        Self
    }
}

impl Drop for During {
    fn drop(&mut self) {
        WRITE.with(|c| c.borrow_mut().take());
    }
}

fn context() -> Option<Context> {
    WRITE.with(|c| c.borrow().clone())
}

pub fn op() -> Option<String> {
    context().map(|c| c.op)
}

pub fn actor() -> Option<String> {
    context().map(|c| c.actor)
}

pub fn device() -> Option<Vec<u8>> {
    context().map(|c| c.device.to_vec())
}

struct Registered {
    owner: String,
    function: String,
    call: String,
    body: String,
}

fn rules(c: &SpiClient<'_>, op: &str) -> Vec<Registered> {
    let rows = spi(c.select(
        "SELECT r.owner, r.fn::text, quote_ident(n.nspname) || '.' || quote_ident(p.proname),
                pg_get_functiondef(r.fn), p.provolatile = 'v',
                p.prorettype = 'text'::regtype AND p.proargtypes = '3802'::oidvector,
                p.prosecdef
         FROM cella.rule r
         JOIN pg_proc p ON p.oid = r.fn
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE r.op = $1
         ORDER BY r.owner, r.fn::text",
        None,
        &[op.into()],
    ));
    rows.map(|row| {
        let text = |i| spi(row.get::<String>(i)).unwrap_or_default();
        let function = text(2);
        if spi(row.get::<bool>(5)) != Some(false) {
            fail(format!("cella: rule {function} is volatile; a rule is stable or immutable"));
        }
        if spi(row.get::<bool>(6)) != Some(true) {
            fail(format!("cella: rule {function} must take (payload jsonb) and return text"));
        }
        if spi(row.get::<bool>(7)) != Some(false) {
            fail(format!("cella: rule {function} is security definer; a rule runs as {RULES_ROLE}"));
        }
        Registered { owner: text(1), function, call: text(3), body: text(4) }
    })
    .collect()
}

/// The function that says whether a device is a current key of an actor:
/// `(actor text, device bytea) → text`, NULL when it is and a reason when
/// not. One feat registers it in `cella.keyring`; it runs as the rules do.
fn keyring(c: &SpiClient<'_>) -> String {
    let rows = spi(c.select(
        "SELECT k.fn::text, quote_ident(n.nspname) || '.' || quote_ident(p.proname), p.provolatile = 'v',
                p.prorettype = 'text'::regtype AND p.proargtypes = '25 17'::oidvector, p.prosecdef
         FROM cella.keyring k
         JOIN pg_proc p ON p.oid = k.fn
         JOIN pg_namespace n ON n.oid = p.pronamespace",
        Some(1),
        &[],
    ));
    if rows.is_empty() {
        fail("cella: no keyring is registered, so no signature can name a current device");
    }
    let row = rows.first();
    let function = spi(row.get::<String>(1)).unwrap_or_default();
    let shaped = spi(row.get::<bool>(3)) == Some(false) && spi(row.get::<bool>(4)) == Some(true) && spi(row.get::<bool>(5)) == Some(false);
    if !shaped {
        fail(format!("cella: keyring {function} must be a stable (actor text, device bytea) → text, not security definer"));
    }
    spi(row.get::<String>(2)).unwrap_or_default()
}

/// The role every rule runs as: it may read the scope's schemas and
/// nothing else, and owns nothing.
const RULES_ROLE: &str = "cella_rules";

fn rules_role(c: &SpiClient<'_>) -> pg_sys::Oid {
    let row = spi(c.select(
        "SELECT oid FROM pg_catalog.pg_roles WHERE rolname = $1 AND NOT rolsuper AND NOT rolbypassrls",
        Some(1),
        &[RULES_ROLE.into()],
    ));
    spi(row.first().get_one::<pg_sys::Oid>())
        .unwrap_or_else(|| fail(format!("cella: no role {RULES_ROLE}, or it is a superuser or bypasses row security")))
}

/// Runs a rule as the rules role, in a security-restricted operation, as
/// Postgres runs a security-definer function or a maintenance command:
/// `submit` is a security-definer function, where `SET ROLE` is refused.
/// The previous user is restored on return and on unwind; an abort
/// restores it too.
struct AsRules {
    user: pg_sys::Oid,
    context: i32,
}

impl AsRules {
    fn enter(role: pg_sys::Oid) -> Self {
        let mut user = pg_sys::InvalidOid;
        let mut context = 0;
        let restricted = (pg_sys::SECURITY_LOCAL_USERID_CHANGE | pg_sys::SECURITY_RESTRICTED_OPERATION).cast_signed();
        // SAFETY: plain reads and writes of the backend's user id and
        // security context, with no error path.
        unsafe {
            pg_sys::GetUserIdAndSecContext(&raw mut user, &raw mut context);
            pg_sys::SetUserIdAndSecContext(role, context | restricted);
        }
        Self { user, context }
    }
}

impl Drop for AsRules {
    fn drop(&mut self) {
        // SAFETY: restores what `enter` read.
        unsafe { pg_sys::SetUserIdAndSecContext(self.user, self.context) }
    }
}

/// The signed envelope a handler passes with each write: the request the
/// member signed and the device's signature on it.
struct Signed {
    request: Value,
    device: [u8; 32],
    salt: String,
    nonce: String,
    sig: [u8; 64],
}

fn signed(v: &Value) -> Option<Signed> {
    let bytes = |k: &str| unhex(v.get(k)?.as_str()?);
    Some(Signed {
        request: v.get("request")?.clone(),
        device: bytes("device")?.try_into().ok()?,
        salt: v.get("salt")?.as_str()?.to_string(),
        nonce: v.get("nonce")?.as_str()?.to_string(),
        sig: bytes("sig")?.try_into().ok()?,
    })
}

pub fn submit(op: &str, payload: &JsonB, actor: &str, envelope: &JsonB) -> i64 {
    let at_ingress = || format!("{op} refused at ingress, before any rule");
    let Some(s) = signed(&envelope.0) else {
        refuse(format!("{op} is not signed: a write carries its request, device, salt, nonce and sig in hex"), at_ingress());
    };
    let scope = scope();
    let request = sign::request_digest(&s.request, &s.salt).unwrap_or_else(|e| refuse(format!("the request: {e}"), at_ingress()));
    let asked = Request { scope: &scope, op, actor, device: s.device, digest: request, nonce: &s.nonce };
    if let Err(e) = asked.verify(&s.sig) {
        refuse(format!("{e}: {op} by {actor} from device {}", &hex(&s.device)[..16]), at_ingress());
    }
    let date = iso(verdict_date());
    Spi::connect_mut(|c| {
        let head = spi(c.update("SELECT n, hash FROM cella.head FOR UPDATE", Some(1), &[]));
        let (n, prev) = spi(head.first().get_two::<i64, Vec<u8>>());
        let n = n.unwrap_or_else(|| fail("cella: no head")) + 1;
        let prev: [u8; 32] = prev
            .and_then(|p| p.try_into().ok())
            .unwrap_or_else(|| fail("cella: the head's hash is not 32 bytes"));
        let after = |by: &str| format!("{op} refused by {by} after verdict {}", n - 1);

        let role = rules_role(c);
        let _during = During::enter(Context { op: op.into(), actor: actor.into(), device: s.device });

        // Under the head lock, so a revocation or a use of the same nonce
        // that committed first is seen.
        let current = keyring(c);
        let why = {
            let _as = AsRules::enter(role);
            let rows = spi(c.select(&format!("SELECT {current}($1, $2)"), Some(1), &[actor.into(), s.device.to_vec().into()]));
            first::<String>(rows)
        };
        if let Some(why) = why {
            refuse(why, after("the keyring"));
        }
        let used = spi(c.select(
            "SELECT n FROM cella.receipt WHERE device = $1 AND nonce = $2",
            Some(1),
            &[s.device.to_vec().into(), s.nonce.clone().into()],
        ));
        if let Some(earlier) = first::<i64>(used) {
            refuse(format!("nonce {} was already counted, at receipt {earlier}: a signature counts once", s.nonce), after("the notary"));
        }

        // Personal values out of the payload, under the head's lock, so an
        // erasure that settled first is seen: what the log keeps, and what
        // the rules judge, holds commitments in their place.
        let (number, time) = taken();
        let form = vault::logged(c, &payload.0, number, &date);
        let digest = log::payload_digest(&form).unwrap_or_else(|e| fail(format!("cella: payload: {e}")));

        let registered = rules(c, op);
        for r in &registered {
            let arg = JsonB(form.clone());
            let reason = {
                let _as = AsRules::enter(role);
                let rows = spi(c.select(&format!("SELECT {}($1)", r.call), Some(1), &[arg.into()]));
                first::<String>(rows)
            };
            if let Some(reason) = reason {
                refuse(reason, after(&format!("{} ({})", r.function, r.owner)));
            }
        }

        let receipt = Receipt {
            n: number,
            op: op.into(),
            actor: actor.into(),
            device: s.device,
            nonce: s.nonce.clone(),
            request,
            signature: s.sig,
            payload: digest,
            time,
        };
        let receipt_hash = receipt.hash();
        let receipt_sig = with_key(|k| k.sign(&receipt_hash));
        spi(c.update(
            "INSERT INTO cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            None,
            &[
                number.into(),
                op.into(),
                actor.into(),
                s.device.to_vec().into(),
                s.nonce.clone().into(),
                request.to_vec().into(),
                s.sig.to_vec().into(),
                digest.to_vec().into(),
                receipt.time.clone().into(),
                receipt_hash.to_vec().into(),
                receipt_sig.to_vec().into(),
            ],
        ));

        let rules: Vec<Rule> = registered
            .iter()
            .map(|r| Rule { owner: r.owner.clone(), function: r.function.clone(), text: log::rule_digest(&r.body) })
            .collect();
        let entry = Entry { n, op: op.into(), actor: actor.into(), date: date.clone(), payload: digest, receipt: number, receipt_hash, rules };
        let hash = log::hash(&prev, &entry).unwrap_or_else(|e| fail(format!("cella: {e}")));
        let sig = with_key(|k| k.sign(&hash));

        for (r, rule) in registered.iter().zip(&entry.rules) {
            spi(c.update(
                "INSERT INTO cella.rule_text (hash, fn, body) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                None,
                &[rule.text.to_vec().into(), r.function.clone().into(), r.body.clone().into()],
            ));
        }
        let listed: Vec<Value> = entry
            .rules
            .iter()
            .map(|r| json!({ "owner": r.owner, "function": r.function, "text": hex(&r.text) }))
            .collect();
        spi(c.update(
            "INSERT INTO cella.log (n, op, actor, date, payload, form, receipt, rules, prev, hash, sig)
             VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11)",
            None,
            &[
                n.into(),
                op.into(),
                actor.into(),
                date.into(),
                digest.to_vec().into(),
                JsonB(form).into(),
                number.into(),
                JsonB(Value::Array(listed)).into(),
                prev.to_vec().into(),
                hash.to_vec().into(),
                sig.to_vec().into(),
            ],
        ));
        spi(c.update("UPDATE cella.head SET n = $1, hash = $2", None, &[n.into(), hash.to_vec().into()]));
        n
    })
}

fn listed_rules(v: &Value) -> Option<Vec<Rule>> {
    v.as_array()?
        .iter()
        .map(|r| {
            Some(Rule {
                owner: r.get("owner")?.as_str()?.to_string(),
                function: r.get("function")?.as_str()?.to_string(),
                text: unhex(r.get("text")?.as_str()?)?.try_into().ok()?,
            })
        })
        .collect()
}

pub fn verify_log() -> bool {
    let scope = scope();
    let mut chain = Chain::new(&public_key()).unwrap_or_else(|e| fail(format!("cella: {e}")));
    Spi::connect(|c| {
        let rows = spi(c.select(
            "SELECT l.n, l.op, l.actor, to_char(l.date, 'YYYY-MM-DD'), l.payload, l.rules, l.prev, l.hash, l.sig, l.receipt,
                    r.op, r.actor, r.device, r.nonce, r.request, r.signature, r.payload, r.at, r.hash, r.sig, l.form
             FROM cella.log l LEFT JOIN cella.receipt r ON r.n = l.receipt
             ORDER BY l.n",
            None,
            &[],
        ));
        let mut last = log::GENESIS.to_vec();
        for row in rows {
            let n = spi(row.get::<i64>(1)).unwrap_or_default();
            let text = |i| spi(row.get::<String>(i)).unwrap_or_default();
            let bytes = |i| spi(row.get::<Vec<u8>>(i)).unwrap_or_default();
            let rules = spi(row.get::<JsonB>(6)).and_then(|j| listed_rules(&j.0));
            let receipt = (|| {
                Some(Receipt {
                    n: spi(row.get::<i64>(10))?,
                    op: spi(row.get::<String>(11))?,
                    actor: spi(row.get::<String>(12))?,
                    device: bytes(13).try_into().ok()?,
                    nonce: spi(row.get::<String>(14))?,
                    request: bytes(15).try_into().ok()?,
                    signature: bytes(16).try_into().ok()?,
                    payload: bytes(17).try_into().ok()?,
                    time: spi(row.get::<String>(18))?,
                })
            })();
            let receipt_hash: Option<[u8; 32]> = bytes(19).try_into().ok();
            let (Some(payload), Some(rules), Some(receipt), Some(receipt_hash)) = (bytes(5).try_into().ok(), rules, receipt, receipt_hash)
            else {
                warning!("cella: log broken at {n}: unreadable entry, or no receipt");
                return false;
            };
            // What the log keeps of the payload, commitments in place of
            // personal values, is what its digest names; erasure deletes
            // what a commitment opens to, never the commitment.
            let form = spi(row.get::<JsonB>(21)).map(|j| j.0);
            if form.and_then(|f| log::payload_digest(&f).ok()) != Some(payload) {
                warning!("cella: log broken at {n}: the logged payload does not hash to the entry's digest");
                return false;
            }
            let entry = Entry {
                n,
                op: text(2),
                actor: text(3),
                date: text(4),
                payload,
                receipt: receipt.n,
                receipt_hash,
                rules,
            };
            if let Err(b) = chain.check_receipt(&scope, &entry, &receipt, &receipt_hash, &bytes(20)) {
                warning!("cella: log broken at {}: {}", b.n, b.why);
                return false;
            }
            let hash = bytes(8);
            if let Err(b) = chain.check(&entry, &bytes(7), &hash, &bytes(9)) {
                warning!("cella: log broken at {}: {}", b.n, b.why);
                return false;
            }
            last = hash;
        }
        let head = spi(spi(c.select("SELECT n, hash FROM cella.head", Some(1), &[])).first().get_two::<i64, Vec<u8>>());
        if head != (Some(chain.len()), Some(last)) {
            warning!("cella: the head does not name the log's last entry");
            return false;
        }
        let receipts = spi(spi(c.select("SELECT count(*) FROM cella.receipt", Some(1), &[])).first().get_one::<i64>());
        if receipts != Some(chain.len()) {
            warning!("cella: a receipt names no verdict");
            return false;
        }
        true
    })
}
