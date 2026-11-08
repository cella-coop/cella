//! The log's fold: a database's log folded entry by entry into a fresh one
//! migrated as the scope's, each entry applied by its actions' folds
//! (`cella.fold_log`, architecture.md "Folds"), so the copy rebuilds the
//! scope's non-personal state. The log's rows are streamed between the two
//! by `COPY`, never held, so the fold's memory is bounded whatever the
//! log's length, and the copy keeps each state table's multiset hash as the
//! fold writes it (`cella.keep_hashes`). Every so many entries it records a
//! checkpoint, the state hash at the end of a write, read from the kept
//! hashes alone, from which a fold resumes; then the copy's log verifies,
//! and a compare checks the kept hashes against the rows and reads both
//! databases' folded slices, by state hash and then row by row.

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, ChildStdout, Stdio};
use std::time::Instant;

use cella_guards::hex::hex;

use crate::db::Dev;
use crate::repo::Repo;
use crate::run::{Fail, Result, Steps, quiet};

/// What `cella fold` is asked: the database whose log it folds, the one it
/// folds into, the entry it stops at, the checkpoint it resumes from, how
/// many entries a checkpoint is apart, and whether to compare the two.
pub struct Fold<'a> {
    pub source: &'a str,
    pub into: &'a str,
    pub to: Option<i64>,
    pub from: Option<i64>,
    pub every: i64,
    pub compare: bool,
}

/// How many entries apart the fold records its checkpoints, unless asked.
pub const EVERY: i64 = 10_000;

/// The settings a fold's session runs under: the superuser writes the
/// state tables outside a write, as the migrations do, and a commit, one
/// per write, waits for no flush, since a fold that stops is folded again.
const UNBOUND: &str = "-c cella.unbound=on -c synchronous_commit=off";

/// What a session of the fold answers last: the peak of its process's
/// resident memory, `VmHWM`, less the shared buffers it touched, which
/// every session of the cluster shares and `shared_buffers` bounds, in kB,
/// as the superuser reads its own `/proc/self/status`; on a line no row
/// line can be, since a row line starts with its table's name.
const PEAK: &str = "SELECT 'cella:peak ' || ((regexp_match(s, 'VmHWM:\\s+(\\d+) kB'))[1]::bigint - (regexp_match(s, 'RssShmem:\\s+(\\d+) kB'))[1]::bigint) FROM pg_read_file('/proc/self/status') s";

/// The peak a session's `PEAK` line names, in kB.
fn peak(line: &str) -> Option<u64> {
    line.strip_prefix("cella:peak ")?.trim().parse().ok()
}

/// The peak resident memory of this process, in kB.
fn own_peak() -> u64 {
    std::fs::read_to_string("/proc/self/status")
        .ok()
        .and_then(|s| {
            s.lines().find_map(|l| {
                l.strip_prefix("VmHWM:")?
                    .trim()
                    .trim_end_matches("kB")
                    .trim()
                    .parse()
                    .ok()
            })
        })
        .unwrap_or(0)
}

#[allow(clippy::cast_precision_loss)]
fn mb(kb: u64) -> String {
    format!("{:.1} MB", kb as f64 / 1024.0)
}

/// psql on a database of the dev cluster, one value per field, tab apart.
fn psql(dev: &Dev, db: &str, sql: &str) -> Result<String> {
    let mut cmd = dev.on(db, "psql");
    cmd.args([
        "-X",
        "-q",
        "-t",
        "-A",
        "-F",
        "\t",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ]);
    Steps::read(&mut cmd)
}

fn number(text: &str, what: &str) -> Result<i64> {
    text.trim()
        .parse()
        .map_err(|_| Fail::new(format!("{what} is not a number: {text}")))
}

