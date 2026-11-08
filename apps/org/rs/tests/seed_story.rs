//! A seed story is the same signed series the e2e test plays, but is left
//! in the dev database rather than dropped after its fold.
use std::process::Command;
use std::sync::Mutex;

// Both resets migrate the same cluster and install its roles; do not race DDL.
static CLUSTER: Mutex<()> = Mutex::new(());

fn cella(db: &str, args: &[&str]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_cella"))
        .args(args)
        .env("CELLA_DB", db)
        .output()
        .expect("cella binary")
}

#[test]
fn governance_is_left_in_the_dev_database() {
    let _cluster = CLUSTER.lock().unwrap();
    let db = format!("seed_governance_{}", std::process::id());
    let reset = cella(&db, &["db", "reset"]);
    assert!(
        reset.status.success(),
        "{}",
        String::from_utf8_lossy(&reset.stderr)
    );
    let result = (|| {
        let seeded = cella(&db, &["seed", "lanterne", "--scenario", "governance"]);
        assert!(
            seeded.status.success(),
            "{}",
            String::from_utf8_lossy(&seeded.stderr)
        );
        assert!(String::from_utf8_lossy(&seeded.stdout).contains("governance story played"));
        let mut psql = Command::new("psql");
        psql.args(["-X", "-q", "-t", "-A", "-h", "127.0.0.1", "-p"])
            .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
            .args([
                "-U",
                "postgres",
                "-d",
                &db,
                "-c",
                "SELECT count(*) FROM motion.motion WHERE closed IS NOT NULL AND id <> 'm-2021-001'",
            ]);
        let rows = psql.output().expect("psql");
        assert!(
            rows.status.success(),
            "{}",
            String::from_utf8_lossy(&rows.stderr)
        );
        assert!(
            String::from_utf8_lossy(&rows.stdout)
                .trim()
                .parse::<usize>()
                .unwrap()
                > 0
        );
        let verify = cella(&db, &["log", "verify"]);
        assert!(
            verify.status.success(),
            "{}",
            String::from_utf8_lossy(&verify.stderr)
        );
        let again = cella(&db, &["seed", "lanterne", "--scenario", "governance"]);
        assert!(!again.status.success());
        assert!(String::from_utf8_lossy(&again.stderr).contains("cella db reset"));
    })();
    let drop = Command::new("dropdb")
        .args(["--if-exists", "--force", "-h", "127.0.0.1", "-p"])
        .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
        .args(["-U", "postgres", &db])
        .output()
        .expect("dropdb");
    assert!(
        drop.status.success(),
        "{}",
        String::from_utf8_lossy(&drop.stderr)
    );
    result
}

#[test]
fn two_stories_are_refused_before_founding() {
    let _cluster = CLUSTER.lock().unwrap();
    let db = format!("seed_two_stories_{}", std::process::id());
    let reset = cella(&db, &["db", "reset"]);
    assert!(
        reset.status.success(),
        "{}",
        String::from_utf8_lossy(&reset.stderr)
    );
    let result = (|| {
        let seeded = cella(
            &db,
            &[
                "seed",
                "lanterne",
                "--scenario",
                "governance",
                "--scenario",
                "authority",
            ],
        );
        assert!(!seeded.status.success());
        let error = String::from_utf8_lossy(&seeded.stderr);
        assert!(
            error.contains("seed one story") && error.contains("cella db reset"),
            "{error}"
        );
        let rows = Command::new("psql")
            .args(["-X", "-q", "-t", "-A", "-h", "127.0.0.1", "-p"])
            .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
            .args([
                "-U",
                "postgres",
                "-d",
                &db,
                "-c",
                "SELECT count(*) FROM cella.log",
            ])
            .output()
            .expect("psql");
        assert!(
            rows.status.success(),
            "{}",
            String::from_utf8_lossy(&rows.stderr)
        );
        assert_eq!(String::from_utf8_lossy(&rows.stdout).trim(), "0");
    })();
    let drop = Command::new("dropdb")
        .args(["--if-exists", "--force", "-h", "127.0.0.1", "-p"])
        .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
        .args(["-U", "postgres", &db])
        .output()
        .expect("dropdb");
    assert!(
        drop.status.success(),
        "{}",
        String::from_utf8_lossy(&drop.stderr)
    );
    result
}

#[test]
fn authority_is_left_in_the_dev_database() {
    let _cluster = CLUSTER.lock().unwrap();
    let db = format!("seed_authority_{}", std::process::id());
    let reset = cella(&db, &["db", "reset"]);
    assert!(
        reset.status.success(),
        "{}",
        String::from_utf8_lossy(&reset.stderr)
    );
    let result = (|| {
        let seeded = cella(&db, &["seed", "lanterne", "--scenario", "authority"]);
        assert!(
            seeded.status.success(),
            "{}",
            String::from_utf8_lossy(&seeded.stderr)
        );
        assert!(String::from_utf8_lossy(&seeded.stdout).contains("authority story played"));
        let rows = Command::new("psql")
            .args(["-X", "-q", "-t", "-A", "-h", "127.0.0.1", "-p"])
            .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
            .args([
                "-U",
                "postgres",
                "-d",
                &db,
                "-c",
                "SELECT count(*) FROM cella.log",
            ])
            .output()
            .expect("psql");
        assert!(
            rows.status.success(),
            "{}",
            String::from_utf8_lossy(&rows.stderr)
        );
        assert!(
            String::from_utf8_lossy(&rows.stdout)
                .trim()
                .parse::<usize>()
                .unwrap()
                > 1
        );
        let verify = cella(&db, &["log", "verify"]);
        assert!(
            verify.status.success(),
            "{}",
            String::from_utf8_lossy(&verify.stderr)
        );
    })();
    let drop = Command::new("dropdb")
        .args(["--if-exists", "--force", "-h", "127.0.0.1", "-p"])
        .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
        .args(["-U", "postgres", &db])
        .output()
        .expect("dropdb");
    assert!(
        drop.status.success(),
        "{}",
        String::from_utf8_lossy(&drop.stderr)
    );
    result
}

