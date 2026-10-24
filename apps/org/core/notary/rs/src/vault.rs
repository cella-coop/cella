//! The plumbing behind the vault: the personal values a write marks,
//! committed to in what the log keeps and sealed in `vault.*`; erasure;
//! opening an entry's commitments; and the sweep that erases restricted
//! data once its legal clock runs out. Commitments, sealing and the
//! markers are `cella_rules::vault`'s; the classes and their clocks are
//! rows of `cella.retention`, and which columns hold personal data, rows of
//! `cella.personal`, which each feat registers.

use crate::notary::{fail, first, refuse, spi, wrap_key};
use cella_rules::log::canonical;
use cella_rules::vault::{self, Erase, Marked, NONCE, Personal};
use pgrx::prelude::*;
use pgrx::spi::SpiClient;
use serde_json::{Value, json};
use std::cell::Cell;
use std::collections::BTreeSet;

/// N bytes from Postgres's strong random source.
fn random<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    // SAFETY: writes exactly N bytes into a buffer of N bytes.
    let ok = unsafe { pg_sys::pg_strong_random(bytes.as_mut_ptr().cast(), N) };
    if !ok {
        fail("cella: no strong randomness");
    }
    bytes
}

fn key_aad(subject: &str, class: &str, year: i32) -> Vec<u8> {
    vault::bound(&[b"key", subject.as_bytes(), class.as_bytes(), &year.to_be_bytes()])
}

fn secret_aad(commitment: &[u8; 32], subject: &str, class: &str, year: i32, field: &str) -> Vec<u8> {
    vault::bound(&[b"secret", commitment, subject.as_bytes(), class.as_bytes(), &year.to_be_bytes(), field.as_bytes()])
}

/// The key sealing a subject's values of a class from a year, and whether
/// it is restricted: made on first use when `make`, sealed under the
/// scope's wrap key.
fn data_key(c: &mut SpiClient<'_>, subject: &str, class: &str, year: i32, make: bool) -> Option<([u8; 32], bool)> {
    let rows = spi(c.select(
        "SELECT sealed, restricted IS NOT NULL FROM vault.key WHERE subject = $1 AND class = $2 AND year = $3",
        Some(1),
        &[subject.into(), class.into(), year.into()],
    ));
    if !rows.is_empty() {
        let row = rows.first();
        let sealed = spi(row.get::<Vec<u8>>(1)).unwrap_or_default();
        let restricted = spi(row.get::<bool>(2)).unwrap_or(false);
        let plain = vault::open(&wrap_key(), &key_aad(subject, class, year), &sealed)
            .unwrap_or_else(|e| fail(format!("cella: the key of {subject}'s {class} from {year}: {e}")));
        let key: [u8; 32] = plain.try_into().unwrap_or_else(|_| fail("cella: a vault key is 32 bytes"));
        return Some((key, restricted));
    }
    if !make {
        return None;
    }
    let key = random::<32>();
    let sealed = vault::seal(&wrap_key(), &random::<NONCE>(), &key_aad(subject, class, year), &key)
        .unwrap_or_else(|e| fail(format!("cella: {e}")));
    spi(c.update(
        "INSERT INTO vault.key (subject, class, year, sealed) VALUES ($1, $2, $3, $4)",
        None,
        &[subject.into(), class.into(), year.into(), sealed.into()],
    ));
    Some((key, false))
}

/// The class of a registered personal field, `schema.table.column`.
fn class_of(c: &SpiClient<'_>, field: &str) -> String {
    let parts: Vec<&str> = field.split('.').collect();
    let [schema, tab, col] = parts[..] else {
        refuse(format!("{field} names no column: a personal field is schema.table.column"), "refused before any rule");
    };
    let rows = spi(c.select(
        "SELECT class FROM cella.personal WHERE schema = $1 AND tab = $2 AND col = $3",
        Some(1),
        &[schema.into(), tab.into(), col.into()],
    ));
    first::<String>(rows)
        .unwrap_or_else(|| refuse(format!("{field} is not registered as personal data in cella.personal"), "refused before any rule"))
}