fn literal(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

pub fn fold(repo: &Repo, steps: &Steps, f: &Fold<'_>) -> Result {
    let dev = Dev::new(repo);
    dev.up()?;
    if f.source == f.into {
        return Err(Fail::new("a log folds into another database than its own"));
    }
    if f.every < 1 {
        return Err(Fail::new("checkpoints are at least one entry apart"));
    }
    let started = Instant::now();
    let head = number(
        &psql(
            &dev,
            f.source,
            "SELECT coalesce((SELECT n FROM cella.head), 0)",
        )?,
        "the head",
    )?;
    let to = f.to.unwrap_or(head);
    if to > head {
        return Err(Fail::new(format!(
            "{} holds {head} entries, so it folds to no entry past it, not {to}",
            f.source
        )));
    }
    if f.compare && to != head {
        return Err(Fail::new(format!(
            "a compare reads {} as it stands, at entry {head}, so the fold goes there, not to {to}",
            f.source
        )));
    }
    if psql(
        &dev,
        f.source,
        &format!(
            "SELECT EXISTS (SELECT FROM cella.log WHERE n = {} AND receipt IS NULL)",
            to + 1
        ),
    )? == "t"
    {
        return Err(Fail::new(format!(
            "entry {} is an effect of the write entry {to} is in, so the fold stops at the end of that write",
            to + 1
        )));
    }
    let at = match f.from {
        None => {
            repo.install(steps)?;
            steps.run(
                &format!("migrate {}", f.into),
                &mut dev.renew(f.into, None, None),
                quiet,
            )?;
            settle(&dev, f)?;
            psql(
                &dev,
                f.into,
                "SELECT cella.keep_hashes(); SELECT cella.rehash();",
            )?;
            0
        }
        Some(n) => resume(&dev, f, n, to)?,
    };
    since(&dev, f, head, to)?;
    copy(&dev, f, at, to)?;

    let folded = folded(&dev, f.source)?;
    let schemas: Vec<&str> = folded
        .iter()
        .filter(|s| s.1)
        .map(|s| s.0.as_str())
        .collect();
    let mut done = at;
    let mut checkpoints: u32 = 0;
    // The peak memory of the fold's sessions, and what it was by the first
    // checkpoint a tenth of the way, so a peak that grows with the log shows.
    let mut sessions = 0;
    let mut tenth: Option<(i64, u64)> = None;
    let list = array(&schemas);
    let mut checkpointing = 0.0;
    let folding = Instant::now();
    while done < to {
        let want = (done + f.every).min(to);
        let end = number(
            &psql(
                &dev,
                f.into,
                &format!(
                    "SELECT coalesce((SELECT min(n) - 1 FROM cella.log WHERE n > {want} AND n <= {to} AND receipt IS NOT NULL), {to})"
                ),
            )?,
            "a write's end",
        )?;
        let mut call = dev.on(f.into, "psql");
        call.env("PGOPTIONS", UNBOUND).args([
            "-X",
            "-q",
            "-t",
            "-A",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            &format!("CALL cella.fold_log({end})"),
            "-c",
            PEAK,
        ]);
        let called = Steps::read(&mut call).map_err(|e| Fail {
            code: e.code,
            msg: Some(format!(
                "the fold stopped in the write after entry {done}: {}",
                e.msg.unwrap_or_else(|| "see above".into())
            )),
        })?;
        sessions = sessions.max(peak(&called).unwrap_or(0));
        // The state hash from the kept hashes alone, so a checkpoint reads
        // no row of the state.
        let checkpoint = Instant::now();
        psql(
            &dev,
            f.into,
            &format!(
                "INSERT INTO cella.checkpoint (n, hash, state) SELECT n, hash, cella.kept_hash({list}) FROM cella.log WHERE n = {end}
                 ON CONFLICT (n) DO UPDATE SET hash = excluded.hash, state = excluded.state"
            ),
        )?;
        checkpointing += checkpoint.elapsed().as_secs_f64();
        checkpoints += 1;
        done = end;
        if tenth.is_none() && (done - at) * 10 >= to - at {
            tenth = Some((done, sessions));
        }
    }
    let folded_in = folding.elapsed().as_secs_f64();
    // A fold resumed at a checkpoint verifies the log after it, from the
    // checkpoint's entry, which is the source's; a fold from the first
    // entry verifies it whole.
    let mut verify = dev.on(f.into, "psql");
    verify.args([
        "-X",
        "-q",
        "-t",
        "-A",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        &format!("SELECT cella.verify_log({at})"),
        "-c",
        PEAK,
    ]);
    let verified = Steps::read(&mut verify)?;
    sessions = sessions.max(verified.lines().find_map(peak).unwrap_or(0));
    if verified.lines().next() != Some("t") {
        return Err(Fail::new(format!(
            "the log folded into {} does not verify after entry {at}",
            f.into
        )));
    }
    let latest = psql(
        &dev,
        f.into,
        "SELECT n, encode(state, 'hex') FROM cella.checkpoint ORDER BY n DESC LIMIT 1",
    )?;
    println!(
        "folded entries {} to {to} of {} into {} in {:.1}s, {checkpoints} checkpoints; the latest {}; its log verifies",
        at + 1,
        f.source,
        f.into,
        started.elapsed().as_secs_f64(),
        latest.split_once('\t').map_or_else(
            || "none".to_owned(),
            |(n, s)| format!("at entry {n}, state {s}")
        ),
    );
    #[allow(clippy::cast_precision_loss)]
    let rate = (to - at) as f64 / folded_in.max(0.001);
    #[allow(clippy::cast_precision_loss)]
    let each = 1000.0 * checkpointing / f64::from(checkpoints.max(1));
    println!(
        "measured: {rate:.0} entries/s folded, checkpoints hashed; a checkpoint {each:.1} ms; peak memory: its sessions {}{}, beside the shared buffers; this process {}",
        mb(sessions),
        tenth.map_or_else(String::new, |(n, kb)| format!(
            ", {} by entry {n}, a tenth of the way",
            mb(kb)
        )),
        mb(own_peak()),
    );
    if f.compare {
        compare(&dev, f, &folded)
    } else {
        Ok(())
    }
}

/// The fresh database takes the scope's settings from the source, its
/// address among them, which every signature in the log names.
fn settle(dev: &Dev, f: &Fold<'_>) -> Result {
    let set = psql(
        dev,
        f.source,
        &format!(
            "SELECT coalesce(string_agg(format('ALTER DATABASE %I SET %s TO %L', {}, split_part(s, '=', 1), substr(s, strpos(s, '=') + 1)), '; '), '')
             FROM pg_db_role_setting d, unnest(d.setconfig) s
             WHERE d.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database()) AND d.setrole = 0
               AND split_part(s, '=', 1) <> 'cella.unbound'",
            literal(f.into)
        ),
    )?;
    if !set.is_empty() {
        psql(dev, f.into, &set)?;
    }
    Ok(())
}

