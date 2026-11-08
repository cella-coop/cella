//! The fold's scale tier (architecture.md, "Tests"): a generated scope,
//! Lanterne grown to ten thousand members over twenty years, about ten
//! million entries, folded into a fresh database, measured, and failed on
//! memory that grows with the log, a re-fold from the latest checkpoint
//! over its bound, or hashes the fold kept as it wrote that differ from its
//! rows hashed from scratch. Run by `cella test scale`, never by `cella test`: it is
//! ignored here, and takes its size from `CELLA_SCALE_MEMBERS` and
//! `CELLA_SCALE_YEARS`. Needs the dev cluster (`cella db start`).
//!
//! The generator is TEST-ONLY and never a shipped path: it writes the
//! scope's years straight into the log of a database founded as Lanterne,
//! entries and receipts as the notary writes them, hashed, chained and
//! signed by a signer of its own from entry 2, under a device key of its
//! own, so the log verifies; but no handler runs and no guard judges, so
//! the source holds the log and Lanterne's founding, never the state its
//! years build. Each payload is the one its handler logs, as the e2e
//! scenarios write them, every personal value as a commitment.

use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Output, Stdio};
use std::time::Instant;

use cella_guards::hex::hex;
use cella_guards::log::{self, Basis, Entry, Guard, Receipt};
use cella_guards::sign::Request;
use ed25519_dalek::{Signer, SigningKey};
use serde_json::{Value, json};

/// The databases the tier renews each run and drops when it passes.
const SOURCE: &str = "cella_scale";
const FOLD: &str = "cella_scale_fold";
/// The generator's own signer, from entry 2, and its members' one device:
/// TEST-ONLY keys, which sign nothing outside this test.
const NOTARY_SEED: [u8; 32] = [0x5c; 32];
const DEVICE_SEED: [u8; 32] = [0xd5; 32];
/// How many entries apart the fold records its checkpoints.
const EVERY: i64 = 10_000;
/// How many entries the generator signs and copies at a time.
const CHUNK: usize = 50_000;

/// The bounds the tier holds (architecture.md, "Tests"): the fold's peak
/// memory by the end of the log is no more than this over its peak a tenth
/// of the way; a re-fold from the latest checkpoint takes no longer than
/// this; and the fold goes no slower than this.
const GROWTH_MB: f64 = 64.0;
const REFOLD_SECONDS: f64 = 30.0;
const FLOOR_PER_SECOND: f64 = 1_000.0;

fn port() -> String {
    std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into())
}