/// Commits to one personal value: a fresh salt, the commitment, and the
/// value and salt sealed in the vault under the subject's key for the
/// class and the verdict's year. Data erased stays erased: a value for a
/// subject's class after its erasure is refused.
fn commit(c: &mut SpiClient<'_>, p: &Personal, receipt: i64, year: i32) -> Value {
    let class = class_of(c, &p.field);
    let erased = spi(c.select(
        "SELECT receipt FROM vault.erased WHERE subject = $1 AND class = $2",
        Some(1),
        &[p.subject.clone().into(), class.clone().into()],
    ));
    if let Some(at) = first::<i64>(erased) {
        refuse(format!("{}'s {class} data was erased at receipt {at}: erasure wins", p.subject), "refused before any rule");
    }
    let (key, _) = data_key(c, &p.subject, &class, year, true).expect("made");
    let salt = random::<32>();
    let commitment = vault::commit(&salt, &p.value).unwrap_or_else(|e| refuse(format!("{}: {e}", p.field), "refused before any rule"));
    let plain = canonical(&p.value).unwrap_or_else(|e| fail(format!("cella: {e}")));
    let aad = secret_aad(&commitment, &p.subject, &class, year, &p.field);
    let sealed = vault::seal(&key, &random::<NONCE>(), &aad, plain.as_bytes()).unwrap_or_else(|e| fail(format!("cella: {e}")));
    spi(c.update(
        "INSERT INTO vault.secret (commitment, receipt, subject, class, year, field, salt, sealed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        None,
        &[
            commitment.to_vec().into(),
            receipt.into(),
            p.subject.clone().into(),
            class.into(),
            year.into(),
            p.field.clone().into(),
            salt.to_vec().into(),
            sealed.into(),
        ],
    ));
    vault::committed(&commitment)
}

/// Erases a subject's classes, every class when none is named. An
/// erasable class loses its keys and its sealed values, and its columns
/// are redacted in the read models; a restricted one, kept by law, loses
/// only the keys whose clock has run out and is marked restricted until
/// `sweep` finds its clock out, then erased the same way. Either way a
/// tombstone refuses the subject's class any later value.
fn erase(c: &mut SpiClient<'_>, e: &Erase, receipt: i64, date: &str, year: i32) -> Value {
    let known: Vec<(String, i32, bool)> = spi(c.select("SELECT class, years, restricted FROM cella.retention ORDER BY class", None, &[]))
        .map(|r| (spi(r.get::<String>(1)).unwrap_or_default(), spi(r.get::<i32>(2)).unwrap_or_default(), spi(r.get::<bool>(3)).unwrap_or(true)))
        .collect();
    let wanted: BTreeSet<String> = match &e.classes {
        Some(list) => list.iter().cloned().collect(),
        None => known.iter().map(|(k, _, _)| k.clone()).collect(),
    };
    if let Some(unknown) = wanted.iter().find(|w| !known.iter().any(|(k, _, _)| k == *w)) {
        refuse(format!("no retention class {unknown}"), "refused before any rule");
    }
    let (mut erased, mut restricted) = (Vec::new(), Vec::new());
    for (class, years, kept) in known.into_iter().filter(|(k, _, _)| wanted.contains(k)) {
        let subject = e.subject.clone();
        if kept {
            spi(c.update(
                "DELETE FROM vault.key WHERE subject = $1 AND class = $2 AND year + $3 + 1 <= $4",
                None,
                &[subject.clone().into(), class.clone().into(), years.into(), year.into()],
            ));
            // The read models may hold this year's data, whose clock has
            // not begun: the class stays, restricted, until `sweep`.
            spi(c.update(
                "UPDATE vault.key SET restricted = $3::date WHERE subject = $1 AND class = $2 AND restricted IS NULL",
                None,
                &[subject.clone().into(), class.clone().into(), date.into()],
            ));
            tombstone(c, &subject, &class, receipt, date, true);
            restricted.push(class);
            continue;
        }
        spi(c.update("DELETE FROM vault.key WHERE subject = $1 AND class = $2", None, &[subject.clone().into(), class.clone().into()]));
        redact(c, &subject, &class);
        tombstone(c, &subject, &class, receipt, date, false);
        erased.push(class);
    }
    json!({ vault::ERASURE: { "subject": e.subject, "erased": erased, "restricted": restricted } })
}