/// A fold resumed at a checkpoint: the database folded into holds the
/// state there, which hashes to the checkpoint's state, and the entry
/// there is the source's, so its log up to it is the source's too.
fn resume(dev: &Dev, f: &Fold<'_>, n: i64, to: i64) -> Result<i64> {
    let head = psql(
        dev,
        f.into,
        "SELECT coalesce((SELECT n FROM cella.fold_head), 0)",
    )?;
    if number(&head, "the fold's head")? != n {
        return Err(Fail::new(format!(
            "{} is folded to entry {head}, so it resumes there, not at {n}",
            f.into
        )));
    }
    if to < n {
        return Err(Fail::new(format!(
            "{} is folded to entry {n} already, past {to}",
            f.into
        )));
    }
    let point = psql(
        dev,
        f.into,
        &format!(
            "SELECT encode(hash, 'hex'), encode(state, 'hex') FROM cella.checkpoint WHERE n = {n}"
        ),
    )?;
    let Some((entry, state)) = point.split_once('\t') else {
        return Err(Fail::new(format!(
            "{} holds no checkpoint at entry {n}",
            f.into
        )));
    };
    let source = psql(
        dev,
        f.source,
        &format!("SELECT encode(hash, 'hex') FROM cella.log WHERE n = {n}"),
    )?;
    if source != entry {
        return Err(Fail::new(format!(
            "entry {n} of {} is not the one {} was folded to: its log is another's",
            f.source, f.into
        )));
    }
    let folded = folded(dev, f.source)?;
    let schemas: Vec<&str> = folded
        .iter()
        .filter(|s| s.1)
        .map(|s| s.0.as_str())
        .collect();
    // The kept hashes, never the rows: a resume reads nothing of the state.
    psql(dev, f.into, "SELECT cella.keep_hashes()")?;
    let now = psql(
        dev,
        f.into,
        &format!("SELECT encode(cella.kept_hash({}), 'hex')", array(&schemas)),
    )?;
    if now != state {
        return Err(Fail::new(format!(
            "the hashes {} keeps hash to {now}, not to its checkpoint's {state} at entry {n}: they changed since it was folded",
            f.into
        )));
    }
    Ok(n)
}