fn sized(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn psql_cmd(db: &str) -> Command {
    let mut cmd = Command::new("psql");
    cmd.args([
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
    ]);
    cmd
}

/// psql as the cluster's superuser on `db`, the script on its input; its
/// output, one value per field, tab apart.
fn psql(db: &str, script: &str) -> String {
    let mut child = psql_cmd(db)
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
        "psql on {db} failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8_lossy(&out.stdout).trim().to_owned()
}

/// Rows into `table` of `db`, in COPY's text format.
fn copy(db: &str, table: &str, rows: &str) {
    let mut child = psql_cmd(db)
        .args(["-c", &format!("COPY {table} FROM STDIN")])
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("psql, from the devshell");
    child
        .stdin
        .take()
        .expect("its input")
        .write_all(rows.as_bytes())
        .expect("the rows");
    let out = child.wait_with_output().expect("psql's answer");
    assert!(
        out.status.success(),
        "copying into {table} failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

fn cella(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_cella"))
        .args(args)
        .env("CELLA_PGPORT", port())
        .output()
        .expect("the built cella")
}

fn ok(args: &[&str]) -> String {
    let out = cella(args);
    let said = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    assert!(
        out.status.success(),
        "cella {} failed:\n{said}",
        args.join(" ")
    );
    said
}

/// A day of the generated years, `YYYY-MM-DD`.
fn day(y: i32, m: u32, d: u32) -> String {
    format!("{y:04}-{m:02}-{d:02}")
}

fn month(y: i32, m: u32) -> String {
    format!("{y:04}-{m:02}")
}

/// The last day of a month.
fn last(y: i32, m: u32) -> u32 {
    match m {
        2 if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

/// A value of COPY's text format: a backslash doubled.
fn text(s: &str) -> String {
    s.replace('\\', "\\\\")
}

fn bytea(b: &[u8]) -> String {
    format!("\\\\x{}", hex(b))
}

/// One entry the generator appends, before it is hashed and signed: a
/// decision with its receipt's number, or an effect with the entry it
/// follows.
struct Raw {
    n: i64,
    op: String,
    actor: String,
    date: String,
    form: Value,
    receipt: Option<i64>,
    cause: Option<i64>,
}

/// What phase one computes of a raw entry in parallel: its form as text,
/// its payload's digest, and a decision's member signature and nonce.
struct Made {
    form: String,
    payload: [u8; 32],
    request: [u8; 32],
    nonce: String,
    signature: [u8; 64],
}

/// A member of the generated scope who works: their address and circle.
#[derive(Clone)]
struct Worker {
    address: String,
    circle: String,
}

/// The scope being generated: its chain, its counters, its members.
struct Scope {
    scope: String,
    notary: SigningKey,
    device: SigningKey,
    guards: HashMap<String, Vec<Guard>>,
    pending: Vec<Raw>,
    n: i64,
    receipt: i64,
    prev: [u8; 32],
    /// The decision of the write being appended, which its effects follow.
    write: i64,
    commits: u64,
    journal: u32,
    seat: i64,
    timesheet: i64,
    expense: u32,
    holders: u32,
    joined: u32,
    motions: (i32, u32),
    voters: Vec<String>,
    workers: Vec<Worker>,
    entries: i64,
}

const TREASURER: &str = "julien@lanterne.example";
const COORDINATOR: &str = "camille@lanterne.example";
const CIRCLES: [&str; 4] = ["web", "brand", "marketing", "operations"];

impl Scope {
    /// The scope of the database founded as Lanterne, read from it: its
    /// address, its guards by op, its counters and its members.
    fn read(db: &str) -> Self {
        let one = |sql: &str| psql(db, sql);
        let num = |sql: &str| -> i64 { one(sql).parse().expect("a number") };
        let mut guards: HashMap<String, Vec<Guard>> = HashMap::new();
        for line in one(
            "SELECT g.op, g.owner, g.fn::text, encode(convert_to(pg_get_functiondef(g.fn), 'UTF8'), 'hex') FROM cella.guard g ORDER BY g.op, g.owner, g.fn::text",
        )
        .lines()
        {
            let c: Vec<&str> = line.split('\t').collect();
            let [op, owner, function, body] = c[..] else {
                continue;
            };
            let body = cella_guards::hex::unhex(body).expect("hex");
            guards.entry(op.to_owned()).or_default().push(Guard {
                owner: owner.to_owned(),
                function: function.to_owned(),
                text: log::guard_digest(&String::from_utf8_lossy(&body)),
            });
        }
        let workers = one("SELECT address FROM employment.worker ORDER BY address")
            .lines()
            .map(|a| Worker {
                address: a.to_owned(),
                circle: "web".to_owned(),
            })
            .collect();
        let voters =
            one("SELECT address FROM membership.member WHERE status = 'active' ORDER BY address")
                .lines()
                .map(str::to_owned)
                .collect();
        let head = num("SELECT n FROM cella.head");
        Self {
            scope: one("SELECT current_setting('cella.scope')"),
            notary: SigningKey::from_bytes(&NOTARY_SEED),
            device: SigningKey::from_bytes(&DEVICE_SEED),
            guards,
            pending: Vec::new(),
            n: head,
            receipt: num("SELECT max(n) FROM cella.receipt"),
            prev: cella_guards::hex::unhex(&one("SELECT encode(hash, 'hex') FROM cella.head"))
                .and_then(|h| h.try_into().ok())
                .expect("the head's hash"),
            write: 0,
            commits: 0,
            journal: u32::try_from(num("SELECT last FROM transaction.journal")).expect("a count"),
            seat: num(
                "SELECT greatest((SELECT max(id) FROM circle.tenure), (SELECT last_value FROM circle.seat_id))",
            ),
            timesheet: num("SELECT max(id) FROM timesheet.entry"),
            expense: u32::try_from(num("SELECT count(*) FROM expense.expense")).expect("a count"),
            holders: u32::try_from(num(
                "SELECT count(*) FROM account.account WHERE parent = '1013'",
            ))
            .expect("a count"),
            joined: 0,
            motions: (0, 0),
            voters,
            workers,
            entries: 0,
        }
    }

    /// A personal value as the log keeps it: its commitment, here a digest
    /// of a counter, which opens to nothing.
    fn commit(&mut self) -> Value {
        self.commits += 1;
        json!({ "$commit": blake3::hash(&self.commits.to_be_bytes()).to_hex().to_string() })
    }

    fn je(&mut self) -> String {
        self.journal += 1;
        format!("je-{:04}", self.journal)
    }

    /// Appends a decision, its payload made from its receipt's number, and
    /// returns its entry's number.
    fn decide(
        &mut self,
        op: &str,
        actor: &str,
        date: &str,
        form: impl FnOnce(&mut Self, i64) -> Value,
    ) -> i64 {
        if self.pending.len() >= CHUNK {
            self.flush();
        }
        self.receipt += 1;
        self.n += 1;
        let r = self.receipt;
        let form = form(self, r);
        self.write = self.n;
        self.pending.push(Raw {
            n: self.n,
            op: op.to_owned(),
            actor: actor.to_owned(),
            date: date.to_owned(),
            form,
            receipt: Some(r),
            cause: None,
        });
        self.n
    }

    /// Appends an effect of the write being appended, following `cause`.
    fn effect(&mut self, op: &str, cause: i64, form: Value) -> i64 {
        let decision = self
            .pending
            .iter()
            .find(|e| e.n == self.write)
            .expect("an effect follows a decision of its own write");
        let (actor, date) = (decision.actor.clone(), decision.date.clone());
        self.n += 1;
        self.pending.push(Raw {
            n: self.n,
            op: op.to_owned(),
            actor,
            date,
            form,
            receipt: None,
            cause: Some(cause),
        });
        self.n
    }

    /// Hashes, chains, signs and copies the pending entries, all whole
    /// writes: their digests and the members' signatures in parallel,
    /// then the chain in order, then the notary's signatures in parallel.
    fn flush(&mut self) {
        if self.pending.is_empty() {
            return;
        }
        let raws = std::mem::take(&mut self.pending);
        let threads = std::thread::available_parallelism().map_or(4, std::num::NonZero::get);
        let part = raws.len().div_ceil(threads);
        let device = self.device.verifying_key().to_bytes();
        let scope = self.scope.clone();
        let made: Vec<Made> = std::thread::scope(|s| {
            let handles: Vec<_> = raws
                .chunks(part)
                .map(|chunk| {
                    let (scope, device_key) = (&scope, &self.device);
                    s.spawn(move || {
                        chunk
                            .iter()
                            .map(|e| {
                                let payload =
                                    log::payload_digest(&e.form).expect("a canonical payload");
                                let r = e.receipt.unwrap_or_default();
                                let nonce = format!("{r:032x}");
                                // TEST-ONLY: the digest of no request.
                                let request = *blake3::hash(nonce.as_bytes()).as_bytes();
                                let signature = if e.receipt.is_some() {
                                    let message = Request {
                                        scope,
                                        op: &e.op,
                                        actor: &e.actor,
                                        device,
                                        digest: request,
                                        nonce: &nonce,
                                    }
                                    .message()
                                    .expect("a request");
                                    device_key.sign(message.as_bytes()).to_bytes()
                                } else {
                                    [0; 64]
                                };
                                Made {
                                    form: serde_json::to_string(&e.form).expect("json"),
                                    payload,
                                    request,
                                    nonce,
                                    signature,
                                }
                            })
                            .collect::<Vec<_>>()
                    })
                })
                .collect();
            handles
                .into_iter()
                .flat_map(|h| h.join().expect("a signer"))
                .collect()
        });
        // The chain, in order: each receipt's hash, then its entry's.
        let mut hashes: Vec<([u8; 32], Option<[u8; 32]>, [u8; 32])> =
            Vec::with_capacity(raws.len());
        let mut by_n: HashMap<i64, [u8; 32]> = HashMap::new();
        for (e, m) in raws.iter().zip(&made) {
            let at = format!("{}T09:00:00.000000Z", e.date);
            let (basis, receipt_hash) = match (e.receipt, e.cause) {
                (Some(r), _) => {
                    let h = Receipt {
                        n: r,
                        op: e.op.clone(),
                        actor: e.actor.clone(),
                        device,
                        nonce: m.nonce.clone(),
                        request: m.request,
                        signature: m.signature,
                        payload: m.payload,
                        time: at,
                    }
                    .hash();
                    (Basis::Receipt { n: r, hash: h }, Some(h))
                }
                (None, Some(c)) => (
                    Basis::Cause {
                        n: c,
                        hash: by_n[&c],
                        settled: true,
                    },
                    None,
                ),
                (None, None) => unreachable!("an entry is a decision or an effect"),
            };
            let entry = Entry {
                n: e.n,
                op: e.op.clone(),
                actor: e.actor.clone(),
                date: e.date.clone(),
                payload: m.payload,
                basis,
                guards: self.guards.get(&e.op).cloned().unwrap_or_default(),
            };
            let h = log::hash(&self.prev, &entry).expect("an entry");
            hashes.push((self.prev, receipt_hash, h));
            by_n.insert(e.n, h);
            self.prev = h;
        }
        // The notary's signatures, and the rows as COPY reads them.
        let rows: Vec<(String, String)> = std::thread::scope(|s| {
            let handles: Vec<_> = raws
                .chunks(part)
                .zip(made.chunks(part))
                .zip(hashes.chunks(part))
                .map(|((raws, made), hashes)| {
                    let (notary, guards, by_n) = (&self.notary, &self.guards, &by_n);
                    s.spawn(move || {
                        let mut receipts = String::new();
                        let mut entries = String::new();
                        for ((e, m), (prev, receipt_hash, h)) in raws.iter().zip(made).zip(hashes) {
                            let listed: Vec<Value> = guards
                                .get(&e.op)
                                .map(|g| {
                                    g.iter()
                                        .map(|g| json!({ "owner": g.owner, "function": g.function, "text": hex(&g.text) }))
                                        .collect()
                                })
                                .unwrap_or_default();
                            if let (Some(r), Some(rh)) = (e.receipt, receipt_hash) {
                                receipts.push_str(&format!(
                                    "{r}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}T09:00:00.000000Z\t{}\t{}\t2\t\\N\t{}\n",
                                    text(&e.op),
                                    text(&e.actor),
                                    bytea(&device),
                                    m.nonce,
                                    bytea(&m.request),
                                    bytea(&m.signature),
                                    bytea(&m.payload),
                                    e.date,
                                    bytea(rh),
                                    bytea(&notary.sign(rh).to_bytes()),
                                    e.n,
                                ));
                            }
                            let (receipt, cause, cause_hash) = match e.cause {
                                Some(c) => ("\\N".to_owned(), c.to_string(), bytea(&by_n[&c])),
                                None => (e.receipt.unwrap_or_default().to_string(), "\\N".to_owned(), "\\N".to_owned()),
                            };
                            entries.push_str(&format!(
                                "{}\t{}\t{}\t{}\t{}\t{}\t{receipt}\t{}\t{}\t{}\t{}\t2\t{cause}\t{cause_hash}\tt\n",
                                e.n,
                                text(&e.op),
                                text(&e.actor),
                                e.date,
                                bytea(&m.payload),
                                text(&m.form),
                                text(&Value::Array(listed).to_string()),
                                bytea(prev),
                                bytea(h),
                                bytea(&notary.sign(h).to_bytes()),
                            ));
                        }
                        (receipts, entries)
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().expect("a signer"))
                .collect()
        });
        let (receipts, entries): (String, String) =
            rows.into_iter()
                .fold((String::new(), String::new()), |(mut a, mut b), (r, e)| {
                    a.push_str(&r);
                    b.push_str(&e);
                    (a, b)
                });
        copy(
            SOURCE,
            "cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, salt, entry)",
            &receipts,
        );
        copy(
            SOURCE,
            "cella.log (n, op, actor, date, payload, form, receipt, guards, prev, hash, sig, key, cause, cause_hash, settled)",
            &entries,
        );
        self.entries += i64::try_from(raws.len()).expect("a count");
    }

    /// Opens the books' month on its first day, and closes the one before
    /// on the fifth, as the treasurer does.
    fn books(&mut self, y: i32, m: u32, before: &[String]) {
        let opened = month(y, m);
        self.decide(
            "account:period:open",
            TREASURER,
            &day(y, m, 1),
            |_, _| json!({ "month": opened }),
        );
        for b in before {
            let b = b.clone();
            self.decide(
                "account:period:close",
                TREASURER,
                &day(y, m, 5),
                |_, _| json!({ "month": b, "closed": day(y, m, 5) }),
            );
        }
    }

    /// The month's admissions: each newcomer invited and accepting, then
    /// one motion of the general assembly admitting them all, its votes,
    /// its close and each admission's effects, and each one hired.
    fn admit(&mut self, y: i32, m: u32, count: u32) {
        if count == 0 {
            return;
        }
        let invited = day(y, m, 2);
        let mut newcomers = Vec::new();
        for _ in 0..count {
            self.joined += 1;
            let member = format!("m{:05}@lanterne.example", self.joined);
            let link = hex(blake3::hash(format!("link {member}").as_bytes()).as_bytes());
            let key = hex(blake3::hash(format!("device {member}").as_bytes()).as_bytes());
            let (name, label, device) = (self.commit(), self.commit(), self.commit());
            let (to, link2) = (member.clone(), link.clone());
            self.decide(
                "membership:member:invite",
                COORDINATOR,
                &invited,
                |_, _| json!({ "link": link, "name": name, "member": to, "invited": invited }),
            );
            self.decide("membership:member:accept", &member.clone(), &invited, |_, _| {
                json!({ "key": key, "link": link2, "label": label, "device": device, "member": member, "accepted": invited })
            });
            newcomers.push(member);
        }
        if self.motions.0 != y {
            self.motions = (y, 0);
        }
        self.motions.1 += 1;
        let motion = format!("m-{y}-{:03}", self.motions.1);
        let proposed = day(y, m, 3);
        let actions: Vec<Value> = newcomers
            .iter()
            .map(|n| json!({ "args": { "member": n, "shares": 20 }, "kind": "admit" }))
            .collect();
        let (title, body) = (self.commit(), self.commit());
        let id = motion.clone();
        self.decide("motion:motion:propose", COORDINATOR, &proposed, |_, _| {
            json!({ "body": body, "title": title, "author": "ag", "ballot": "secret", "circle": "ag",
                    "motion": id, "actions": actions, "deadline": day(y, m, 10), "procedure": "majority" })
        });
        // Three in five members vote, a different three each time.
        let voting = day(y, m, 4);
        let voters = self.voters.clone();
        for (i, voter) in voters.iter().enumerate() {
            if (i + self.motions.1 as usize) % 5 >= 3 {
                continue;
            }
            let stance = self.commit();
            let id = motion.clone();
            self.decide(
                "motion:motion:vote",
                voter,
                &voting,
                |_, r| json!({ "member": voter, "motion": id, "stance": stance, "receipt": r }),
            );
        }
        let closed = day(y, m, 10);
        let id = motion.clone();
        let close = self.decide(
            "motion:motion:close",
            COORDINATOR,
            &closed,
            |_, r| json!({ "closed": closed, "cutoff": r, "motion": id }),
        );
        for member in &newcomers {
            self.seat += 1;
            let admit = self.effect(
                "membership:member:admit",
                close,
                json!({ "seat": self.seat, "circle": "ag", "member": member, "motion": motion, "shares": 20 }),
            );
            self.holders += 1;
            let account = format!("1013{:02}", self.holders);
            let (entry, label) = (self.je(), self.commit());
            self.effect(
                "account:capital:subscribe",
                admit,
                json!({ "entry": entry, "label": label, "amount": 100_000, "member": member, "motion": motion,
                        "shares": 20, "account": account,
                        "posting": { "date": closed, "label": format!("Capital subscribed and called, {account}"),
                                     "lines": [{ "side": "debit", "cents": 100_000, "account": "4562" },
                                               { "side": "credit", "cents": 100_000, "account": "1012" }] } }),
            );
        }
        let hired = day(y, m, 11);
        for member in newcomers {
            let key = hex(blake3::hash(format!("work device {member}").as_bytes()).as_bytes());
            let (name, label) = (self.commit(), self.commit());
            let worker = member.clone();
            self.decide("employment:worker:hire", TREASURER, &hired, |_, _| {
                json!({ "worker": worker, "job": "designer", "contract": "permanent", "start": hired,
                        "until": null, "minutes": 2100, "hired": hired, "key": key, "name": name, "label": label })
            });
            let circle = CIRCLES[self.joined as usize % CIRCLES.len()].to_owned();
            self.voters.push(member.clone());
            self.workers.push(Worker {
                address: member,
                circle,
            });
        }
    }

    /// The month's work: six time entries from each worker, an expense
    /// from one in fifty, through capture, submission, approval and
    /// reimbursement, and the books' purchases and sales, day by day; then
    /// each worker's month submitted and approved, and the payroll run.
    fn work(&mut self, y: i32, m: u32) {
        let workers = self.workers.clone();
        let spenders: Vec<Worker> = workers.iter().step_by(50).cloned().collect();
        let mut expenses = Vec::new();
        let posts = (workers.len() / 100).max(14);
        for d in 12..=25 {
            let date = day(y, m, d);
            for (w, worker) in workers.iter().enumerate() {
                for j in 0..6 {
                    if (w + 2 * j) % 14 != (d - 12) as usize {
                        continue;
                    }
                    self.timesheet += 1;
                    let (note, minutes) = (self.commit(), self.commit());
                    let entry = self.timesheet.to_string();
                    self.decide("timesheet:entry:log", &worker.address, &date, |_, _| {
                        json!({ "day": date, "note": note, "entry": entry, "circle": worker.circle,
                                "member": worker.address, "minutes": minutes, "billable": j % 3 != 0 })
                    });
                }
            }
            if d == 14 {
                for spender in &spenders {
                    self.expense += 1;
                    let id = format!("ex-{:04}", self.expense);
                    let (label, receipt) = (self.commit(), self.commit());
                    let e = id.clone();
                    self.decide("expense:expense:capture", &spender.address, &date, |_, _| {
                        json!({ "day": date, "net": 8_000, "vat": 1_600, "label": label, "amount": 9_600,
                                "circle": spender.circle, "member": spender.address, "expense": e,
                                "receipt": receipt, "category": "606" })
                    });
                    let e = id.clone();
                    self.decide("expense:expense:submit", &spender.address, &date, |_, _| {
                        json!({ "day": date, "amount": 9_600, "circle": spender.circle, "expense": e })
                    });
                    expenses.push((id, spender.circle.clone()));
                }
            }
            if d == 20 || d == 25 {
                for (id, circle) in &expenses {
                    let entry = self.je();
                    let (op, label, lines) = if d == 20 {
                        (
                            "expense:expense:approve",
                            format!("Expense {id}"),
                            json!([{ "side": "debit", "cents": 8_000, "account": "606" },
                                   { "side": "debit", "cents": 1_600, "account": "44566" },
                                   { "side": "credit", "cents": 9_600, "account": "421" }]),
                        )
                    } else {
                        (
                            "expense:expense:reimburse",
                            format!("Reimbursement of {id}"),
                            json!([{ "side": "debit", "cents": 9_600, "account": "421" },
                                   { "side": "credit", "cents": 9_600, "account": "512" }]),
                        )
                    };
                    self.decide(op, TREASURER, &date, |_, _| {
                        json!({ "day": date, "entry": entry, "amount": 9_600, "circle": circle, "expense": id,
                                "posting": { "date": date, "label": label, "lines": lines } })
                    });
                }
            }
            for p in 0..posts.div_ceil(14) {
                let entry = self.je();
                let cents = 10_000 + (p as i64 % 7) * 2_500;
                let (label, debit, credit) = if p % 2 == 0 {
                    ("Supplies", "613", "401")
                } else {
                    ("Sale, paid on receipt", "512", "706")
                };
                self.decide("transaction:transaction:post", TREASURER, &date, |_, _| {
                    json!({ "date": date, "entry": entry, "label": label, "amount": cents,
                            "lines": [{ "side": "debit", "cents": cents, "account": debit },
                                      { "side": "credit", "cents": cents, "account": credit }] })
                });
            }
        }
        let (submitted, approved) = (day(y, m, 26), day(y, m, 27));
        let the_month = month(y, m);
        for worker in &workers {
            self.decide("timesheet:period:submit", &worker.address, &submitted, |_, _| {
                json!({ "month": the_month, "circle": worker.circle, "member": worker.address, "submitted": submitted })
            });
        }
        for worker in &workers {
            self.decide("timesheet:period:approve", TREASURER, &approved, |_, _| {
                json!({ "month": the_month, "circle": worker.circle, "member": worker.address, "approved": approved })
            });
        }
        // The payroll: three thousand euros gross each, 22% withheld from
        // the employee and 40% due from the employer.
        let paid = day(y, m, 28);
        let count = workers.len() as i64;
        let gross = 300_000 * count;
        let (employee, employer) = (gross * 22 / 100, gross * 40 / 100);
        let net = gross - employee;
        let timed: Vec<Value> = workers
            .iter()
            .map(|w| json!({ "member": w.address, "minutes": self.commit() }))
            .collect();
        let figures: Vec<Value> = workers
            .iter()
            .map(|w| {
                json!({ "member": w.address, "gross": self.commit(), "employee": self.commit(),
                        "employer": self.commit(), "net": self.commit() })
            })
            .collect();
        self.decide("payslip:run:generate", TREASURER, &paid, |_, _| {
            json!({ "day": paid, "gross": gross, "month": the_month, "timed": timed, "figures": figures })
        });
        let entry = self.je();
        self.decide("payslip:run:approve", TREASURER, &paid, |_, _| {
            json!({ "day": paid, "entry": entry, "gross": gross, "month": the_month, "payslips": count,
                    "posting": { "date": day(y, m, last(y, m)), "label": format!("Payroll, {the_month}"),
                                 "lines": [{ "side": "debit", "cents": gross, "account": "641" },
                                           { "side": "debit", "cents": employer, "account": "645" },
                                           { "side": "credit", "cents": net, "account": "421" },
                                           { "side": "credit", "cents": employee + employer, "account": "431" }] } })
        });
        let entry = self.je();
        self.decide("payslip:run:pay", TREASURER, &paid, |_, _| {
            json!({ "day": paid, "entry": entry, "gross": gross, "month": the_month, "payslips": count,
                    "posting": { "date": paid, "label": format!("Payroll paid, {the_month}"),
                                 "lines": [{ "side": "debit", "cents": net, "account": "421" },
                                           { "side": "debit", "cents": employee + employer, "account": "431" },
                                           { "side": "credit", "cents": net + employee + employer, "account": "512" }] } })
        });
    }

    /// The head moves to the last entry appended.
    fn finish(&mut self) {
        self.flush();
        psql(
            SOURCE,
            &format!(
                "UPDATE cella.head SET n = {}, hash = '\\x{}'",
                self.n,
                hex(&self.prev)
            ),
        );
    }
}

/// Generates the scope: Lanterne grown to `members` over `years` from
/// January 2027, the months of the books Lanterne leaves open closed in
/// the first.
fn generate(members: usize, years: i32) -> i64 {
    ok(&["db", "reset", "--db", SOURCE, "--seed", "lanterne"]);
    let mut scope = Scope::read(SOURCE);
    psql(
        SOURCE,
        &format!(
            "INSERT INTO cella.signer (id, public, since) VALUES (2, '\\x{}', {})",
            hex(&scope.notary.verifying_key().to_bytes()),
            scope.n + 1
        ),
    );
    let mut open: Vec<String> = psql(
        SOURCE,
        "SELECT month FROM account.period WHERE closed IS NULL ORDER BY month",
    )
    .lines()
    .map(str::to_owned)
    .collect();
    let months = u32::try_from(years).expect("years") * 12;
    let start = scope.voters.len();
    let growth = members.saturating_sub(start);
    for i in 0..months {
        let (y, m) = (2027 + i32::try_from(i / 12).expect("a year"), i % 12 + 1);
        scope.books(y, m, &open);
        open = vec![month(y, m)];
        // Newcomers spread evenly over the months, so the scope reaches
        // `members` in its last.
        let due =
            growth * (i as usize + 1) / months as usize - growth * i as usize / months as usize;
        scope.admit(y, m, u32::try_from(due).expect("a count"));
        scope.work(y, m);
    }
    scope.finish();
    scope.entries
}

#[test]
#[ignore = "the scale tier, run by `cella test scale`"]
fn a_generated_scope_folds_in_bounded_memory_and_re_folds_from_its_latest_checkpoint() {
    let members = sized("CELLA_SCALE_MEMBERS", 10_000);
    let years = i32::try_from(sized("CELLA_SCALE_YEARS", 20)).expect("years");
    let generating = Instant::now();
    let entries = generate(members, years);
    let generated = generating.elapsed().as_secs_f64();
    assert_eq!(
        psql(SOURCE, "SELECT cella.verify_log()"),
        "t",
        "the generated log verifies"
    );
    let head: i64 = psql(SOURCE, "SELECT n FROM cella.head")
        .parse()
        .expect("the head");
    let bytes: f64 = psql(
        SOURCE,
        "SELECT (pg_total_relation_size('cella.log') + pg_total_relation_size('cella.receipt'))::float8 / count(*) FROM cella.log",
    )
    .parse()
    .expect("bytes");
    println!(
        "generated {entries} entries, {members} members over {years} years, in {generated:.0}s; the log's head is entry {head}, at {bytes:.0} bytes an entry with its receipt"
    );
    // The checkpoints are `EVERY` entries apart, or a tenth of a smaller
    // log. The latest is the end of the write before the one that starts
    // that many entries before the head, so the re-fold folds the most
    // entries a checkpoint leaves behind.
    let every = EVERY.min((head / 10).max(1));
    let latest: i64 = psql(
        SOURCE,
        &format!(
            "SELECT max(n) - 1 FROM cella.log WHERE n <= {} AND receipt IS NOT NULL",
            head - every
        ),
    )
    .parse()
    .expect("a write's end");
    let every = every.to_string();
    let folded = ok(&[
        "fold",
        SOURCE,
        "--into",
        FOLD,
        "--to",
        &latest.to_string(),
        "--every",
        &every,
    ]);
    print!("{folded}");
    let measured = folded
        .lines()
        .find(|l| l.starts_with("measured: "))
        .expect("the fold's measurements");
    let number = |after: &str| -> f64 {
        measured
            .split(after)
            .nth(1)
            .and_then(|r| r.split_whitespace().next())
            .and_then(|v| v.parse().ok())
            .unwrap_or_else(|| panic!("no number after {after:?} in {measured}"))
    };
    let rate = number("measured: ");
    let checkpoint = number("a checkpoint ");
    let peak = number("its sessions ");
    let tenth = number("MB, ");
    let refolding = Instant::now();
    let refolded = ok(&[
        "fold",
        SOURCE,
        "--into",
        FOLD,
        "--from",
        &latest.to_string(),
        "--every",
        &every,
    ]);
    let refold = refolding.elapsed().as_secs_f64();
    print!("{refolded}");
    // The hashes the fold kept as it wrote against its rows hashed from
    // scratch, which is what a checkpoint read before they were kept.
    let scratching = Instant::now();
    let agree = psql(FOLD, "SELECT cella.state_hash() = cella.kept_hash()");
    let scratch = scratching.elapsed().as_secs_f64();
    println!(
        "scale: {head} entries; folded at {rate:.0} entries/s; a checkpoint {checkpoint:.1} ms from its kept hashes, {scratch:.1}s from scratch; peak memory {peak:.1} MB, {tenth:.1} MB a tenth of the way; re-folded from the latest checkpoint, entry {latest}, in {refold:.1}s; {bytes:.0} bytes an entry"
    );
    assert_eq!(
        agree, "t",
        "the hashes the fold kept as it wrote differ from its rows hashed from scratch"
    );
    assert!(
        peak <= tenth + GROWTH_MB,
        "the fold's memory grows with the log: {peak:.1} MB at its end, {tenth:.1} MB a tenth of the way, over the {GROWTH_MB} MB it may grow"
    );
    assert!(
        refold <= REFOLD_SECONDS,
        "a re-fold from the latest checkpoint took {refold:.1}s, over its bound of {REFOLD_SECONDS}s"
    );
    assert!(
        rate >= FLOOR_PER_SECOND,
        "the fold ran at {rate:.0} entries/s, under its floor of {FLOOR_PER_SECOND}"
    );
    // A receipt no verdict names, numbered before the checkpoint's receipts
    // and after them, and one keeping an entry past the head, as a log cut
    // short leaves it: the verification resumed from the checkpoint refuses
    // each, reading no receipt before it.
    let resumed = || psql(FOLD, &format!("SELECT cella.verify_log({latest})"));
    assert_eq!(
        resumed(),
        "t",
        "the re-folded log verifies after its checkpoint"
    );
    for (n, entry, at) in [
        ("(SELECT min(n) - 1 FROM cella.receipt)", "NULL", "before"),
        ("(SELECT max(n) + 1 FROM cella.receipt)", "NULL", "after"),
        (
            "(SELECT max(n) + 1 FROM cella.receipt)",
            "(SELECT n + 1 FROM cella.head)",
            "past the head",
        ),
    ] {
        psql(
            FOLD,
            &format!(
                "INSERT INTO cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, entry)
                 SELECT {n}, op, actor, device, nonce || '-planted', request, signature, payload, at, hash, sig, key, {entry}
                 FROM cella.receipt WHERE n = (SELECT min(n) FROM cella.receipt)"
            ),
        );
        assert_eq!(
            resumed(),
            "f",
            "a receipt no verdict names, {at} the checkpoint's, is refused"
        );
        psql(
            FOLD,
            "DELETE FROM cella.receipt WHERE nonce LIKE '%-planted'",
        );
    }
    assert_eq!(
        resumed(),
        "t",
        "the planted receipts gone, it verifies again"
    );
    for db in [FOLD, SOURCE] {
        psql(
            "postgres",
            &format!("DROP DATABASE IF EXISTS {db} WITH (FORCE)"),
        );
    }
}
