//! The log's fold, through the built binary on the dev cluster: a scope
//! migrated whole, its circles written by signed writes as their handlers
//! write them, a rolled-back one among them, folds into a fresh database
//! that matches it; a fold stopped at a checkpoint and resumed there
//! reaches the state a fold from the first entry does; an entry folds by
//! the fold version in force when it was written, an older one too; and a
//! row the log does not carry is named by the compare. Needs the dev
//! cluster (`cella db start`); each database is the test's own.

use std::io::Write;
use std::process::{Command, Output, Stdio};

use cella_guards::hex::hex;
use cella_guards::sign::{Request, request_digest};
use ed25519_dalek::{Signer, SigningKey};
use serde_json::{Value, json};

const SCOPE: &str = "fold.example";
const JULIEN: &str = "julien@fold.example";
/// Every slice of the org app, each folded, as the compare lists them: a
/// slice no action names, whose rows only a founding carries, among them.
const EVERY_SLICE: &str = "account, account_membership, account_membership_patronage_transaction, account_membership_payslip_transaction, account_membership_transaction, bill, bill_transaction, circle, circle_person, contact, contact_invoice, contact_project, document, document_meeting, document_membership, document_motion, employment, employment_file, employment_membership, expense, expense_file, expense_invoice_project_timesheet, expense_project, expense_transaction, file, file_membership, import, invoice, invoice_project, invoice_transaction, meeting, meeting_membership, meeting_motion, membership, membership_project, membership_task, motion, motion_patronage, patronage, patronage_transaction, payslip, payslip_transaction, person, policy, project, project_task, project_timesheet, report, task, timesheet, transaction";
const SALT: &str = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

fn port() -> String {
    std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into())
}