thread_local! {
    static REDACTING: Cell<bool> = const { Cell::new(false) };
}

/// Whether the notary is redacting a subject's columns right now: the one
/// change a record that never changes takes, which a feat's trigger lets
/// through by `cella.redacting()`. No role can set it.
pub fn redacting() -> bool {
    REDACTING.with(Cell::get)
}

struct Redacting;

impl Drop for Redacting {
    fn drop(&mut self) {
        REDACTING.with(|r| r.set(false));
    }
}

fn redact(c: &mut SpiClient<'_>, subject: &str, class: &str) {
    REDACTING.with(|r| r.set(true));
    let _during = Redacting;
    spi(c.update("SELECT cella.redact($1, $2)", None, &[subject.into(), class.into()]));
}

fn tombstone(c: &mut SpiClient<'_>, subject: &str, class: &str, receipt: i64, date: &str, restricted: bool) {
    spi(c.update(
        "INSERT INTO vault.erased (subject, class, receipt, date, restricted) VALUES ($1, $2, $3, $4::date, $5)
         ON CONFLICT (subject, class) DO UPDATE SET receipt = $3, date = $4::date, restricted = vault.erased.restricted AND $5",
        None,
        &[subject.into(), class.into(), receipt.into(), date.into(), restricted.into()],
    ));
}

/// The payload as the log keeps it: personal values committed to and
/// sealed, erasures carried out, each marker replaced by what it became.
pub fn logged(c: &mut SpiClient<'_>, payload: &Value, receipt: i64, date: &str) -> Value {
    let year: i32 = date[..4].parse().unwrap_or_else(|_| fail(format!("cella: verdict date {date}")));
    vault::logged(payload, &mut |m| {
        Ok(match m {
            Marked::Personal(p) => commit(c, &p, receipt, year),
            Marked::Erase(e) => erase(c, &e, receipt, date, year),
        })
    })
    .unwrap_or_else(|e| refuse(format!("the payload: {e}"), "refused before any rule"))
}

/// What one commitment opens to: the value, if its salt and key are still
/// in the vault and it opens the commitment; `restricted` while its class
/// is kept only by law; none once erased.
fn open_one(c: &mut SpiClient<'_>, commitment: &[u8; 32]) -> Option<Value> {
    let rows = spi(c.select(
        "SELECT subject, class, year, field, salt, sealed FROM vault.secret WHERE commitment = $1",
        Some(1),
        &[commitment.to_vec().into()],
    ));
    if rows.is_empty() {
        return None;
    }
    let row = rows.first();
    let text = |i| spi(row.get::<String>(i)).unwrap_or_default();
    let (subject, class, field) = (text(1), text(2), text(4));
    let year = spi(row.get::<i32>(3)).unwrap_or_default();
    let salt: [u8; 32] = spi(row.get::<Vec<u8>>(5)).unwrap_or_default().try_into().ok()?;
    let sealed = spi(row.get::<Vec<u8>>(6)).unwrap_or_default();
    let (key, restricted) = data_key(c, &subject, &class, year, false)?;
    if restricted {
        return Some(Value::String("restricted".into()));
    }
    let plain = vault::open(&key, &secret_aad(commitment, &subject, &class, year, &field), &sealed).ok()?;
    let value: Value = serde_json::from_slice(&plain).ok()?;
    vault::opens(commitment, &salt, &value).then_some(value)
}

