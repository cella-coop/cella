//! The plumbing behind `submit` and `verify_log`: the head lock, the rule
//! registry, the key file and the log rows, reached through SPI. Hashing,
//! signing and chain checks are `cella_rules::log`'s; whether a write may
//! pass is its rules', in SQL.

use crate::{CLOCK, KEY_FILE};
use cella_rules::log::{self, Chain, Entry, Key, Rule};
use pgrx::prelude::*;
use pgrx::spi::SpiClient;
use pgrx::{JsonB, PgXactCallbackEvent, register_xact_callback};
use serde_json::{Value, json};
use std::cell::RefCell;

thread_local! {
    static DATE: RefCell<Option<(i32, u8, u8)>> = const { RefCell::new(None) };
    static KEY: RefCell<Option<(String, Key)>> = const { RefCell::new(None) };
}

fn fail(msg: impl Into<String>) -> ! {
    ereport!(ERROR, PgSqlErrorCode::ERRCODE_INTERNAL_ERROR, msg.into());
}

fn spi<T>(r: Result<T, pgrx::spi::Error>) -> T {
    r.unwrap_or_else(|e| fail(format!("cella: {e}")))
}

pub fn verdict_date() -> pgrx::datum::Date {
    let (y, m, d) = DATE.with(|cell| {
        if let Some(date) = *cell.borrow() {
            return date;
        }
        let clock = CLOCK.get().and_then(|c| c.to_str().ok().map(str::to_string)).filter(|c| !c.is_empty());
        let date: Option<pgrx::datum::Date> = spi(match clock {
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

fn iso(d: &pgrx::datum::Date) -> String {
    format!("{:04}-{:02}-{:02}", d.year(), d.month(), d.day())
}

fn with_key<T>(f: impl FnOnce(&Key) -> T) -> T {
    let path = KEY_FILE
        .get()
        .and_then(|p| p.to_str().ok().map(str::to_string))
        .filter(|p| !p.is_empty())
        .unwrap_or_else(|| fail("cella.key_file is not set"));
    KEY.with(|cell| {
        let stale = cell.borrow().as_ref().is_none_or(|(p, _)| *p != path);
        if stale {
            let seed = std::fs::read(&path).unwrap_or_else(|e| fail(format!("cella.key_file {path}: {e}")));
            let key = Key::from_seed(&seed).unwrap_or_else(|e| fail(format!("cella.key_file {path}: {e}")));
            *cell.borrow_mut() = Some((path, key));
        }
        f(&cell.borrow().as_ref().expect("key loaded").1)
    })
}

pub fn public_key() -> [u8; 32] {
    with_key(Key::public)
}

pub fn receipt() -> i64 {
    spi(Spi::get_one::<i64>("SELECT nextval('cella.receipt_seq')")).unwrap_or_else(|| fail("cella: no receipt"))
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
        let restricted = (pg_sys::SECURITY_LOCAL_USERID_CHANGE | pg_sys::SECURITY_RESTRICTED_OPERATION) as i32;
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

pub fn submit(op: &str, payload: &JsonB, actor: &str) -> i64 {
    let date = iso(&verdict_date());
    let digest = log::payload_digest(&payload.0).unwrap_or_else(|e| fail(format!("cella: payload: {e}")));
    Spi::connect_mut(|c| {
        let head = spi(c.update("SELECT n, hash FROM cella.head FOR UPDATE", Some(1), &[]));
        let (n, prev) = spi(head.first().get_two::<i64, Vec<u8>>());
        let n = n.unwrap_or_else(|| fail("cella: no head")) + 1;
        let prev: [u8; 32] = prev
            .and_then(|p| p.try_into().ok())
            .unwrap_or_else(|| fail("cella: the head's hash is not 32 bytes"));

        let registered = rules(c, op);
        let role = if registered.is_empty() { pg_sys::InvalidOid } else { rules_role(c) };
        for r in &registered {
            let arg = JsonB(payload.0.clone());
            let reason = {
                let _as = AsRules::enter(role);
                let rows = spi(c.select(&format!("SELECT {}($1)", r.call), Some(1), &[arg.into()]));
                spi(rows.first().get_one::<String>())
            };
            if let Some(reason) = reason {
                ereport!(
                    ERROR,
                    PgSqlErrorCode::ERRCODE_TRIGGERED_ACTION_EXCEPTION,
                    reason,
                    format!("{op} refused by {} ({}) after verdict {}", r.function, r.owner, n - 1),
                );
            }
        }

        let rules: Vec<Rule> = registered
            .iter()
            .map(|r| Rule { owner: r.owner.clone(), function: r.function.clone(), text: log::rule_digest(&r.body) })
            .collect();
        let entry = Entry { n, op: op.into(), actor: actor.into(), date: date.clone(), payload: digest, rules };
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
            "INSERT INTO cella.log (n, op, actor, date, payload, rules, prev, hash, sig)
             VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9)",
            None,
            &[
                n.into(),
                op.into(),
                actor.into(),
                date.into(),
                digest.to_vec().into(),
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

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(s: &str) -> Option<[u8; 32]> {
    let bytes: Option<Vec<u8>> = (0..s.len())
        .step_by(2)
        .map(|i| s.get(i..i + 2).and_then(|h| u8::from_str_radix(h, 16).ok()))
        .collect();
    bytes?.try_into().ok()
}

fn listed_rules(v: &Value) -> Option<Vec<Rule>> {
    v.as_array()?
        .iter()
        .map(|r| {
            Some(Rule {
                owner: r.get("owner")?.as_str()?.to_string(),
                function: r.get("function")?.as_str()?.to_string(),
                text: unhex(r.get("text")?.as_str()?)?,
            })
        })
        .collect()
}

pub fn verify_log() -> bool {
    let mut chain = Chain::new(&public_key()).unwrap_or_else(|e| fail(format!("cella: {e}")));
    Spi::connect(|c| {
        let rows = spi(c.select(
            "SELECT n, op, actor, to_char(date, 'YYYY-MM-DD'), payload, rules, prev, hash, sig FROM cella.log ORDER BY n",
            None,
            &[],
        ));
        let mut last = log::GENESIS.to_vec();
        for row in rows {
            let n = spi(row.get::<i64>(1)).unwrap_or_default();
            let text = |i| spi(row.get::<String>(i)).unwrap_or_default();
            let bytes = |i| spi(row.get::<Vec<u8>>(i)).unwrap_or_default();
            let rules = spi(row.get::<JsonB>(6)).and_then(|j| listed_rules(&j.0));
            let (Some(payload), Some(rules)) = (bytes(5).try_into().ok(), rules) else {
                warning!("cella: log broken at {n}: unreadable entry");
                return false;
            };
            let entry = Entry { n, op: text(2), actor: text(3), date: text(4), payload, rules };
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
        true
    })
}