/// Each fold version's `since` is the source's, so an entry folds by the
/// version in force when it was written; a version the source registers
/// and this tree lacks is refused where an entry folded is under it, and
/// one this tree registers that the source does not is in force for no
/// entry it holds.
fn since(dev: &Dev, f: &Fold<'_>, head: i64, to: i64) -> Result {
    let rows = psql(
        dev,
        f.source,
        "SELECT op, owner, version, since FROM cella.fold ORDER BY 1, 2, 3",
    )?;
    let values: Vec<String> = rows
        .lines()
        .filter_map(|l| {
            let c: Vec<&str> = l.split('\t').collect();
            let [op, owner, version, since] = c[..] else {
                return None;
            };
            Some(format!(
                "({}, {}, {version}, {since})",
                literal(op),
                literal(owner)
            ))
        })
        .collect();
    if values.is_empty() {
        return psql(
            dev,
            f.into,
            &format!("UPDATE cella.fold SET since = {}", head + 1),
        )
        .map(|_| ());
    }
    let source = format!(
        "(VALUES {}) s(op, owner, version, since)",
        values.join(", ")
    );
    let lacking = psql(
        dev,
        f.into,
        &format!(
            "SELECT coalesce(string_agg(s.op || ' by ' || s.owner || ' at version ' || s.version, ', '), '') FROM {source}
             WHERE s.since <= {to} AND NOT EXISTS (SELECT FROM cella.fold x WHERE (x.op, x.owner, x.version) = (s.op, s.owner, s.version))"
        ),
    )?;
    if !lacking.is_empty() {
        return Err(Fail::new(format!(
            "{} folds by versions this tree lacks: {lacking}; fold it with the tree that wrote it",
            f.source
        )));
    }
    psql(
        dev,
        f.into,
        &format!(
            "UPDATE cella.fold x SET since = coalesce((SELECT s.since FROM {source} WHERE (s.op, s.owner, s.version) = (x.op, x.owner, x.version)), {})",
            head + 1
        ),
    )
    .map(|_| ())
}

/// Streams the source's signers, receipts and entries after `at` up to
/// `to` into the database folded into, by `COPY` from one psql into the
/// other, each receipt with the entry it keeps, and moves its head to
/// `to`. A receipt's salt stays behind: it is the owner's, and the fold
/// reads no request.
fn copy(dev: &Dev, f: &Fold<'_>, at: i64, to: i64) -> Result {
    let tables = [
        ("cella.signer (id, public, since)", format!("SELECT id, public, since FROM cella.signer WHERE since > {at} AND since <= {to} ORDER BY id")),
        (
            "cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, entry)",
            format!(
                "SELECT r.n, r.op, r.actor, r.device, r.nonce, r.request, r.signature, r.payload, r.at, r.hash, r.sig, r.key, r.entry
                 FROM cella.receipt r JOIN cella.log l ON l.receipt = r.n WHERE l.n > {at} AND l.n <= {to} ORDER BY l.n"
            ),
        ),
        (
            "cella.log (n, op, actor, date, payload, form, receipt, guards, prev, hash, sig, key, cause, cause_hash, settled)",
            format!(
                "SELECT n, op, actor, date, payload, form, receipt, guards, prev, hash, sig, key, cause, cause_hash, settled
                 FROM cella.log WHERE n > {at} AND n <= {to} ORDER BY n"
            ),
        ),
    ];
    for (table, rows) in tables {
        let mut out = dev.on(f.source, "psql");
        out.args([
            "-X",
            "-q",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            &format!("COPY ({rows}) TO STDOUT"),
        ])
        .stdout(Stdio::piped());
        let mut reading = out.spawn().map_err(|e| Fail::new(format!("psql: {e}")))?;
        let Some(stream) = reading.stdout.take() else {
            return Err(Fail::new("psql: no pipe from the source"));
        };
        let mut into = dev.on(f.into, "psql");
        into.args([
            "-X",
            "-q",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            &format!("COPY {table} FROM STDIN"),
        ])
        .stdin(stream);
        let written = Steps::read(&mut into);
        let read = reading
            .wait()
            .map_err(|e| Fail::new(format!("psql: {e}")))?;
        written?;
        if !read.success() {
            return Err(Fail::new(format!(
                "reading {table} from {} failed",
                f.source
            )));
        }
    }
    if to > at {
        psql(
            dev,
            f.into,
            &format!(
                "INSERT INTO cella.head (one, n, hash) SELECT true, n, hash FROM cella.log WHERE n = {to} ON CONFLICT (one) DO UPDATE SET n = excluded.n, hash = excluded.hash"
            ),
        )?;
    }
    Ok(())
}

