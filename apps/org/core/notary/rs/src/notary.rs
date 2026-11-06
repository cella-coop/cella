//! The plumbing behind `submit` and `verify_log`: the head lock, the
//! registries, the key file, the receipts and the log rows, reached through
//! SPI. Hashing, signing and every signature check are `cella_guards`'s;
//! whether a device is current is the keyring's, and whether a write may
//! pass is its guards', both in SQL.

use crate::vault;
use crate::{CLOCK, KEY_FILE, SCOPE, TIMEZONE, UNBOUND};
use cella_guards::hex::{hex, unhex};
use cella_guards::log::{self, Basis, Chain, DEEPEST, Entry, Follows, Guard, Key, Receipt, Signer, Unfollowed, Written};
use cella_guards::sign::{self, Request};
use pgrx::prelude::*;
use pgrx::spi::SpiClient;
use pgrx::{JsonB, PgSubXactCallbackEvent, PgXactCallbackEvent, register_subxact_callback, register_xact_callback};
use serde_json::{Value, json};
use std::cell::RefCell;

thread_local! {
    static DATE: RefCell<Option<(i32, u8, u8)>> = const { RefCell::new(None) };
    static KEY: RefCell<Option<(String, Key)>> = const { RefCell::new(None) };
    static RECEIPT: RefCell<Option<(i64, String)>> = const { RefCell::new(None) };
    static WRITE: RefCell<Option<Context>> = const { RefCell::new(None) };
    static WRITTEN: RefCell<Vec<(Written, pg_sys::SubTransactionId)>> = const { RefCell::new(Vec::new()) };
    static FOLLOWS: RefCell<Vec<Follows>> = const { RefCell::new(Vec::new()) };
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
/// guard whose query finds nothing accepts.
pub(crate) fn first<T: pgrx::datum::FromDatum + pgrx::datum::IntoDatum>(rows: pgrx::spi::SpiTupleTable<'_>) -> Option<T> {
    if rows.is_empty() {
        return None;
    }
    spi(rows.first().get_one::<T>())
}

pub(crate) fn setting(guc: &pgrx::guc::GucSetting<Option<std::ffi::CString>>) -> Option<String> {
    guc.get().and_then(|c| c.to_str().ok().map(str::to_string)).filter(|c| !c.is_empty())
}

pub fn verdict_date() -> pgrx::datum::Date {
    let (y, m, d) = DATE.with(|cell| {
        if let Some(date) = *cell.borrow() {
            return date;
        }
        let date: Option<pgrx::datum::Date> = spi(match setting(&CLOCK) {
            Some(c) => Spi::get_one_with_args("SELECT $1::date", &[c.into()]),
            None => Spi::get_one_with_args(
                "SELECT (clock_timestamp() AT TIME ZONE $1)::date",
                &[setting(&TIMEZONE).unwrap_or_else(|| "UTC".into()).into()],
            ),
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

/// The scope's signing key, from the seed in the key file. The vault's
/// wrap key comes from a file of its own (`vault::wrap`).
fn with_key<T>(f: impl FnOnce(&Key) -> T) -> T {
    let path = setting(&KEY_FILE).unwrap_or_else(|| fail("cella.key_file is not set"));
    KEY.with(|cell| {
        let stale = cell.borrow().as_ref().is_none_or(|(p, _)| *p != path);
        if stale {
            let seed = std::fs::read(&path).unwrap_or_else(|e| fail(format!("cella.key_file {path}: {e}")));
            let key = Key::from_seed(&seed).unwrap_or_else(|e| fail(format!("cella.key_file {path}: {e}")));
            *cell.borrow_mut() = Some((path, key));
        }
        let held = cell.borrow();
        let (_, key) = held.as_ref().expect("key loaded");
        f(key)
    })
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

/// Locks the head row, made by the first write, and reads it: the last
/// entry's number and hash. Every write, and every rewrap of the vault,
/// holds it until it commits.
pub(crate) fn lock_head(c: &mut SpiClient<'_>) -> (i64, [u8; 32]) {
    spi(c.update("INSERT INTO cella.head VALUES (true, 0, $1) ON CONFLICT DO NOTHING", None, &[log::GENESIS.to_vec().into()]));
    let head = spi(c.update("SELECT n, hash FROM cella.head FOR UPDATE", Some(1), &[]));
    let (n, hash) = spi(head.first().get_two::<i64, Vec<u8>>());
    let hash = hash.and_then(|h| h.try_into().ok()).unwrap_or_else(|| fail("cella: the head's hash is not 32 bytes"));
    (n.unwrap_or_else(|| fail("cella: no head")), hash)
}

/// The id of the key file's key, which signs entry `n`: registered in
/// `cella.signer` as in office from `n` the first time it signs. A key a
/// later one replaced never signs again.
fn signer(c: &mut SpiClient<'_>, n: i64) -> i32 {
    let public = public_key().to_vec();
    let known = spi(c.select(
        "SELECT id, id = (SELECT max(id) FROM cella.signer) FROM cella.signer WHERE public = $1",
        Some(1),
        &[public.clone().into()],
    ));
    if !known.is_empty() {
        let (id, current) = spi(known.first().get_two::<i32, bool>());
        let id = id.unwrap_or_else(|| fail("cella: a signer has no id"));
        if current != Some(true) {
            fail(format!("cella.key_file holds signer {id}'s key, which a later key replaced: a retired key never signs again"));
        }
        return id;
    }
    let added = spi(c.update(
        "INSERT INTO cella.signer (id, public, since) SELECT coalesce(max(id), 0) + 1, $1, $2 FROM cella.signer RETURNING id",
        Some(1),
        &[public.into(), n.into()],
    ));
    first::<i32>(added).unwrap_or_else(|| fail("cella: the key file's key was not registered"))
}

/// The action `submit` or `follow` is judging, for the guards to read
/// through `cella.action()`, `cella.actor()`, `cella.device()` and
/// `cella.cause()`: an effect has no device, its actor is its decision's,
/// and it names the entry it follows.
#[derive(Clone)]
struct Context {
    op: String,
    actor: String,
    device: Option<[u8; 32]>,
    cause: Option<i64>,
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

/// The write a transaction opened with `cella.begin`, the subtransaction
/// that opened it, and the one its verdict was appended in, if any: a
/// savepoint rolled back past either undoes it, as it undoes the state.
struct Begun {
    write: Context,
    sub: pg_sys::SubTransactionId,
    settled: Option<pg_sys::SubTransactionId>,
}

thread_local! {
    static BEGUN: RefCell<Option<Begun>> = const { RefCell::new(None) };
}

fn begun() -> Option<Context> {
    BEGUN.with(|b| b.borrow().as_ref().map(|b| b.write.clone()))
}

fn subtransaction() -> pg_sys::SubTransactionId {
    // SAFETY: reads the backend's current subtransaction id.
    unsafe { pg_sys::GetCurrentSubTransactionId() }
}

/// Opens a write: after `BEGIN`, before its state. Until it commits, the
/// transaction may write the registered state tables, and it commits only
/// with the verdict `submit` appends for the same op, actor and device.
pub fn begin(op: &str, actor: &str, device: &[u8]) {
    let at_begin = || format!("{op} refused at begin, before its state");
    let Ok(device) = <[u8; 32]>::try_from(device) else {
        refuse(format!("{op} names no device: a device is a 32-byte public key"), at_begin());
    };
    if let Some(open) = begun() {
        refuse(format!("{op} is begun in a transaction that opened {} already: one write, one transaction", open.op), at_begin());
    }
    let write = Context { op: op.into(), actor: actor.into(), device: Some(device), cause: None };
    BEGUN.with(|b| *b.borrow_mut() = Some(Begun { write, sub: subtransaction(), settled: None }));
    register_xact_callback(PgXactCallbackEvent::PreCommit, settled);
    register_xact_callback(PgXactCallbackEvent::PrePrepare, settled);
    for end in [PgXactCallbackEvent::Commit, PgXactCallbackEvent::Abort, PgXactCallbackEvent::Prepare] {
        register_xact_callback(end, forget_begun);
    }
    // A released savepoint hands the begin, the verdict and the entries
    // appended in it to its parent; one rolled back undoes them.
    register_subxact_callback(PgSubXactCallbackEvent::CommitSub, |sub, parent| {
        WRITTEN.with(|w| w.borrow_mut().iter_mut().filter(|(_, s)| *s == sub).for_each(|(_, s)| *s = parent));
        BEGUN.with(|b| {
            if let Some(b) = b.borrow_mut().as_mut() {
                if b.sub == sub {
                    b.sub = parent;
                }
                if b.settled == Some(sub) {
                    b.settled = Some(parent);
                }
            }
        });
    });
    register_subxact_callback(PgSubXactCallbackEvent::AbortSub, |sub, _| {
        WRITTEN.with(|w| w.borrow_mut().retain(|(_, s)| *s != sub));
        BEGUN.with(|b| {
            let mut held = b.borrow_mut();
            if held.as_ref().is_some_and(|b| b.sub == sub) {
                held.take();
            } else if let Some(b) = held.as_mut().filter(|b| b.settled == Some(sub)) {
                b.settled = None;
            }
        });
    });
}

/// The begun write's verdict is appended, in this subtransaction.
fn settle() {
    BEGUN.with(|b| {
        if let Some(b) = b.borrow_mut().as_mut() {
            b.settled = Some(subtransaction());
        }
    });
}

pub(crate) fn forget_begun() {
    BEGUN.with(|b| b.borrow_mut().take());
    WRITTEN.with(|w| w.borrow_mut().clear());
    FOLLOWS.with(|f| f.borrow_mut().clear());
}

/// The entries this transaction appended and stands to commit.
fn written() -> Vec<Written> {
    WRITTEN.with(|w| w.borrow().iter().map(|(e, _)| e.clone()).collect())
}

/// Keeps entry `e` as this subtransaction's, with the effects
/// `cella.follows` lets follow its op, which judge what cites it.
fn wrote(c: &SpiClient<'_>, e: Written) {
    if !FOLLOWS.with(|f| f.borrow().iter().any(|f| f.cause == e.op)) {
        let rows = spi(c.select("SELECT op, required, since FROM cella.follows WHERE cause = $1", None, &[e.op.clone().into()]));
        let rows: Vec<Follows> = rows
            .map(|row| Follows {
                cause: e.op.clone(),
                op: spi(row.get::<String>(1)).unwrap_or_default(),
                required: spi(row.get::<bool>(2)) == Some(true),
                since: spi(row.get::<i64>(3)).unwrap_or_default(),
            })
            .collect();
        FOLLOWS.with(|f| f.borrow_mut().extend(rows));
    }
    WRITTEN.with(|w| w.borrow_mut().push((e, subtransaction())));
}

/// Before a begun transaction commits: it appended its verdict, or it
/// rolls back. A handler that skips `submit`, or a savepoint that rolled
/// the verdict back, commits nothing; nor does a write in which a settled
/// entry lacks a settled effect it requires.
fn settled() {
    let unsettled = BEGUN.with(|b| b.borrow().as_ref().filter(|b| b.settled.is_none()).map(|b| b.write.clone()));
    if let Some(open) = unsettled {
        refuse(
            format!("{} by {} was never submitted: a write's state commits only with its verdict", open.op, open.actor),
            "refused at commit by the notary",
        );
    }
    let (write, follows) = (written(), FOLLOWS.with(|f| f.borrow().clone()));
    if let Some((e, op)) = log::lacking(&write, &follows) {
        refuse(
            format!(
                "{}, entry {}, settles without {op}, which it requires: forgo it with the effect refused, or refuse the write",
                e.op, e.n
            ),
            "refused at commit by the notary",
        );
    }
}

/// The notary's trigger on every registered state table: a row changes
/// only inside a transaction `cella.begin` opened, while the notary
/// redacts, or where a superuser set `cella.unbound`.
pub fn notarised(table: &str) {
    if begun().is_some() || vault::redacting() || UNBOUND.get() {
        return;
    }
    refuse(
        format!("{table} is written outside a write: state changes only in a transaction cella.begin opens and cella.submit settles"),
        "refused by the notary's trigger",
    );
}

fn context() -> Option<Context> {
    WRITE.with(|c| c.borrow().clone())
}

pub fn action() -> Option<String> {
    context().map(|c| c.op)
}

pub fn actor() -> Option<String> {
    context().map(|c| c.actor)
}

pub fn device() -> Option<Vec<u8>> {
    context().and_then(|c| c.device).map(|d| d.to_vec())
}

pub fn cause() -> Option<i64> {
    context().and_then(|c| c.cause)
}

struct Registered {
    owner: String,
    function: String,
    call: String,
    body: String,
}

fn guards(c: &SpiClient<'_>, op: &str) -> Vec<Registered> {
    let rows = spi(c.select(
        "SELECT r.owner, r.fn::text, quote_ident(n.nspname) || '.' || quote_ident(p.proname),
                pg_get_functiondef(r.fn), p.provolatile = 'v',
                p.prorettype = 'text'::regtype AND p.proargtypes = '3802'::oidvector,
                p.prosecdef
         FROM cella.guard r
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
            fail(format!("cella: guard {function} is volatile; a guard is stable or immutable"));
        }
        if spi(row.get::<bool>(6)) != Some(true) {
            fail(format!("cella: guard {function} must take (payload jsonb) and return text"));
        }
        if spi(row.get::<bool>(7)) != Some(false) {
            fail(format!("cella: guard {function} is security definer; a guard runs as {GUARDS_ROLE}"));
        }
        Registered { owner: text(1), function, call: text(3), body: text(4) }
    })
    .collect()
}

/// The function that says whether a device is a current key of an actor:
/// `(actor text, device bytea) → text`, NULL when it is and a reason when
/// not. One feat registers it in `cella.keyring`; it runs as the guards do.
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

/// The role every guard runs as: it may read the scope's schemas and
/// nothing else, and owns nothing.
const GUARDS_ROLE: &str = "cella_guards";

fn guards_role(c: &SpiClient<'_>) -> pg_sys::Oid {
    let row = spi(c.select(
        "SELECT oid FROM pg_catalog.pg_roles WHERE rolname = $1 AND NOT rolsuper AND NOT rolbypassrls",
        Some(1),
        &[GUARDS_ROLE.into()],
    ));
    spi(row.first().get_one::<pg_sys::Oid>())
        .unwrap_or_else(|| fail(format!("cella: no role {GUARDS_ROLE}, or it is a superuser or bypasses row security")))
}

/// Runs a guard as the guards role, in a security-restricted operation, as
/// Postgres runs a security-definer function or a maintenance command:
/// `submit` is a security-definer function, where `SET ROLE` is refused.
/// The previous user is restored on return and on unwind; an abort
/// restores it too.
struct AsGuards {
    user: pg_sys::Oid,
    context: i32,
}

impl AsGuards {
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

impl Drop for AsGuards {
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
    let at_ingress = || format!("{op} refused at ingress, before any guard");
    let Some(s) = signed(&envelope.0) else {
        refuse(format!("{op} is not signed: a write carries its request, device, salt, nonce and sig in hex"), at_ingress());
    };
    // The verdict settles the write the transaction began, and no other.
    match begun() {
        None => refuse(format!("{op} was not begun: a write opens with cella.begin(op, actor, device) before its state"), at_ingress()),
        Some(open) if open.op != op || open.actor != actor || open.device != Some(s.device) => {
            refuse(format!("{op} by {actor} is not the write this transaction began, {} by {}", open.op, open.actor), at_ingress())
        }
        Some(_) => {}
    }
    let scope = scope();
    let request = sign::request_digest(&s.request, &s.salt).unwrap_or_else(|e| refuse(format!("the request: {e}"), at_ingress()));
    let asked = Request { scope: &scope, op, actor, device: s.device, digest: request, nonce: &s.nonce };
    if let Err(e) = asked.verify(&s.sig) {
        refuse(format!("{e}: {op} by {actor} from device {}", &hex(&s.device)[..16]), at_ingress());
    }
    if let Err(e) = sign::restates(&s.request, &payload.0) {
        refuse(format!("{e}: {op} by {actor}"), at_ingress());
    }
    let date = iso(verdict_date());
    Spi::connect_mut(|c| {
        let (last, prev) = lock_head(c);
        let n = last + 1;
        let after = |by: &str| format!("{op} refused by {by} after verdict {}", n - 1);

        let role = guards_role(c);
        let _during = During::enter(Context { op: op.into(), actor: actor.into(), device: Some(s.device), cause: None });

        // Under the head lock, so a revocation or a use of the same nonce
        // that committed first is seen.
        let current = keyring(c);
        let why = {
            let _as = AsGuards::enter(role);
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
        // the guards judge, holds commitments in their place.
        let (number, time) = taken();
        let form = vault::logged(c, &payload.0, number, &date);
        let digest = log::payload_digest(&form).unwrap_or_else(|e| fail(format!("cella: payload: {e}")));

        let registered = judge(c, role, op, &form, &after);

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
        let key = signer(c, n);
        let receipt_hash = receipt.hash();
        let receipt_sig = with_key(|k| k.sign(&receipt_hash));
        spi(c.update(
            "INSERT INTO cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, salt)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
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
                key.into(),
                s.salt.clone().into(),
            ],
        ));

        let basis = Basis::Receipt { n: number, hash: receipt_hash };
        let hash = append(c, Appended { n, prev, op, actor, date: &date, digest, form, basis, registered: &registered, key });
        wrote(c, Written { n, op: op.into(), hash, cause: None, settled: true, depth: 0 });
        settle();
        n
    })
}

/// Runs every guard registered for `op` on the logged payload, as the
/// guards role, refusing with the first reason one gives; returns them.
fn judge(c: &SpiClient<'_>, role: pg_sys::Oid, op: &str, form: &Value, after: &dyn Fn(&str) -> String) -> Vec<Registered> {
    let registered = guards(c, op);
    for r in &registered {
        let arg = JsonB(form.clone());
        let reason = {
            let _as = AsGuards::enter(role);
            let rows = spi(c.select(&format!("SELECT {}($1)", r.call), Some(1), &[arg.into()]));
            first::<String>(rows)
        };
        if let Some(reason) = reason {
            refuse(reason, after(&format!("{} ({})", r.function, r.owner)));
        }
    }
    registered
}

/// An entry to append: what its hash covers, its logged payload and the
/// guards that judged it.
struct Appended<'a> {
    n: i64,
    prev: [u8; 32],
    op: &'a str,
    actor: &'a str,
    date: &'a str,
    digest: [u8; 32],
    form: Value,
    basis: Basis,
    registered: &'a [Registered],
    key: i32,
}

/// Hashes, signs and appends an entry under the head's lock, keeping the
/// texts of its guards, and moves the head to it; returns its hash.
fn append(c: &mut SpiClient<'_>, a: Appended<'_>) -> [u8; 32] {
    let guards: Vec<Guard> = a
        .registered
        .iter()
        .map(|r| Guard { owner: r.owner.clone(), function: r.function.clone(), text: log::guard_digest(&r.body) })
        .collect();
    let entry = Entry { n: a.n, op: a.op.into(), actor: a.actor.into(), date: a.date.into(), payload: a.digest, basis: a.basis, guards };
    let hash = log::hash(&a.prev, &entry).unwrap_or_else(|e| fail(format!("cella: {e}")));
    let sig = with_key(|k| k.sign(&hash));

    for (r, guard) in a.registered.iter().zip(&entry.guards) {
        spi(c.update(
            "INSERT INTO cella.guard_text (hash, fn, body) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            None,
            &[guard.text.to_vec().into(), r.function.clone().into(), r.body.clone().into()],
        ));
    }
    let listed: Vec<Value> =
        entry.guards.iter().map(|r| json!({ "owner": r.owner, "function": r.function, "text": hex(&r.text) })).collect();
    let (receipt, cause, cause_hash, settled) = match &entry.basis {
        Basis::Receipt { n, .. } => (Some(*n), None, None, true),
        Basis::Cause { n, hash, settled } => (None, Some(*n), Some(hash.to_vec()), *settled),
    };
    spi(c.update(
        "INSERT INTO cella.log (n, op, actor, date, payload, form, receipt, guards, prev, hash, sig, key, cause, cause_hash, settled)
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
        None,
        &[
            a.n.into(),
            a.op.into(),
            a.actor.into(),
            a.date.into(),
            a.digest.to_vec().into(),
            JsonB(a.form).into(),
            receipt.into(),
            JsonB(Value::Array(listed)).into(),
            a.prev.to_vec().into(),
            hash.to_vec().into(),
            sig.to_vec().into(),
            a.key.into(),
            cause.into(),
            cause_hash.into(),
            settled.into(),
        ],
    ));
    spi(c.update("UPDATE cella.head SET n = $1, hash = $2", None, &[a.n.into(), hash.to_vec().into()]));
    hash
}

/// The entry `op` would follow, its hash, and the depth the effect would
/// stand at, or a refusal saying why it may not: the entry is this
/// write's, settled where the effect settles, fewer than five effects from
/// its decision, and `cella.follows` lets `op` follow it.
fn cited(op: &str, cause: i64, settles: bool, after: &str) -> ([u8; 32], u8) {
    let (write, follows) = (written(), FOLLOWS.with(|f| f.borrow().clone()));
    match log::may_follow(&write, &follows, op, cause, settles) {
        Ok((c, depth)) => (c.hash, depth),
        Err(why) => {
            let of = write.iter().find(|w| w.n == cause).map_or_else(String::new, |w| w.op.clone());
            refuse(
                match why {
                    Unfollowed::Elsewhere => {
                        format!("{op} cites entry {cause}, which this write did not append: an effect follows an entry of its own write")
                    }
                    Unfollowed::Forgone => {
                        format!("{op} cites entry {cause}, {of}, which was forgone: a settled effect follows a settled entry")
                    }
                    Unfollowed::Deep => {
                        format!("{op} would be {} effects from its decision: a write goes {DEEPEST} deep at most", DEEPEST + 1)
                    }
                    Unfollowed::Unregistered => {
                        format!("{op} may not follow {of}: cella.follows registers no such effect")
                    }
                },
                after.to_string(),
            )
        }
    }
}

/// Appends an effect of the write this transaction began: an entry with no
/// signature of its own, on the authority of entry `cause`, which the
/// transaction appended and whose op `cella.follows` lets `op` follow.
/// Its guards run as `submit`'s do, with its decision's actor, no device
/// and `cella.cause()` set; a refusal raises 09000, so the handler rolls
/// back to its savepoint and calls `forgo`.
pub fn follow(op: &str, payload: &JsonB, cause: i64) -> i64 {
    let open = begun().unwrap_or_else(|| {
        refuse(
            format!("{op} follows no write: an effect is appended in the transaction of the decision it follows"),
            format!("{op} refused at ingress, before any guard"),
        )
    });
    let date = iso(verdict_date());
    Spi::connect_mut(|c| {
        let (last, prev) = lock_head(c);
        let n = last + 1;
        let after = |by: &str| format!("{op} refused by {by} after verdict {last}");
        let (hash, depth) = cited(op, cause, true, &after("the notary"));
        let role = guards_role(c);
        let _during = During::enter(Context { op: op.into(), actor: open.actor.clone(), device: None, cause: Some(cause) });
        // Its personal values are committed to under its decision's receipt.
        let (number, _) = taken();
        let form = vault::logged(c, &payload.0, number, &date);
        let digest = log::payload_digest(&form).unwrap_or_else(|e| fail(format!("cella: payload: {e}")));
        let registered = judge(c, role, op, &form, &after);
        let key = signer(c, n);
        let basis = Basis::Cause { n: cause, hash, settled: true };
        let actor = &open.actor;
        let hash = append(c, Appended { n, prev, op, actor, date: &date, digest, form, basis, registered: &registered, key });
        wrote(c, Written { n, op: op.into(), hash, cause: Some(cause), settled: true, depth });
        n
    })
}

/// Records an effect forgone: one its guards refused, after its savepoint
/// rolled back, or one forgone with a required effect refused. An entry
/// citing `cause`, an entry this transaction appended, settled or forgone,
/// its logged payload the reason, and no guard.
pub fn forgo(op: &str, cause: i64, reason: &str) -> i64 {
    let at = || format!("{op} refused by the notary, before it was forgone");
    let open =
        begun().unwrap_or_else(|| refuse(format!("{op} follows no write: an effect is forgone in the transaction of its decision"), at()));
    if reason.trim().is_empty() {
        refuse(format!("{op} is forgone with no reason: a forgone effect says why, and what would let it settle"), at());
    }
    let date = iso(verdict_date());
    Spi::connect_mut(|c| {
        let (last, prev) = lock_head(c);
        let n = last + 1;
        let (hash, depth) = cited(op, cause, false, &at());
        let form = json!({ "reason": reason });
        let digest = log::payload_digest(&form).unwrap_or_else(|e| fail(format!("cella: payload: {e}")));
        let key = signer(c, n);
        let basis = Basis::Cause { n: cause, hash, settled: false };
        let actor = &open.actor;
        let hash = append(c, Appended { n, prev, op, actor, date: &date, digest, form, basis, registered: &[], key });
        wrote(c, Written { n, op: op.into(), hash, cause: Some(cause), settled: false, depth });
        n
    })
}

/// Whether `request` is what receipt `n`'s member signed: its digest,
/// salted with the salt the receipt keeps, is the digest the member's
/// signature names. `None` for no such receipt, or one taken before the
/// notary kept salts.
pub fn was_signed(n: i64, request: &Value) -> Option<bool> {
    let (digest, salt) = Spi::connect(|c| {
        let rows = spi(c.select("SELECT request, salt FROM cella.receipt WHERE n = $1", Some(1), &[n.into()]));
        if rows.is_empty() {
            return (None, None);
        }
        spi(rows.first().get_two::<Vec<u8>, String>())
    });
    let (digest, salt) = (digest?, salt?);
    let asked = sign::request_digest(request, &salt).unwrap_or_else(|e| fail(format!("cella: receipt {n}'s salt: {e}")));
    Some(asked[..] == digest[..])
}

pub(crate) fn listed_guards(v: &Value) -> Option<Vec<Guard>> {
    v.as_array()?
        .iter()
        .map(|r| {
            Some(Guard {
                owner: r.get("owner")?.as_str()?.to_string(),
                function: r.get("function")?.as_str()?.to_string(),
                text: unhex(r.get("text")?.as_str()?)?.try_into().ok()?,
            })
        })
        .collect()
}

/// Every key the notary has signed with, in the order they took office.
fn signers(c: &SpiClient<'_>) -> Vec<Signer> {
    let rows = spi(c.select("SELECT id, public, since FROM cella.signer ORDER BY id", None, &[]));
    rows.map(|row| {
        let public = spi(row.get::<Vec<u8>>(2)).and_then(|p| p.try_into().ok());
        let (Some(id), Some(public), Some(since)) = (spi(row.get::<i32>(1)), public, spi(row.get::<i64>(3))) else {
            fail("cella: a signer is unreadable");
        };
        Signer { id, public, since }
    })
    .collect()
}

pub fn verify_log() -> bool {
    let scope = scope();
    Spi::connect(|c| {
        let mut chain = match Chain::new(&signers(c)) {
            Ok(chain) => chain.following(follows(c)),
            Err(e) => {
                warning!("cella: the signers are out of order: {e}");
                return false;
            }
        };
        let rows = spi(c.select(
            "SELECT l.n, l.op, l.actor, to_char(l.date, 'YYYY-MM-DD'), l.payload, l.guards, l.prev, l.hash, l.sig, l.receipt,
                    r.op, r.actor, r.device, r.nonce, r.request, r.signature, r.payload, r.at, r.hash, r.sig, l.form,
                    l.key, r.key, l.cause, l.cause_hash, l.settled
             FROM cella.log l LEFT JOIN cella.receipt r ON r.n = l.receipt
             ORDER BY l.n",
            None,
            &[],
        ));
        let mut last = log::GENESIS.to_vec();
        let mut decisions = 0;
        for row in rows {
            let n = spi(row.get::<i64>(1)).unwrap_or_default();
            let text = |i| spi(row.get::<String>(i)).unwrap_or_default();
            let bytes = |i| spi(row.get::<Vec<u8>>(i)).unwrap_or_default();
            let guards = spi(row.get::<JsonB>(6)).and_then(|j| listed_guards(&j.0));
            // A decision names its receipt; an effect, the entry it follows.
            let receipt = spi(row.get::<i64>(10)).map(|number| {
                Some(Receipt {
                    n: number,
                    op: spi(row.get::<String>(11))?,
                    actor: spi(row.get::<String>(12))?,
                    device: bytes(13).try_into().ok()?,
                    nonce: spi(row.get::<String>(14))?,
                    request: bytes(15).try_into().ok()?,
                    signature: bytes(16).try_into().ok()?,
                    payload: bytes(17).try_into().ok()?,
                    time: spi(row.get::<String>(18))?,
                })
            });
            let basis = match &receipt {
                Some(r) => r.as_ref().and_then(|r| Some(Basis::Receipt { n: r.n, hash: bytes(19).try_into().ok()? })),
                None => (|| {
                    Some(Basis::Cause { n: spi(row.get::<i64>(24))?, hash: bytes(25).try_into().ok()?, settled: spi(row.get::<bool>(26))? })
                })(),
            };
            let (Some(payload), Some(guards), Some(basis)) = (bytes(5).try_into().ok(), guards, basis) else {
                warning!("cella: log broken at {n}: unreadable entry, or neither a receipt nor a cause");
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
            let entry = Entry { n, op: text(2), actor: text(3), date: text(4), payload, basis, guards };
            let Some(key) = spi(row.get::<i32>(22)) else {
                warning!("cella: log broken at {n}: no signer named");
                return false;
            };
            if let Some(Some(receipt)) = &receipt {
                let Some(receipt_key) = spi(row.get::<i32>(23)) else {
                    warning!("cella: log broken at {n}: no signer named");
                    return false;
                };
                if let Err(b) = chain.check_receipt(&scope, &entry, receipt_key, receipt, &bytes(19), &bytes(20)) {
                    warning!("cella: log broken at {}: {}", b.n, b.why);
                    return false;
                }
                decisions += 1;
            }
            let hash = bytes(8);
            if let Err(b) = chain.check(&entry, key, &bytes(7), &hash, &bytes(9)) {
                warning!("cella: log broken at {}: {}", b.n, b.why);
                return false;
            }
            last = hash;
        }
        if let Err(b) = chain.finish() {
            warning!("cella: log broken at {}: {}", b.n, b.why);
            return false;
        }
        // No head row is a log no write has reached yet.
        let head = spi(c.select("SELECT n, hash FROM cella.head", Some(1), &[]));
        let head = if head.is_empty() { (Some(0), Some(log::GENESIS.to_vec())) } else { spi(head.first().get_two::<i64, Vec<u8>>()) };
        if head != (Some(chain.len()), Some(last)) {
            warning!("cella: the head does not name the log's last entry");
            return false;
        }
        let receipts = spi(spi(c.select("SELECT count(*) FROM cella.receipt", Some(1), &[])).first().get_one::<i64>());
        if receipts != Some(decisions) {
            warning!("cella: a receipt names no verdict");
            return false;
        }
        true
    })
}

/// Which op may follow which as its effect, as `cella.follows` holds it.
fn follows(c: &SpiClient<'_>) -> Vec<Follows> {
    let rows = spi(c.select("SELECT cause, op, required, since FROM cella.follows", None, &[]));
    rows.map(|row| Follows {
        cause: spi(row.get::<String>(1)).unwrap_or_default(),
        op: spi(row.get::<String>(2)).unwrap_or_default(),
        required: spi(row.get::<bool>(3)) == Some(true),
        since: spi(row.get::<i64>(4)).unwrap_or_default(),
    })
    .collect()
}