/// An entry's logged payload with its commitments opened: the values the
/// vault still holds, `restricted` for those kept only by law, `redacted`
/// for the erased.
pub fn opened(n: i64) -> Option<Value> {
    Spi::connect_mut(|c| {
        let rows = spi(c.select("SELECT form FROM cella.log WHERE n = $1", Some(1), &[n.into()]));
        let form = first::<pgrx::JsonB>(rows)?.0;
        Some(vault::opened(&form, &mut |k| open_one(c, k)))
    })
}

/// The restricted data whose clock has run out on `date`: each key past
/// its clock destroyed; and each restricted erasure whose clock, counted
/// from the year it was asked (no later value is accepted), has run out,
/// carried out in full: its keys and values deleted, its columns redacted.
pub fn sweep(date: &str) -> Vec<(String, String, i64, bool)> {
    let year: i32 = date[..4].parse().unwrap_or_else(|_| fail(format!("cella: verdict date {date}")));
    Spi::connect_mut(|c| {
        let mut out = Vec::new();
        let expired: Vec<(String, String, i32)> = spi(c.select(
            "SELECT k.subject, k.class, k.year FROM vault.key k JOIN cella.retention r ON r.class = k.class
             WHERE k.restricted IS NOT NULL AND k.year + r.years + 1 <= $1 ORDER BY 1, 2, 3",
            None,
            &[year.into()],
        ))
        .map(|r| (spi(r.get::<String>(1)).unwrap_or_default(), spi(r.get::<String>(2)).unwrap_or_default(), spi(r.get::<i32>(3)).unwrap_or_default()))
        .collect();
        let due: Vec<(String, String)> = spi(c.select(
            "SELECT e.subject, e.class FROM vault.erased e JOIN cella.retention r ON r.class = e.class
             WHERE e.restricted AND extract(year FROM e.date)::int + r.years + 1 <= $1 ORDER BY 1, 2",
            None,
            &[year.into()],
        ))
        .map(|r| (spi(r.get::<String>(1)).unwrap_or_default(), spi(r.get::<String>(2)).unwrap_or_default()))
        .collect();
        let mut touched: BTreeSet<(String, String)> = expired.iter().map(|(s, k, _)| (s.clone(), k.clone())).collect();
        touched.extend(due.iter().cloned());
        for (subject, class) in touched {
            let mut destroyed = 0i64;
            for (_, _, y) in expired.iter().filter(|(s, k, _)| *s == subject && *k == class) {
                spi(c.update(
                    "DELETE FROM vault.key WHERE subject = $1 AND class = $2 AND year = $3",
                    None,
                    &[subject.clone().into(), class.clone().into(), (*y).into()],
                ));
                spi(c.update(
                    "INSERT INTO vault.swept (subject, class, year, date) VALUES ($1, $2, $3, $4::date) ON CONFLICT DO NOTHING",
                    None,
                    &[subject.clone().into(), class.clone().into(), (*y).into(), date.into()],
                ));
                destroyed += 1;
            }
            let full = due.contains(&(subject.clone(), class.clone()));
            if full {
                let left = spi(c.select(
                    "SELECT count(*) FROM vault.key WHERE subject = $1 AND class = $2",
                    Some(1),
                    &[subject.clone().into(), class.clone().into()],
                ));
                destroyed += first::<i64>(left).unwrap_or(0);
                spi(c.update("DELETE FROM vault.key WHERE subject = $1 AND class = $2", None, &[subject.clone().into(), class.clone().into()]));
                redact(c, &subject, &class);
                spi(c.update(
                    "UPDATE vault.erased SET restricted = false WHERE subject = $1 AND class = $2",
                    None,
                    &[subject.clone().into(), class.clone().into()],
                ));
            }
            out.push((subject, class, destroyed, full));
        }
        out
    })
}