/// Each slice's schema, whether it is folded, and its actions with no fold,
/// as the source's registries and log say. The list, empty for a folded
/// slice, comes between the two, since the output's last line loses its
/// trailing tab.
fn folded(dev: &Dev, db: &str) -> Result<Vec<(String, bool, String)>> {
    let rows = psql(
        dev,
        db,
        "SELECT schema, array_to_string(unfolded, ', '), folded FROM cella.folded()",
    )?;
    Ok(rows
        .lines()
        .filter_map(|l| {
            let c: Vec<&str> = l.split('\t').collect();
            let [schema, unfolded, folded] = c[..] else {
                return None;
            };
            Some((schema.to_owned(), folded == "t", unfolded.to_owned()))
        })
        .collect())
}

/// The rows of the schemas' state tables, or of one of them, in canonical
/// order, as `cella.state_rows` gives them, streamed out of psql one line
/// at a time.
struct Rows {
    db: String,
    child: Child,
    lines: BufReader<ChildStdout>,
    /// The peak memory of the session, in kB, from its last line.
    peak: u64,
}

impl Rows {
    fn open(dev: &Dev, db: &str, schemas: &[&str], table: Option<&str>) -> Result<Self> {
        let list = schemas
            .iter()
            .map(|s| literal(s))
            .collect::<Vec<_>>()
            .join(", ");
        let only = table.map_or_else(String::new, |t| format!(" WHERE tab = {}", literal(t)));
        let mut cmd = dev.on(db, "psql");
        cmd.args([
            "-X",
            "-q",
            "-t",
            "-A",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            &format!(
                "COPY (SELECT tab, r FROM cella.state_rows(ARRAY[{list}]::text[]){only}) TO STDOUT"
            ),
            "-c",
            PEAK,
        ])
        .stdout(Stdio::piped());
        let mut child = cmd.spawn().map_err(|e| Fail::new(format!("psql: {e}")))?;
        let Some(out) = child.stdout.take() else {
            return Err(Fail::new("psql: no pipe from the state"));
        };
        Ok(Self {
            db: db.to_owned(),
            child,
            lines: BufReader::new(out),
            peak: 0,
        })
    }

    /// The next row line, without its newline; none at the end, where the
    /// session names its peak.
    fn next(&mut self) -> Result<Option<String>> {
        let mut line = String::new();
        if self
            .lines
            .read_line(&mut line)
            .map_err(|e| Fail::new(format!("psql: {e}")))?
            == 0
        {
            return Ok(None);
        }
        line.truncate(line.trim_end_matches('\n').len());
        if let Some(kb) = peak(&line) {
            self.peak = kb;
            return Ok(None);
        }
        Ok(Some(line))
    }

    fn close(mut self) -> Result {
        let status = self
            .child
            .wait()
            .map_err(|e| Fail::new(format!("psql: {e}")))?;
        if !status.success() {
            return Err(Fail::new(format!(
                "reading the state of {} failed",
                self.db
            )));
        }
        Ok(())
    }
}

/// The schemas as an SQL array.
fn array(schemas: &[&str]) -> String {
    format!(
        "ARRAY[{}]::text[]",
        schemas
            .iter()
            .map(|s| literal(s))
            .collect::<Vec<_>>()
            .join(", ")
    )
}

