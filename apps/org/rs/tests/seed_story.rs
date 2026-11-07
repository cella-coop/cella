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