/// Seeds a fresh database with Lanterne and the story named, checks that it
/// played and that the log verifies, and answers what `sql` reads there.
fn seeded(story: &str, sql: &str) -> String {
    let _cluster = CLUSTER.lock().unwrap_or_else(|e| e.into_inner());
    let db = format!("seed_{story}_{}", std::process::id());
    let reset = cella(&db, &["db", "reset"]);
    assert!(
        reset.status.success(),
        "{}",
        String::from_utf8_lossy(&reset.stderr)
    );
    let result = std::panic::catch_unwind(|| {
        let seeded = cella(&db, &["seed", "lanterne", "--scenario", story]);
        assert!(
            seeded.status.success(),
            "{}",
            String::from_utf8_lossy(&seeded.stderr)
        );
        assert!(String::from_utf8_lossy(&seeded.stdout).contains(&format!("{story} story played")));
        let verify = cella(&db, &["log", "verify"]);
        assert!(
            verify.status.success(),
            "{}",
            String::from_utf8_lossy(&verify.stderr)
        );
        let rows = Command::new("psql")
            .args(["-X", "-q", "-t", "-A", "-F", " ", "-h", "127.0.0.1", "-p"])
            .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
            .args(["-U", "postgres", "-d", &db, "-c", sql])
            .output()
            .expect("psql");
        assert!(
            rows.status.success(),
            "{}",
            String::from_utf8_lossy(&rows.stderr)
        );
        String::from_utf8_lossy(&rows.stdout).trim().to_owned()
    });
    let drop = Command::new("dropdb")
        .args(["--if-exists", "--force", "-h", "127.0.0.1", "-p"])
        .arg(std::env::var("CELLA_PGPORT").unwrap_or_else(|_| "54342".into()))
        .args(["-U", "postgres", &db])
        .output()
        .expect("dropdb");
    assert!(
        drop.status.success(),
        "{}",
        String::from_utf8_lossy(&drop.stderr)
    );
    result.unwrap_or_else(|e| std::panic::resume_unwind(e))
}

#[test]
fn chain_leaves_its_two_motions_open() {
    let open = seeded(
        "chain",
        "SELECT string_agg(id, ' ' ORDER BY id) FROM motion.motion \
         WHERE id IN ('m-2026-013', 'm-2026-014') AND closed IS NULL",
    );
    assert_eq!(open, "m-2026-013 m-2026-014");
}

#[test]
fn powers_reads_the_founded_co_op_and_writes_nothing() {
    assert_eq!(seeded("powers", "SELECT count(*) FROM cella.log"), "1");
}

#[test]
fn grant_leaves_send_quote_granted_under_coordination_and_revoked_with_it() {
    let revoked = seeded(
        "grant",
        "SELECT string_agg(DISTINCT m.grantee, ' ' ORDER BY m.grantee) FROM circle.mandate m \
         WHERE m.power = 'send-quote' AND m.revoked = '2026-12-07'",
    );
    assert_eq!(revoked, "coordination finance");
}

#[test]
fn refusal_leaves_the_leads_set_budget_revoked() {
    let revoked = seeded(
        "refusal",
        "SELECT to_char(revoked, 'YYYY-MM-DD') FROM circle.mandate \
         WHERE grantee = 'lead' AND power = 'set-budget' AND revoked IS NOT NULL",
    );
    assert_eq!(revoked, "2026-11-16");
}

#[test]
fn author_leaves_motions_put_by_a_held_role_and_by_a_circle() {
    let authors = seeded(
        "author",
        "SELECT string_agg(author, ' ' ORDER BY title) FROM motion.motion \
         WHERE title IN ('The gérante asks the assembly', 'The assembly asks itself')",
    );
    assert_eq!(authors, "ag manager");
}

#[test]
fn tenure_leaves_web_s_lead_with_lea() {
    let lead = seeded(
        "tenure",
        "SELECT string_agg(holder, ' ') FROM circle.tenure \
         WHERE circle = 'web' AND role = 'lead' AND until IS NULL",
    );
    assert_eq!(lead, "lea@lanterne.example");
}

#[test]
fn role_seat_leaves_finance_s_seat_in_brand_ended() {
    let seat = seeded(
        "role-seat",
        "SELECT to_char(since, 'YYYY-MM-DD') || ' ' || to_char(until, 'YYYY-MM-DD') \
         FROM circle.member WHERE circle = 'brand' AND role = 'finance'",
    );
    assert_eq!(seat, "2026-10-31 2026-11-14");
}

#[test]
fn collective_leaves_ines_admitted_under_the_assembly_s_mandate() {
    let status = seeded(
        "collective",
        "SELECT status FROM membership.member WHERE address = 'ines@lanterne.example'",
    );
    assert_eq!(status, "active");
}