/// Each of the schemas' state tables' multiset hashes, by name, in hex:
/// from scratch, every row read (`cella.table_hashes`), or as the fold
/// kept them as it wrote (`cella.table_hash`), reading no row.
fn tables(dev: &Dev, db: &str, schemas: &[&str], kept: bool) -> Result<BTreeMap<String, String>> {
    let list = array(schemas);
    let sql = if kept {
        format!(
            "SELECT h.tab, encode(h.hash, 'hex') FROM cella.state_tables({list}) t JOIN cella.table_hash h ON h.tab = t.schema || '.' || t.tab"
        )
    } else {
        format!("SELECT tab, encode(hash, 'hex') FROM cella.table_hashes({list})")
    };
    Ok(psql(dev, db, &sql)?
        .lines()
        .filter_map(|l| l.split_once('\t'))
        .map(|(t, h)| (t.to_owned(), h.to_owned()))
        .collect())
}

/// The state hash of the tables' hashes, as `cella.state_of` gives it: the
/// BLAKE3 of a line for each table by name, its name, a tab and its hash.
fn state(tables: &BTreeMap<String, String>) -> [u8; 32] {
    let lines: Vec<String> = tables.iter().map(|(t, h)| format!("{t}\t{h}")).collect();
    *blake3::hash(lines.join("\n").as_bytes()).as_bytes()
}

/// How many differing rows of a table a compare shows on each side.
const SHOWN: usize = 3;

/// Compares the source's folded slices with the fold's: first the hashes
/// the fold kept as it wrote with its rows hashed from scratch, which
/// differ where a row was written around the fold, naming each table; then
/// equal state hashes match; otherwise each table that differs is read on both sides
/// in its canonical order and merged, and the rows only one side holds are
/// shown, a few of each. A slice not folded is one the compare cannot
/// cover, so it fails too, naming it, even where every folded row matches.
fn compare(dev: &Dev, f: &Fold<'_>, folded: &[(String, bool, String)]) -> Result {
    let schemas: Vec<&str> = folded
        .iter()
        .filter(|s| s.1)
        .map(|s| s.0.as_str())
        .collect();
    let unfolded: Vec<String> = folded
        .iter()
        .filter(|s| !s.1)
        .map(|s| s.0.clone())
        .collect();
    let our_tables = tables(dev, f.source, &schemas, false)?;
    let their_tables = tables(dev, f.into, &schemas, false)?;
    let kept = tables(dev, f.into, &schemas, true)?;
    if kept != their_tables {
        let drifts: Vec<&str> = their_tables
            .keys()
            .filter(|t| kept.get(*t) != their_tables.get(*t))
            .map(String::as_str)
            .collect();
        return Err(Fail::new(format!(
            "compare: the hashes {} keeps drift from its rows in {}: a row was written there around the fold",
            f.into,
            drifts.join(", ")
        )));
    }
    let (ours, theirs) = (state(&our_tables), state(&their_tables));
    let not = if unfolded.is_empty() {
        String::new()
    } else {
        format!(
            "; {} slices not folded, which the compare cannot cover: {}",
            unfolded.len(),
            unfolded.join(", ")
        )
    };
    if ours == theirs {
        println!(
            "compare: {} folded, {} matches {} row for row, state {}{not}",
            schemas.join(", "),
            f.into,
            f.source,
            hex(&ours)
        );
        return if unfolded.is_empty() {
            Ok(())
        } else {
            Err(Fail::new(format!(
                "compare: {} slices are not folded, so the compare covers none of their rows: {}",
                unfolded.len(),
                unfolded.join(", ")
            )))
        };
    }
    let mut said = Vec::new();
    let names: std::collections::BTreeSet<&String> =
        our_tables.keys().chain(their_tables.keys()).collect();
    for table in names {
        if our_tables.get(table) == their_tables.get(table) {
            continue;
        }
        let (only_source, only_fold) = differ(dev, f, &schemas, table)?;
        said.push(format!(
            "{table}: {} rows only in {}, {} only in {}",
            only_source.0, f.source, only_fold.0, f.into
        ));
        said.extend(only_source.1.iter().map(|r| format!("  - {r}")));
        said.extend(only_fold.1.iter().map(|r| format!("  + {r}")));
    }
    Err(Fail::new(format!(
        "compare: {} differs from {}{not}\n{}",
        f.into,
        f.source,
        said.join("\n")
    )))
}