/// psql as the cluster's superuser on `db`, the script on its input; its
/// output, one value per field, tab apart.
fn psql(db: &str, script: &str) -> String {
    let mut child = Command::new("psql")
        .args([
            "-X",
            "-q",
            "-t",
            "-A",
            "-F",
            "\t",
            "-v",
            "ON_ERROR_STOP=1",
            "-h",
            "127.0.0.1",
            "-p",
            &port(),
            "-U",
            "postgres",
            "-d",
            db,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("psql, from the devshell");
    child
        .stdin
        .take()
        .expect("its input")
        .write_all(script.as_bytes())
        .expect("the script");
    let out = child.wait_with_output().expect("psql's answer");
    assert!(
        out.status.success(),
        "psql on {db} failed: {}\n{script}",
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8_lossy(&out.stdout).trim().to_owned()
}

fn cella(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_cella"))
        .args(args)
        .env("CELLA_PGPORT", port())
        .output()
        .expect("the built cella")
}

fn said(out: &Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
}

fn ok(args: &[&str]) -> String {
    let out = cella(args);
    assert!(
        out.status.success(),
        "cella {} failed:\n{}",
        args.join(" "),
        said(&out)
    );
    said(&out)
}

fn literal(v: &Value) -> String {
    format!("'{}'::jsonb", v.to_string().replace('\'', "''"))
}

/// The scope's writes, each signed by Julien's TEST-ONLY device.
struct Scope {
    db: String,
    key: SigningKey,
    nonce: u32,
}

impl Scope {
    /// A database migrated whole and unseeded, at the scope's address, a
    /// keyring over a device table of the test's own, which is no scope's
    /// state and so no slice the compare reads, and no guards on core's
    /// circles' actions, whose motions the test does not write.
    fn new(db: &str) -> Self {
        ok(&["db", "reset", "--db", db]);
        let key = SigningKey::from_bytes(&[3; 32]);
        psql(
            db,
            &format!(
                "ALTER DATABASE {db} SET cella.scope = '{SCOPE}';
SET cella.unbound = on;
CREATE SCHEMA t;
CREATE TABLE t.device (actor text NOT NULL, device bytea NOT NULL);
CREATE FUNCTION t.keyring(actor text, device bytea) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN EXISTS (SELECT FROM t.device d WHERE d.actor = $1 AND d.device = $2) THEN NULL ELSE 'no such device' END
$$;
GRANT USAGE ON SCHEMA t TO cella_guards;
GRANT SELECT ON t.device TO cella_guards;
INSERT INTO t.device VALUES ('{JULIEN}', '\\x{}');
UPDATE cella.keyring SET fn = 't.keyring(text, bytea)', owner = 't';
DELETE FROM cella.state WHERE schema = 't';
DELETE FROM cella.guard WHERE op LIKE 'circle:%';",
                hex(&key.verifying_key().to_bytes())
            ),
        );
        Self {
            db: db.to_owned(),
            key,
            nonce: 0,
        }
    }

    /// What a handler passes as `signed` for the request.
    fn signed(&mut self, op: &str, request: &Value) -> Value {
        self.nonce += 1;
        let nonce = format!("{:032x}", self.nonce);
        let digest = request_digest(request, SALT).expect("a digest");
        let device = self.key.verifying_key().to_bytes();
        let r = Request {
            scope: SCOPE,
            op,
            actor: JULIEN,
            device,
            digest,
            nonce: &nonce,
        };
        let sig = self
            .key
            .sign(r.message().expect("a message").as_bytes())
            .to_bytes();
        json!({ "request": request, "device": hex(&device), "salt": SALT, "nonce": nonce, "sig": hex(&sig) })
    }

    /// One write on `day`: begun, its state, then submitted with the
    /// payload, an SQL expression read after the state is written.
    fn write(&mut self, day: &str, op: &str, request: &Value, state: &str, payload: &str) {
        let signed = self.signed(op, request);
        let device = hex(&self.key.verifying_key().to_bytes());
        psql(
            &self.db,
            &format!(
                "BEGIN;
SELECT set_config('cella.clock', '{day}', true);
SELECT cella.begin('{op}', '{JULIEN}', '\\x{device}');
{state};
SELECT cella.submit('{op}', {payload}, '{JULIEN}', {});
COMMIT;",
                literal(&signed)
            ),
        );
    }

    fn create(&mut self, day: &str, id: &str, purpose: &str) {
        let request =
            json!({ "id": id, "name": id.to_uppercase(), "purpose": purpose, "motion": "m-1" });
        self.write(
            day,
            "circle:circle:create",
            &request,
            &format!("INSERT INTO circle.circle (id, name, purpose) VALUES ('{id}', '{}', '{purpose}')", id.to_uppercase()),
            &literal(&json!({ "circle": id, "name": id.to_uppercase(), "purpose": purpose, "bundle": [], "motion": "m-1" })),
        );
    }

    /// Seats a person in a circle, by a tenure where a role is named, its id
    /// the seat sequence's, as `seating` makes it.
    fn seat(&mut self, day: &str, circle: &str, member: &str, role: Option<&str>) {
        let request = json!({ "circle": circle, "member": member, "role": role, "motion": "m-1" });
        let state = match role {
            None => format!(
                "INSERT INTO circle.member (circle, person, since) VALUES ('{circle}', '{member}', cella.verdict_date())"
            ),
            Some(r) => format!(
                "INSERT INTO circle.tenure (circle, holder, role, since) VALUES ('{circle}', '{member}', '{r}', cella.verdict_date())"
            ),
        };
        self.write(
            day,
            "circle:seat:add",
            &request,
            &state,
            &format!(
                "jsonb_build_object('seat', currval('circle.seat_id')) || {}",
                literal(&request)
            ),
        );
    }

    fn unseat(&mut self, day: &str, circle: &str, member: &str) {
        let request = json!({ "circle": circle, "member": member, "role": null, "motion": "m-1" });
        self.write(
            day,
            "circle:seat:remove",
            &request,
            &format!("UPDATE circle.member SET until = cella.verdict_date() WHERE circle = '{circle}' AND person = '{member}' AND until IS NULL"),
            &format!(
                "jsonb_build_object('seat', (SELECT id FROM circle.member WHERE circle = '{circle}' AND person = '{member}' ORDER BY id DESC LIMIT 1)) || {}",
                literal(&request)
            ),
        );
    }

    fn head(&self) -> i64 {
        psql(&self.db, "SELECT n FROM cella.head")
            .parse()
            .expect("a head")
    }
}

/// The latest checkpoint of a database folded into: its entry and state.
fn latest(db: &str) -> String {
    psql(
        db,
        "SELECT n || ' ' || encode(state, 'hex') FROM cella.checkpoint ORDER BY n DESC LIMIT 1",
    )
}

fn drop(dbs: &[&str]) {
    for db in dbs {
        psql(
            "postgres",
            &format!("DROP DATABASE IF EXISTS {db} WITH (FORCE)"),
        );
    }
}

/// The fold tests migrate their databases one at a time: two migrations at
/// once race on the cluster's catalog.
static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[test]
fn a_log_folds_into_the_state_it_was_written_with() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let id = std::process::id();
    let [src, whole, halves, versions, tampered] =
        ["src", "whole", "halves", "versions", "tampered"].map(|n| format!("fold_{id}_{n}"));
    let all = [
        src.as_str(),
        whole.as_str(),
        halves.as_str(),
        versions.as_str(),
        tampered.as_str(),
    ];
    drop(&all);

    let mut scope = Scope::new(&src);
    scope.create("2026-01-05", "web", "the website");
    scope.create("2026-01-05", "brand", "the brand");
    scope.seat("2026-01-12", "web", "camille@fold.example", None);
    // A write that rolls back takes a seat id the log never sees: the fold
    // takes each id from its entry, never from the sequence.
    psql(
        &src,
        "BEGIN; SET LOCAL cella.unbound = on; SELECT nextval('circle.seat_id'); ROLLBACK;",
    );
    scope.seat(
        "2026-01-12",
        "web",
        "thomas@fold.example",
        Some("participant"),
    );
    scope.seat("2026-02-02", "brand", "lea@fold.example", None);
    scope.unseat("2026-03-02", "web", "camille@fold.example");
    scope.create("2026-03-09", "studio", "the studio");
    scope.seat("2026-03-09", "studio", "camille@fold.example", None);
    let head = scope.head();
    assert_eq!(head, 8);

    // From the first entry, a checkpoint every three entries and one at the
    // head; the copy's log verifies, and its circles match.
    let out = ok(&["fold", &src, "--into", &whole, "--every", "3", "--compare"]);
    assert!(out.contains("3 checkpoints"), "{out}");
    assert!(out.contains("its log verifies"), "{out}");
    assert!(
        out.contains(&format!("compare: {EVERY_SLICE} folded")),
        "{out}"
    );
    assert_eq!(
        psql(
            &whole,
            "SELECT string_agg(n::text, ' ' ORDER BY n) FROM cella.checkpoint"
        ),
        "3 6 8"
    );
    let end = latest(&whole);

    // Stopped at a checkpoint and resumed there, the same state; resumed
    // anywhere else, or with its kept hashes changed, refused. A resume
    // reads the kept hashes, never the rows: a row written around the fold
    // the compare refuses, naming its table.
    ok(&["fold", &src, "--into", &halves, "--to", "3"]);
    let wrong = cella(&["fold", &src, "--into", &halves, "--from", "2"]);
    assert!(
        !wrong.status.success() && said(&wrong).contains("resumes there, not at 2"),
        "{}",
        said(&wrong)
    );
    let kept = psql(
        &halves,
        "SELECT encode(hash, 'hex') FROM cella.table_hash WHERE tab = 'circle.circle'",
    );
    psql(
        &halves,
        "UPDATE cella.table_hash SET hash = cella.lthash_zero() WHERE tab = 'circle.circle'",
    );
    let moved = cella(&["fold", &src, "--into", &halves, "--from", "3"]);
    assert!(
        !moved.status.success() && said(&moved).contains("changed since it was folded"),
        "{}",
        said(&moved)
    );
    psql(
        &halves,
        &format!("UPDATE cella.table_hash SET hash = '\\x{kept}' WHERE tab = 'circle.circle'"),
    );
    ok(&[
        "fold",
        &src,
        "--into",
        &halves,
        "--from",
        "3",
        "--every",
        "3",
        "--compare",
    ]);
    assert_eq!(latest(&halves), end);
    psql(
        &halves,
        "SET cella.unbound = on; UPDATE circle.circle SET purpose = 'moved' WHERE id = 'web'",
    );
    let around = cella(&["fold", &src, "--into", &halves, "--from", "8", "--compare"]);
    assert!(
        !around.status.success()
            && said(&around).contains("keeps drift from its rows in circle.circle:"),
        "{}",
        said(&around)
    );

    // A row the log does not carry fails the compare, which names it.
    psql(
        &src,
        "SET cella.unbound = on; UPDATE circle.member SET until = '2026-05-01' WHERE person = 'lea@fold.example'",
    );
    let differs = cella(&["fold", &src, "--into", &tampered, "--compare"]);
    let text = said(&differs);
    assert!(!differs.status.success(), "{text}");
    assert!(text.contains("circle.member: 1 rows only in"), "{text}");
    assert!(text.contains(r#""until": "2026-05-01""#), "{text}");
    assert!(!text.contains("circle.circle:"), "{text}");

    psql(
        &src,
        "SET cella.unbound = on; UPDATE circle.member SET until = NULL WHERE person = 'lea@fold.example'",
    );

    // A fold changed after entry 8 is a new version: the entries before it
    // fold by the version they were written under, those after by the new
    // one, which the handler of their day matches.
    let v2 = "CREATE FUNCTION circle.fold_create_2(entry jsonb) RETURNS void LANGUAGE sql AS $$
  INSERT INTO circle.circle (id, name, purpose) VALUES (entry #>> '{payload,circle}', entry #>> '{payload,name}', upper(entry #>> '{payload,purpose}'))
$$;";
    psql(
        &src,
        &format!(
            "SET cella.unbound = on; {v2} SELECT cella.lets_fold('circle:circle:create', 2, 'circle.fold_create_2(jsonb)', 'circle');"
        ),
    );
    let request = json!({ "id": "film", "name": "FILM", "purpose": "the films", "motion": "m-1" });
    scope.write(
        "2026-04-06",
        "circle:circle:create",
        &request,
        "INSERT INTO circle.circle (id, name, purpose) VALUES ('film', 'FILM', 'THE FILMS')",
        &literal(&json!({ "circle": "film", "name": "FILM", "purpose": "the films", "bundle": [], "motion": "m-1" })),
    );
    ok(&["fold", &src, "--into", &versions, "--to", "8"]);
    // A tree that lacks the version the source registers cannot fold it.
    let lacking = cella(&["fold", &src, "--into", &versions, "--from", "8"]);
    assert!(
        !lacking.status.success()
            && said(&lacking).contains("circle:circle:create by circle at version 2"),
        "{}",
        said(&lacking)
    );
    psql(
        &versions,
        &format!(
            "SET cella.unbound = on; {v2} SELECT cella.lets_fold('circle:circle:create', 2, 'circle.fold_create_2(jsonb)', 'circle');"
        ),
    );
    let out = ok(&[
        "fold",
        &src,
        "--into",
        &versions,
        "--from",
        "8",
        "--compare",
    ]);
    assert!(
        out.contains(&format!("compare: {EVERY_SLICE} folded")),
        "{out}"
    );
    assert_eq!(
        psql(
            &versions,
            "SELECT string_agg(purpose, ', ' ORDER BY id) FROM circle.circle"
        ),
        "the brand, THE FILMS, the studio, the website"
    );

    drop(&all);
}

#[test]
fn a_role_s_seat_in_another_circle_folds() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let id = std::process::id();
    let [src, into] = ["roles_src", "roles_into"].map(|n| format!("fold_{id}_{n}"));
    let all = [src.as_str(), into.as_str()];
    drop(&all);

    let mut scope = Scope::new(&src);
    scope.create("2026-01-05", "web", "the website");
    scope.create("2026-01-05", "brand", "the brand");
    let seat =
        |circle: &str, role: &str| json!({ "circle": circle, "role": role, "motion": "m-1" });
    let request = seat("brand", "participant");
    scope.write(
        "2026-01-12",
        "circle:role:seat",
        &request,
        "INSERT INTO circle.member (circle, role, since) VALUES ('brand', 'participant', cella.verdict_date())",
        &format!("jsonb_build_object('seat', currval('circle.seat_id')) || {}", literal(&request)),
    );
    let request = seat("web", "participant");
    scope.write(
        "2026-01-12",
        "circle:role:seat",
        &request,
        "INSERT INTO circle.member (circle, role, since) VALUES ('web', 'participant', cella.verdict_date())",
        &format!("jsonb_build_object('seat', currval('circle.seat_id')) || {}", literal(&request)),
    );
    let request = seat("brand", "participant");
    scope.write(
        "2026-02-02",
        "circle:role:unseat",
        &request,
        "UPDATE circle.member SET until = cella.verdict_date() WHERE circle = 'brand' AND role = 'participant' AND until IS NULL",
        &format!(
            "jsonb_build_object('seat', (SELECT id FROM circle.member WHERE circle = 'brand' AND role = 'participant' ORDER BY id DESC LIMIT 1)) || {}",
            literal(&request)
        ),
    );
    // An unseat that ends no seat names 0, and its fold ends none.
    let request = seat("web", "steward");
    scope.write(
        "2026-02-02",
        "circle:role:unseat",
        &request,
        "SELECT 1",
        &format!("jsonb_build_object('seat', 0) || {}", literal(&request)),
    );

    let out = ok(&["fold", &src, "--into", &into, "--compare"]);
    assert!(
        out.contains(&format!("compare: {EVERY_SLICE} folded")),
        "{out}"
    );
    assert_eq!(
        psql(
            &into,
            "SELECT string_agg(circle || ' ' || role || ' ' || coalesce(until::text, 'open'), ', ' ORDER BY id) FROM circle.member"
        ),
        "brand participant 2026-02-02, web participant open"
    );

    drop(&all);
}