/// How many rows only one side holds, and the first few of them.
type Only = (usize, Vec<String>);

/// The rows of one table only the source holds and only the fold holds,
/// by merging the two sorted streams as they arrive, one row of each held;
/// a row both hold the same number of times matches.
fn differ(dev: &Dev, f: &Fold<'_>, schemas: &[&str], table: &str) -> Result<(Only, Only)> {
    let mut a = Rows::open(dev, f.source, schemas, Some(table))?;
    let mut b = Rows::open(dev, f.into, schemas, Some(table))?;
    let only = merge(|| a.next(), || b.next())?;
    a.close()?;
    b.close()?;
    Ok(only)
}

/// A row line without its table.
fn row(line: String) -> String {
    match line.split_once('\t') {
        Some((_, r)) => r.to_owned(),
        None => line,
    }
}

/// The rows only `a` gives and only `b` gives, each in bytewise order.
fn merge(
    mut source: impl FnMut() -> Result<Option<String>>,
    mut fold: impl FnMut() -> Result<Option<String>>,
) -> Result<(Only, Only)> {
    let note = |side: &mut Only, r: String| {
        side.0 += 1;
        if side.1.len() < SHOWN {
            side.1.push(r);
        }
    };
    let mut left: Only = (0, Vec::new());
    let mut right: Only = (0, Vec::new());
    let (mut ours, mut theirs) = (source()?.map(row), fold()?.map(row));
    loop {
        let only_ours = match (&ours, &theirs) {
            (None, None) => return Ok((left, right)),
            (Some(o), Some(t)) if o == t => {
                (ours, theirs) = (source()?.map(row), fold()?.map(row));
                continue;
            }
            (Some(o), Some(t)) => o.as_bytes() < t.as_bytes(),
            (Some(_), None) => true,
            (None, Some(_)) => false,
        };
        if only_ours {
            if let Some(o) = ours.take() {
                note(&mut left, o);
            }
            ours = source()?.map(row);
        } else {
            if let Some(t) = theirs.take() {
                note(&mut right, t);
            }
            theirs = fold()?.map(row);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_state_hash_is_the_tables_hashes_by_name() {
        let of = |v: &[(&str, &str)]| -> BTreeMap<String, String> {
            v.iter()
                .map(|(t, h)| ((*t).to_owned(), (*h).to_owned()))
                .collect()
        };
        let one = of(&[("circle.role", "00ff"), ("circle.circle", "ab01")]);
        // A line a table, by name, bytewise, as `cella.state_of` reads them.
        assert_eq!(
            state(&one),
            *blake3::hash(b"circle.circle\tab01\ncircle.role\t00ff").as_bytes()
        );
        // A hash moved from one table to another is another state.
        let moved = of(&[("circle.role", "ab01"), ("circle.circle", "00ff")]);
        assert_ne!(state(&one), state(&moved));
    }

    #[test]
    fn a_merge_names_the_rows_only_one_side_holds() {
        let s = |v: &[&str]| v.iter().map(|x| format!("t\t{x}")).collect::<Vec<_>>();
        let of = |v: Vec<String>| {
            let mut it = v.into_iter();
            move || Ok(it.next())
        };
        let shown = |v: &[&str]| v.iter().map(|x| (*x).to_owned()).collect::<Vec<_>>();
        let (left, right) = merge(
            of(s(&["a", "b", "b", "d"])),
            of(s(&["a", "b", "c", "d", "e"])),
        )
        .ok()
        .expect("a merge");
        assert_eq!(left, (1, shown(&["b"])));
        assert_eq!(right, (2, shown(&["c", "e"])));
        let (left, right) = merge(of(s(&["x"; 5])), of(Vec::new()))
            .ok()
            .expect("a merge");
        assert_eq!((left.0, left.1.len(), right.0), (5, SHOWN, 0));
    }
}
