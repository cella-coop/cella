//! The notary's own tests, run in Postgres by `cella test notary`: the
//! member's signature, the payload restating the request, the nonce, the
//! keyring, the guards, the chain, the verdict date's day, and a write
//! begun before its state, which alone a state table takes rows from.
//! Each runs in a transaction pgrx rolls back, on a keyring and devices of
//! its own; the notary signs with a TEST-ONLY seed that `pg_test::setup`
//! writes to the cluster's key file.

use pgrx::prelude::*;

/// The notary's TEST-ONLY seed: never a scope's key.
pub const NOTARY_SEED: [u8; 32] = [7; 32];

/// The vault's TEST-ONLY key.
pub const VAULT_KEY: [u8; 32] = [9; 32];

/// `cella.op()`, as every version before 0.6.0 binds it: the earlier
/// library's symbol, which the test build alone keeps so that each earlier
/// version installs on it. It declares no SQL of its own.
#[pg_extern(stable, sql = false)]
fn op() -> Option<String> {
    crate::notary::action()
}

#[pg_schema]
mod tests {
    use super::NOTARY_SEED;
    use cella_guards::hex::hex;
    use cella_guards::log::{self, Basis, Entry, Key, Receipt};
    use cella_guards::sign::{self, Request};
    use cella_guards::vault;
    use ed25519_dalek::{Signer, SigningKey};
    use pgrx::JsonB;
    use pgrx::prelude::*;
    use serde_json::{Value, json};

    const SCOPE: &str = "test.example";
    const JULIEN: &str = "julien@test.example";
    const CAMILLE: &str = "camille@test.example";
    const OP: &str = "test:thing:make";
    const SALT: &str = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    const NONCE: &str = "0123456789abcdef0123456789abcdef";

    /// Takes the tests' lock shared, as every test opens: it waits while
    /// one runs [`alone`], and lets go as its transaction rolls back.
    fn beside() {
        Spi::run("SELECT pg_advisory_xact_lock_shared(hashtext('cella test notary'))")
            .expect("the tests' lock, shared");
    }

    /// Takes the tests' lock exclusive, as a test that drops what the others
    /// read opens: it waits for every test begun [`beside`] it, and none
    /// begins until it rolls back.
    fn alone() {
        Spi::run("SELECT pg_advisory_xact_lock(hashtext('cella test notary'))")
            .expect("the tests' lock, exclusive");
    }

    /// A member's device, from a TEST-ONLY seed.
    fn device(seed: u8) -> SigningKey {
        SigningKey::from_bytes(&[seed; 32])
    }

    /// The scope, a fixed verdict date, the guards role as the org core
    /// grants it, a keyring over
    /// `t.device`, Julien's device 1 and Camille's device 2 enrolled, and
    /// `t.attempt`, which begins a write and submits it, and `t.tries`,
    /// which runs a statement, each answering the error it raised, if
    /// any, as `SQLSTATE message`.
    fn scope() {
        Spi::run(&format!(
            r"
SELECT set_config('cella.scope', '{SCOPE}', true), set_config('cella.clock', '2026-10-25', true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_guards') THEN
    CREATE ROLE cella_guards NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;
CREATE SCHEMA t;
CREATE TABLE t.device (actor text NOT NULL, device bytea NOT NULL, revoked boolean NOT NULL DEFAULT false);
CREATE FUNCTION t.keyring(actor text, device bytea) RETURNS text LANGUAGE sql STABLE AS $f$
  SELECT CASE WHEN EXISTS (SELECT FROM t.device d WHERE d.actor = $1 AND d.device = $2 AND NOT d.revoked) THEN NULL
    ELSE 'the device is not a current key of ' || $1 END
$f$;
GRANT USAGE ON SCHEMA cella, t TO cella_guards;
GRANT SELECT ON t.device TO cella_guards;
INSERT INTO cella.keyring (fn, owner) VALUES ('t.keyring(text, bytea)', 't');
INSERT INTO t.device (actor, device) VALUES ('{JULIEN}', '\x{julien}'), ('{CAMILLE}', '\x{camille}');
CREATE FUNCTION t.attempt(op text, payload jsonb, actor text, signed jsonb) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM cella.begin(op, actor, decode(signed->>'device', 'hex'));
  PERFORM cella.submit(op, payload, actor, signed);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END
$f$;
CREATE FUNCTION t.tries(statement text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE statement;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END
$f$;
CREATE FUNCTION t.breaks(tamper text) RETURNS boolean LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE tamper;
  RAISE EXCEPTION '%', cella.verify_log();
EXCEPTION WHEN raise_exception THEN
  RETURN NOT SQLERRM::boolean;
END
$f$;
",
            julien = hex(&device(1).verifying_key().to_bytes()),
            camille = hex(&device(2).verifying_key().to_bytes()),
        ))
        .expect("the test scope");
    }

    /// What a handler passes as `signed`: the request, signed by `key` as
    /// `actor`'s device in `scope`.
    fn signed_in(
        scope: &str,
        key: &SigningKey,
        op: &str,
        actor: &str,
        request: &Value,
        nonce: &str,
    ) -> Value {
        let digest = sign::request_digest(request, SALT).expect("a digest");
        let device = key.verifying_key().to_bytes();
        let r = Request {
            scope,
            op,
            actor,
            device,
            digest,
            nonce,
        };
        let sig = key
            .sign(r.message().expect("a message").as_bytes())
            .to_bytes();
        json!({ "request": request, "device": hex(&device), "salt": SALT, "nonce": nonce, "sig": hex(&sig) })
    }

    fn signed(key: &SigningKey, actor: &str, request: &Value, nonce: &str) -> Value {
        signed_in(SCOPE, key, OP, actor, request, nonce)
    }

    /// Submits a write; `None` when it settles, else the error it raised.
    fn attempt(payload: &Value, actor: &str, signed: &Value) -> Option<String> {
        Spi::get_one_with_args::<String>(
            "SELECT t.attempt($1, $2, $3, $4)",
            &[
                OP.into(),
                JsonB(payload.clone()).into(),
                actor.into(),
                JsonB(signed.clone()).into(),
            ],
        )
        .expect("an attempt")
    }

    fn refused(payload: &Value, actor: &str, signed: &Value, why: &str) {
        let error = attempt(payload, actor, signed).expect("a refusal");
        assert!(error.starts_with("09000 "), "not a refusal: {error}");
        assert!(error.contains(why), "refused for another reason: {error}");
        assert_eq!(head(), 0, "a refusal takes no verdict");
    }

    fn head() -> i64 {
        Spi::get_one::<i64>("SELECT coalesce((SELECT n FROM cella.head), 0)")
            .expect("the head")
            .expect("a number")
    }

    fn verifies() -> bool {
        Spi::get_one::<bool>("SELECT cella.verify_log()")
            .expect("verify_log")
            .expect("a verdict")
    }

    fn settle(cents: i64) -> i64 {
        let request = json!({ "cents": cents });
        assert_eq!(
            attempt(
                &request,
                JULIEN,
                &signed(&device(1), JULIEN, &request, NONCE)
            ),
            None
        );
        Spi::get_one::<i64>("SELECT receipt FROM cella.log WHERE n = 1")
            .expect("the entry")
            .expect("its receipt")
    }

    #[pg_test]
    fn a_signed_write_settles_and_keeps_what_was_signed() {
        beside();
        scope();
        let receipt = settle(100);
        assert_eq!(head(), 1);
        assert!(verifies());
        let salt = Spi::get_one_with_args::<String>(
            "SELECT salt FROM cella.receipt WHERE n = $1",
            &[receipt.into()],
        );
        assert_eq!(salt.expect("the salt").as_deref(), Some(SALT));
        let signer = Spi::get_one::<Vec<u8>>(
            "SELECT public FROM cella.signer WHERE id = (SELECT key FROM cella.log WHERE n = 1)",
        );
        assert_eq!(
            signer.expect("the signer"),
            Some(
                Key::from_seed(&NOTARY_SEED)
                    .expect("the seed")
                    .public()
                    .to_vec()
            )
        );
        let kept = |n: i64, request: Value| {
            Spi::get_one_with_args::<bool>(
                "SELECT cella.signed($1, $2)",
                &[n.into(), JsonB(request).into()],
            )
            .expect("signed")
        };
        assert_eq!(kept(receipt, json!({ "cents": 100 })), Some(true));
        assert_eq!(kept(receipt, json!({ "cents": 101 })), Some(false));
        assert_eq!(kept(receipt + 1000, json!({ "cents": 100 })), None);
    }

    #[pg_test]
    fn the_salt_and_signed_are_the_owners() {
        beside();
        scope();
        let public = |what: &str| {
            Spi::get_one_with_args::<bool>(
                "SELECT has_column_privilege('public', 'cella.receipt', $1, 'SELECT')",
                &[what.into()],
            )
            .expect("a privilege")
        };
        assert_eq!(public("salt"), Some(false));
        assert_eq!(public("request"), Some(true));
        let call = Spi::get_one::<bool>(
            "SELECT has_function_privilege('public', 'cella.signed(bigint, jsonb)', 'EXECUTE')",
        );
        assert_eq!(call.expect("a privilege"), Some(false));
    }

    #[pg_test]
    fn an_unsigned_write_is_refused() {
        beside();
        scope();
        refused(
            &json!({ "cents": 100 }),
            JULIEN,
            &json!({}),
            "is not signed",
        );
    }

    #[pg_test]
    fn a_signature_by_another_key_is_refused() {
        beside();
        scope();
        let request = json!({ "cents": 100 });
        let mut forged = signed(&device(3), JULIEN, &request, NONCE);
        forged["device"] = json!(hex(&device(1).verifying_key().to_bytes()));
        refused(&request, JULIEN, &forged, "the signature does not verify");
    }

    #[pg_test]
    fn a_request_swapped_under_its_signature_is_refused() {
        beside();
        scope();
        let mut swapped = signed(&device(1), JULIEN, &json!({ "cents": 100 }), NONCE);
        swapped["request"] = json!({ "cents": 900 });
        refused(
            &json!({ "cents": 900 }),
            JULIEN,
            &swapped,
            "the signature does not verify",
        );
    }

    #[pg_test]
    fn a_signature_names_its_scope_op_and_actor() {
        beside();
        scope();
        let request = json!({ "cents": 100 });
        let elsewhere = signed_in("other.example", &device(1), OP, JULIEN, &request, NONCE);
        refused(
            &request,
            JULIEN,
            &elsewhere,
            "the signature does not verify",
        );
        let another_op = signed_in(
            SCOPE,
            &device(1),
            "test:thing:drop",
            JULIEN,
            &request,
            NONCE,
        );
        refused(
            &request,
            JULIEN,
            &another_op,
            "the signature does not verify",
        );
        refused(
            &request,
            CAMILLE,
            &signed(&device(1), JULIEN, &request, NONCE),
            "the signature does not verify",
        );
    }

    #[pg_test]
    fn a_payload_restates_the_request_or_is_refused() {
        beside();
        scope();
        let request = json!({ "cents": 100, "note": "lunch" });
        let s = signed(&device(1), JULIEN, &request, NONCE);
        refused(
            &json!({ "cents": 900 }),
            JULIEN,
            &s,
            "the payload's cents is not what the member signed",
        );
        assert_eq!(
            attempt(&json!({ "cents": 100, "entry": "7" }), JULIEN, &s),
            None
        );
        assert_eq!(head(), 1);
    }

    #[pg_test]
    fn a_nonce_counts_once() {
        beside();
        scope();
        settle(100);
        // The next write is another transaction's, which begins afresh.
        crate::notary::forget_begun();
        let again = json!({ "cents": 200 });
        let error =
            attempt(&again, JULIEN, &signed(&device(1), JULIEN, &again, NONCE)).expect("a refusal");
        assert!(
            error.starts_with("09000 ") && error.contains("was already counted"),
            "{error}"
        );
        assert_eq!(head(), 1);
    }

    /// Runs a statement; `None` when it passes, else its error.
    fn tries(statement: &str) -> Option<String> {
        Spi::get_one_with_args::<String>("SELECT t.tries($1)", &[statement.into()]).expect("a try")
    }

    fn submits(actor: &str, signed: &Value) -> Option<String> {
        let submit =
            format!("SELECT cella.submit('{OP}', '{{\"cents\": 100}}', '{actor}', '{signed}')");
        tries(&submit)
    }

    #[pg_test]
    fn a_write_not_begun_is_refused() {
        beside();
        scope();
        let request = json!({ "cents": 100 });
        let error =
            submits(JULIEN, &signed(&device(1), JULIEN, &request, NONCE)).expect("a refusal");
        assert!(
            error.starts_with("09000 ") && error.contains("was not begun"),
            "{error}"
        );
        assert_eq!(head(), 0);
    }

    #[pg_test]
    fn a_verdict_settles_only_the_write_begun() {
        beside();
        scope();
        let request = json!({ "cents": 100 });
        let camille = hex(&device(2).verifying_key().to_bytes());
        Spi::run(&format!(
            "SELECT cella.begin('{OP}', '{CAMILLE}', '\\x{camille}')"
        ))
        .expect("a begin");
        let error =
            submits(JULIEN, &signed(&device(1), JULIEN, &request, NONCE)).expect("a refusal");
        assert!(
            error.contains("is not the write this transaction began, test:thing:make by camille"),
            "{error}"
        );
        let again = tries(&format!(
            "SELECT cella.begin('{OP}', '{JULIEN}', '\\x{camille}')"
        ))
        .expect("a refusal");
        assert!(
            again.starts_with("09000 ") && again.contains("opened test:thing:make already"),
            "{again}"
        );
        assert_eq!(head(), 0);
    }

    #[pg_test]
    fn a_state_table_takes_rows_only_inside_a_write() {
        beside();
        scope();
        Spi::run("CREATE TABLE t.thing (n integer); INSERT INTO t.thing VALUES (1)")
            .expect("a table");
        assert_eq!(
            Spi::get_one::<bool>("SELECT cella.notarise('t.thing')").expect("registered"),
            Some(true)
        );
        assert_eq!(
            Spi::get_one::<bool>("SELECT cella.notarise('t.thing')").expect("once"),
            Some(false)
        );
        let listed = Spi::get_one::<bool>(
            "SELECT EXISTS (SELECT FROM cella.state WHERE schema = 't' AND tab = 'thing')",
        )
        .expect("listed");
        assert_eq!(listed, Some(true));
        for statement in [
            "INSERT INTO t.thing VALUES (2)",
            "UPDATE t.thing SET n = 3",
            "DELETE FROM t.thing",
            "TRUNCATE t.thing",
        ] {
            let error = tries(statement).expect("a refusal");
            assert!(
                error.starts_with("09000 ") && error.contains("t.thing is written outside a write"),
                "{statement}: {error}"
            );
        }
        // A savepoint rolled back past the begin undoes it.
        let julien = hex(&device(1).verifying_key().to_bytes());
        let undone = format!(
            "DO $$ BEGIN PERFORM cella.begin('{OP}', '{JULIEN}', '\\x{julien}'); RAISE EXCEPTION 'undone'; END $$"
        );
        assert!(tries(&undone).is_some_and(|e| e.contains("undone")));
        assert!(
            tries("INSERT INTO t.thing VALUES (2)")
                .is_some_and(|e| e.contains("written outside a write"))
        );
        // A superuser may unbind, as the migrations do.
        Spi::run("SET LOCAL cella.unbound = on").expect("unbound");
        assert_eq!(tries("INSERT INTO t.thing VALUES (2)"), None);
        Spi::run("SET LOCAL cella.unbound = off").expect("bound");
        Spi::run(&format!(
            "SELECT cella.begin('{OP}', '{JULIEN}', '\\x{julien}')"
        ))
        .expect("a begin");
        assert_eq!(tries("INSERT INTO t.thing VALUES (3)"), None);
        assert_eq!(
            Spi::get_one::<i64>("SELECT count(*) FROM t.thing").expect("the rows"),
            Some(3)
        );
    }

    #[pg_test]
    fn the_keyring_says_which_devices_are_current() {
        beside();
        scope();
        let request = json!({ "cents": 100 });
        refused(
            &request,
            JULIEN,
            &signed(&device(3), JULIEN, &request, NONCE),
            "the device is not a current key of julien",
        );
        refused(
            &request,
            JULIEN,
            &signed(&device(2), JULIEN, &request, NONCE),
            "the device is not a current key of julien",
        );
        Spi::run("UPDATE t.device SET revoked = true WHERE actor = 'julien@test.example'")
            .expect("a revocation");
        refused(
            &request,
            JULIEN,
            &signed(&device(1), JULIEN, &request, NONCE),
            "the device is not a current key of julien",
        );
    }

    #[pg_test]
    fn no_keyring_no_write() {
        beside();
        scope();
        Spi::run("DELETE FROM cella.keyring").expect("no keyring");
        let request = json!({ "cents": 100 });
        let error = attempt(
            &request,
            JULIEN,
            &signed(&device(1), JULIEN, &request, NONCE),
        )
        .expect("an error");
        assert!(error.contains("no keyring is registered"), "{error}");
    }

    #[pg_test]
    fn a_rule_refuses_with_its_reason() {
        beside();
        scope();
        Spi::run(
            "CREATE FUNCTION t.small(payload jsonb) RETURNS text LANGUAGE sql STABLE AS $f$
               SELECT CASE WHEN (payload->>'cents')::bigint > 500 THEN cella.action() || ' is over 500 cents' END
             $f$;
             INSERT INTO cella.guard (op, fn, owner) VALUES ('test:thing:make', 't.small(jsonb)', 't');",
        )
        .expect("a guard");
        let big = json!({ "cents": 900 });
        refused(
            &big,
            JULIEN,
            &signed(&device(1), JULIEN, &big, NONCE),
            "test:thing:make is over 500 cents",
        );
        settle(100);
        let guards =
            Spi::get_one::<String>("SELECT guards->0->>'function' FROM cella.log WHERE n = 1")
                .expect("the entry's guards");
        assert_eq!(guards.as_deref(), Some("t.small(jsonb)"));
        assert!(verifies());
    }

    /// Each earlier version the notary ships, which `cella test notary`
    /// stages beside the current one, and the function its guards read the
    /// action through: `cella.op()` before 0.6.0.
    const EARLIER: [(&str, &str); 10] = [
        ("0.1.0-alpha", "op"),
        ("0.2.0", "op"),
        ("0.3.0", "op"),
        ("0.4.0", "op"),
        ("0.5.0", "op"),
        ("0.6.0", "action"),
        ("0.7.0", "action"),
        ("0.8.0", "action"),
        ("0.9.0", "action"),
        ("0.10.0", "action"),
    ];

    fn version() -> Option<String> {
        Spi::get_one::<String>("SELECT extversion FROM pg_extension WHERE extname = 'cella'")
            .expect("the version")
    }

    /// It drops the extension every other test reads, so it runs alone; it installs
    /// each earlier version with a guard whose SQL body calls `cella.op()`,
    /// or `cella.action()` from 0.6.0, and updates it to the current one,
    /// where the guard reads the action.
    #[pg_test]
    fn each_earlier_version_upgrades_in_place_and_keeps_the_guards_that_call_it() {
        alone();
        let current = version();
        for (earlier, reads) in EARLIER {
            Spi::run(&format!(
                r"
SELECT set_config('cella.scope', '{SCOPE}', true);
DROP SCHEMA IF EXISTS t, old CASCADE;
DROP EXTENSION cella CASCADE;
CREATE EXTENSION cella VERSION '{earlier}';
CREATE SCHEMA old;
CREATE FUNCTION old.judging(payload jsonb) RETURNS text LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'judging ' || cella.{reads}();
END;
ALTER EXTENSION cella UPDATE;"
            ))
            .expect("the upgrade");
            assert_eq!(
                version(),
                current,
                "{earlier} upgrades to the current version"
            );
            let effects = Spi::get_one::<bool>(
                "SELECT to_regclass('cella.follows') IS NOT NULL AND to_regprocedure('cella.follow(text, jsonb, bigint)') IS NOT NULL
                    AND EXISTS (SELECT FROM pg_constraint WHERE conname = 'log_basis' AND conrelid = 'cella.log'::regclass)",
            );
            assert_eq!(
                effects.expect("the effects"),
                Some(true),
                "{earlier} upgrades to a log that takes effects"
            );
            scope();
            Spi::run(
                "GRANT USAGE ON SCHEMA old TO cella_guards;
                 INSERT INTO cella.guard (op, fn, owner) VALUES ('test:thing:make', 'old.judging(jsonb)', 'old');",
            )
            .expect("the guard");
            let request = json!({ "cents": 100 });
            refused(
                &request,
                JULIEN,
                &signed(&device(1), JULIEN, &request, NONCE),
                "judging test:thing:make",
            );
        }
    }

    #[pg_test]
    fn the_chain_breaks_where_it_is_tampered_with() {
        beside();
        scope();
        settle(100);
        assert!(verifies());
        let breaks = |tamper: &str| {
            Spi::get_one_with_args::<bool>("SELECT t.breaks($1)", &[tamper.into()])
                .expect("a tamper")
                == Some(true)
        };
        for tamper in [
            "UPDATE cella.log SET op = 'test:thing:drop'",
            "UPDATE cella.log SET date = '2026-10-26'",
            "UPDATE cella.log SET form = '{\"cents\": 101}'",
            "UPDATE cella.log SET sig = (SELECT sig FROM cella.receipt)",
            "UPDATE cella.receipt SET actor = 'mallory@test.example'",
            "UPDATE cella.receipt SET at = '2026-01-01T00:00:00.000000Z'",
            "UPDATE cella.head SET n = 2",
            "UPDATE cella.signer SET public = decode(repeat('11', 32), 'hex')",
        ] {
            assert!(breaks(tamper), "the log verified after: {tamper}");
        }
        assert!(verifies(), "each tamper rolled back");
    }

    #[pg_test]
    fn the_log_verifies_after_a_checkpoint_from_its_hash() {
        beside();
        scope();
        settle(100);
        entry_after(first_hash());
        let after = |n: i64| {
            Spi::get_one_with_args::<bool>("SELECT cella.verify_log($1)", &[n.into()])
                .expect("verify_log(after)")
                .expect("a verdict")
        };
        assert!(
            after(0) && after(1) && after(2),
            "each write's end verifies"
        );
        // What precedes the checkpoint is trusted; what follows it is
        // checked as the whole log is.
        Spi::run("UPDATE cella.log SET form = '{\"cents\": 101}' WHERE n = 1").expect("a tamper");
        assert!(!verifies() && !after(0));
        assert!(after(1), "entry 1 is the checkpoint's");
        Spi::run("UPDATE cella.log SET form = '{\"cents\": 201}' WHERE n = 2").expect("a tamper");
        assert!(!after(1));
        assert!(!after(3), "the log holds no entry 3");
    }

    #[pg_test]
    fn a_receipt_no_verdict_names_is_refused_before_a_checkpoint_and_after_it() {
        beside();
        scope();
        // A receipt is numbered before its write locks the head, so entry
        // 2 may name a lower number than entry 1 does. The sequence is not
        // transactional: it stays past every number a test fixes.
        Spi::run(
            "SELECT setval('cella.receipt_seq', greatest(2000000, (SELECT last_value FROM cella.receipt_seq)))",
        )
        .expect("the receipts' numbers");
        let first = settle(100);
        entry_after(first_hash());
        let after = |n: i64| {
            Spi::get_one_with_args::<bool>("SELECT cella.verify_log($1)", &[n.into()])
                .expect("verify_log(after)")
                .expect("a verdict")
        };
        assert!(first > 1_000_000, "entry 1's receipt is above entry 2's");
        assert!(
            verifies() && after(1) && after(2),
            "a receipt numbered out of the log's order verifies"
        );
        let kept = Spi::get_one::<i64>(&format!(
            "SELECT entry FROM cella.receipt WHERE n = {first}"
        ))
        .expect("its entry");
        assert_eq!(kept, Some(1), "a receipt keeps the entry that names it");
        // A receipt naming no verdict, as entry 2's would with its nonce.
        let orphan = |n: i64| {
            Spi::run_with_args(
                "INSERT INTO cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, salt)
                 SELECT $1, op, actor, device, nonce || $1::text, request, signature, payload, at, hash, sig, key, salt
                 FROM cella.receipt WHERE n = 1000000",
                &[n.into()],
            )
            .expect("an orphan receipt");
        };
        let gone =
            || Spi::run("DELETE FROM cella.receipt WHERE entry IS NULL").expect("the orphan gone");
        orphan(999_999);
        assert!(
            !verifies() && !after(1) && !after(2),
            "below the checkpoint's receipts, every verification refuses it"
        );
        gone();
        orphan(first + 1_000_000_000);
        assert!(
            !verifies() && !after(1) && !after(2),
            "above them, every verification refuses it"
        );
        gone();
        assert!(
            verifies() && after(1) && after(2),
            "the orphans gone, it verifies"
        );
        // A receipt keeping an entry the log has not, as one a log cut
        // short leaves, and a receipt keeping another entry than the one
        // naming it.
        Spi::run_with_args(
            "INSERT INTO cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, salt, entry)
             SELECT $1, op, actor, device, nonce || 'cut', request, signature, payload, at, hash, sig, key, salt, 3
             FROM cella.receipt WHERE n = 1000000",
            &[(first + 1).into()],
        )
        .expect("a receipt past the head");
        assert!(
            !verifies() && !after(2),
            "a receipt past the head names no verdict"
        );
        Spi::run("DELETE FROM cella.receipt WHERE entry = 3").expect("it gone");
        Spi::run("UPDATE cella.receipt SET entry = 5 WHERE entry = 2").expect("a tamper");
        assert!(
            !after(1) && !after(2),
            "a receipt keeping another entry than the one naming it breaks the log"
        );
    }

    const CARRY: &str = "test:thing:carry";
    const PAY: &str = "test:thing:pay";

    /// The test scope with effects: a carry follows a make or a carry, and
    /// a pay follows a carry, which stands only with it; `t.pays` refuses
    /// a pay over 100 cents, naming the entry it follows and what would
    /// let it settle; `t.follows` appends an effect in a savepoint,
    /// answering the error it raised, if any.
    fn effects() {
        scope();
        Spi::run(&format!(
            r"
SELECT cella.lets_follow('{OP}', '{CARRY}', 't'), cella.lets_follow('{CARRY}', '{CARRY}', 't'),
       cella.lets_follow('{CARRY}', '{PAY}', 't', true);
CREATE FUNCTION t.pays(payload jsonb) RETURNS text LANGUAGE sql STABLE AS $f$
  SELECT CASE WHEN (payload->>'cents')::int > 100
    THEN cella.action() || ' of ' || (payload->>'cents') || ' cents after entry ' || cella.cause() || ' is over the 100 it may: pay 100 or less' END
$f$;
INSERT INTO cella.guard (op, fn, owner) VALUES ('{PAY}', 't.pays(jsonb)', 't');
CREATE FUNCTION t.follows(op text, payload jsonb, cause bigint) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM cella.follow(op, payload, cause);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END
$f$;"
        ))
        .expect("the effects");
    }

    /// Appends an effect of `cents`; `None` when it settles, else the error.
    fn follows(op: &str, cents: i64, cause: i64) -> Option<String> {
        Spi::get_one_with_args::<String>(
            "SELECT t.follows($1, $2, $3)",
            &[
                op.into(),
                JsonB(json!({ "cents": cents })).into(),
                cause.into(),
            ],
        )
        .expect("a follow")
    }

    fn forgoes(op: &str, cause: i64, why: &str) -> i64 {
        Spi::get_one_with_args::<i64>(
            "SELECT verdict FROM cella.forgo($1, $2, $3)",
            &[op.into(), cause.into(), why.into()],
        )
        .expect("a forgo")
        .expect("its entry")
    }

    /// Every entry: its number, op, the entry it follows and whether it settled.
    fn entries() -> Vec<(i64, String, Option<i64>, bool)> {
        Spi::connect(|c| {
            c.select(
                "SELECT n, op, cause, settled FROM cella.log ORDER BY n",
                None,
                &[],
            )
            .expect("the log")
            .map(|r| {
                (
                    r.get::<i64>(1).expect("n").expect("n"),
                    r.get::<String>(2).expect("op").expect("op"),
                    r.get::<i64>(3).expect("cause"),
                    r.get::<bool>(4).expect("settled").expect("settled"),
                )
            })
            .collect()
        })
    }

    fn refusal(error: Option<String>, why: &str) {
        let error = error.expect("a refusal");
        assert!(error.starts_with("09000 "), "not a refusal: {error}");
        assert!(error.contains(why), "refused for another reason: {error}");
    }

    #[pg_test]
    fn an_effect_follows_only_an_entry_its_own_write_appended() {
        beside();
        effects();
        refusal(follows(CARRY, 100, 1), "test:thing:carry follows no write");
        settle(100);
        entry_after(first_hash());
        refusal(
            follows(CARRY, 100, 2),
            "test:thing:carry cites entry 2, which this write did not append",
        );
        refusal(
            follows(CARRY, 100, 99),
            "test:thing:carry cites entry 99, which this write did not append",
        );
        refusal(
            follows(PAY, 100, 1),
            "test:thing:pay may not follow test:thing:make: cella.follows registers no such effect",
        );
        assert_eq!(head(), 2, "a refused effect takes no number");
    }

    #[pg_test]
    fn an_effect_settles_with_its_decision_and_names_it() {
        beside();
        effects();
        settle(100);
        assert_eq!(follows(CARRY, 100, 1), None);
        assert_eq!(follows(PAY, 100, 2), None);
        assert_eq!(
            entries(),
            [
                (1, OP.into(), None, true),
                (2, CARRY.into(), Some(1), true),
                (3, PAY.into(), Some(2), true)
            ]
        );
        let effect =
            Spi::get_two::<String, i64>("SELECT actor, receipt FROM cella.log WHERE n = 2")
                .expect("entry 2");
        assert_eq!(
            effect,
            (Some(JULIEN.into()), None),
            "an effect is its decision's actor's, with no receipt"
        );
        let receipts =
            Spi::get_one::<i64>("SELECT count(*) FROM cella.receipt").expect("the receipts");
        assert_eq!(receipts, Some(1), "one signature, one decision");
        assert!(verifies());
    }

    #[pg_test]
    fn a_write_goes_five_effects_deep() {
        beside();
        effects();
        settle(100);
        for cause in 1..=5 {
            assert_eq!(follows(CARRY, 100, cause), None, "effect {cause} deep");
        }
        refusal(
            follows(CARRY, 100, 6),
            "test:thing:carry would be 6 effects from its decision: a write goes 5 deep at most",
        );
        assert_eq!(head(), 6);
    }

    #[pg_test]
    fn a_refused_effect_is_forgone_and_the_rest_stand() {
        beside();
        effects();
        settle(100);
        assert_eq!(follows(CARRY, 100, 1), None);
        assert_eq!(follows(CARRY, 100, 1), None);
        assert_eq!(follows(PAY, 100, 3), None);
        // The pay after entry 2 is refused, rolled back to its savepoint:
        // its carry, which stands only with it, is forgone with it.
        let why =
            "test:thing:pay of 150 cents after entry 2 is over the 100 it may: pay 100 or less";
        refusal(follows(PAY, 150, 2), why);
        assert_eq!(head(), 4);
        // As a handler does: the carry and its pay in the carry's
        // savepoint; the pay refused, the savepoint rolled back, and both
        // forgone, the carry first.
        Spi::run(&format!(
            r#"
DO $$
DECLARE carry bigint;
BEGIN
  BEGIN
    SELECT verdict INTO carry FROM cella.follow('{CARRY}', '{{"cents": 100}}', 1);
    PERFORM cella.follow('{PAY}', '{{"cents": 150}}', carry);
  EXCEPTION WHEN SQLSTATE '09000' THEN
    SELECT verdict INTO carry FROM cella.forgo('{CARRY}', 1, '{CARRY} forgone with what it requires: ' || SQLERRM);
    PERFORM cella.forgo('{PAY}', carry, SQLERRM);
  END;
END $$"#
        ))
        .expect("the carry forgone with its pay");
        refusal(
            follows(PAY, 100, 5),
            "test:thing:pay cites entry 5, test:thing:carry, which was forgone",
        );
        assert_eq!(
            entries(),
            [
                (1, OP.into(), None, true),
                (2, CARRY.into(), Some(1), true),
                (3, CARRY.into(), Some(1), true),
                (4, PAY.into(), Some(3), true),
                (5, CARRY.into(), Some(1), false),
                (6, PAY.into(), Some(5), false),
            ]
        );
        let reason = Spi::get_one::<String>("SELECT form->>'reason' FROM cella.log WHERE n = 6")
            .expect("its reason");
        assert_eq!(
            reason.as_deref(),
            Some(
                "test:thing:pay of 150 cents after entry 5 is over the 100 it may: pay 100 or less"
            )
        );
        let blank = Spi::get_one_with_args::<String>(
            "SELECT t.tries($1)",
            &[format!("SELECT cella.forgo('{PAY}', 3, ' ')").into()],
        );
        refusal(blank.expect("a try"), "is forgone with no reason");
        // Entry 2 lacks the pay it requires, so this write would not
        // commit (`cella test e2e notarised` commits one); the log walks
        // it the same way.
        assert!(!verifies());
        forgoes(PAY, 2, why);
        assert!(
            !verifies(),
            "a forgone pay does not stand for the one its carry requires"
        );
    }

    #[pg_test]
    fn an_effect_s_cause_is_part_of_its_hash() {
        beside();
        effects();
        settle(100);
        assert_eq!(follows(CARRY, 100, 1), None);
        assert_eq!(follows(PAY, 100, 2), None);
        assert!(verifies());
        let breaks = |tamper: &str| {
            Spi::get_one_with_args::<bool>("SELECT t.breaks($1)", &[tamper.into()])
                .expect("a tamper")
                == Some(true)
        };
        for tamper in [
            "UPDATE cella.log SET cause_hash = (SELECT hash FROM cella.log WHERE n = 1) WHERE n = 3",
            "UPDATE cella.log SET cause = 1, cause_hash = (SELECT hash FROM cella.log WHERE n = 1) WHERE n = 3",
            "UPDATE cella.log SET settled = false WHERE n = 3",
            "DELETE FROM cella.follows WHERE op = 'test:thing:pay'",
            "UPDATE cella.follows SET required = true WHERE op = 'test:thing:carry'",
        ] {
            assert!(breaks(tamper), "the log verified after: {tamper}");
        }
        assert!(verifies(), "each tamper rolled back");
    }

    /// Entry 3, the pay a carry of entry 1 requires, rewritten to act for
    /// `actor`, hashed and signed again under the notary's key in office,
    /// as only a holder of that key could.
    fn pay_resigned_for(actor: &str) {
        let notary = Key::from_seed(&NOTARY_SEED).expect("the seed");
        let one = |column: &str| {
            Spi::get_one::<Vec<u8>>(&format!("SELECT {column} FROM cella.log WHERE n = 3"))
                .expect("entry 3")
                .expect("its bytes")
        };
        let guards = Spi::get_one::<JsonB>("SELECT guards FROM cella.log WHERE n = 3")
            .expect("its guards")
            .expect("a list");
        let prev: [u8; 32] = one("prev").try_into().expect("32 bytes");
        let entry = Entry {
            n: 3,
            op: PAY.into(),
            actor: actor.into(),
            date: "2026-10-25".into(),
            payload: one("payload").try_into().expect("32 bytes"),
            basis: Basis::Cause {
                n: 2,
                hash: one("cause_hash").try_into().expect("32 bytes"),
                settled: true,
            },
            guards: crate::notary::listed_guards(&guards.0).expect("its guards listed"),
        };
        let hash = log::hash(&prev, &entry).expect("a hash");
        Spi::run_with_args(
            "UPDATE cella.log SET actor = $1, hash = $2, sig = $3 WHERE n = 3",
            &[
                actor.into(),
                hash.to_vec().into(),
                notary.sign(&hash).to_vec().into(),
            ],
        )
        .expect("entry 3 signed again");
        Spi::run_with_args("UPDATE cella.head SET hash = $1", &[hash.to_vec().into()])
            .expect("the head");
    }

    #[pg_test]
    fn an_effect_acts_only_for_its_decision_s_actor() {
        beside();
        effects();
        settle(100);
        assert_eq!(follows(CARRY, 100, 1), None);
        assert_eq!(follows(PAY, 100, 2), None);
        let actor =
            Spi::get_one::<String>("SELECT actor FROM cella.log WHERE n = 3").expect("entry 3");
        assert_eq!(
            actor.as_deref(),
            Some(JULIEN),
            "follow acts for the decision's actor"
        );
        pay_resigned_for(JULIEN);
        assert!(verifies(), "an effect signed again as it was verifies");
        pay_resigned_for(CAMILLE);
        assert!(
            !verifies(),
            "an effect acting for another than its decision's actor breaks the log"
        );
    }

    /// Entry 2 made by hand as `submit` makes one, under the notary's key
    /// in office, chained to entry 1 by `prev`.
    fn entry_after(prev: [u8; 32]) {
        let notary = Key::from_seed(&NOTARY_SEED).expect("the seed");
        let request = json!({ "cents": 200 });
        let nonce = "fedcba9876543210fedcba9876543210";
        let s = signed(&device(1), JULIEN, &request, nonce);
        let sig: [u8; 64] = cella_guards::hex::unhex(s["sig"].as_str().expect("a sig"))
            .expect("hex")
            .try_into()
            .expect("64 bytes");
        let form = json!({ "cents": 200 });
        let payload = log::payload_digest(&form).expect("a digest");
        let receipt = Receipt {
            n: 1_000_000,
            op: OP.into(),
            actor: JULIEN.into(),
            device: device(1).verifying_key().to_bytes(),
            nonce: nonce.into(),
            request: sign::request_digest(&request, SALT).expect("a digest"),
            signature: sig,
            payload,
            time: "2026-10-25T12:00:00.000000Z".into(),
        };
        let receipt_hash = receipt.hash();
        let entry = Entry {
            n: 2,
            op: OP.into(),
            actor: JULIEN.into(),
            date: "2026-10-25".into(),
            payload,
            basis: Basis::Receipt {
                n: receipt.n,
                hash: receipt_hash,
            },
            guards: vec![],
        };
        let hash = log::hash(&prev, &entry).expect("a hash");
        Spi::run_with_args(
            "INSERT INTO cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, salt, entry)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, 2)",
            &[
                receipt.n.into(),
                OP.into(),
                JULIEN.into(),
                receipt.device.to_vec().into(),
                nonce.into(),
                receipt.request.to_vec().into(),
                sig.to_vec().into(),
                payload.to_vec().into(),
                receipt.time.clone().into(),
                receipt_hash.to_vec().into(),
                notary.sign(&receipt_hash).to_vec().into(),
                SALT.into(),
            ],
        )
        .expect("receipt 2");
        Spi::run_with_args(
            "INSERT INTO cella.log (n, op, actor, date, payload, form, receipt, guards, prev, hash, sig, key)
             VALUES (2, $1, $2, '2026-10-25', $3, $4, $5, '[]', $6, $7, $8, 1)",
            &[
                OP.into(),
                JULIEN.into(),
                payload.to_vec().into(),
                JsonB(form).into(),
                receipt.n.into(),
                prev.to_vec().into(),
                hash.to_vec().into(),
                notary.sign(&hash).to_vec().into(),
            ],
        )
        .expect("entry 2");
        Spi::run_with_args(
            "UPDATE cella.head SET n = 2, hash = $1",
            &[hash.to_vec().into()],
        )
        .expect("the head");
    }

    fn first_hash() -> [u8; 32] {
        let hash = Spi::get_one::<Vec<u8>>("SELECT hash FROM cella.log WHERE n = 1")
            .expect("entry 1")
            .expect("its hash");
        hash.try_into().expect("32 bytes")
    }

    #[pg_test]
    fn an_entry_chains_on_the_one_before() {
        beside();
        scope();
        settle(100);
        entry_after(first_hash());
        assert!(verifies());
    }

    #[pg_test]
    fn an_entry_chained_elsewhere_breaks_the_log() {
        beside();
        scope();
        settle(100);
        entry_after(log::GENESIS);
        assert!(!verifies());
    }

    /// The day in a zone, by the clock.
    fn day_in(zone: &str) -> pgrx::datum::Date {
        Spi::get_one_with_args::<pgrx::datum::Date>(
            "SELECT (clock_timestamp() AT TIME ZONE $1)::date",
            &[zone.into()],
        )
        .expect("the day")
        .expect("a date")
    }

    #[pg_test]
    fn the_verdict_date_is_the_scope_s_day() {
        beside();
        // Kiritimati and Baker Island are 26 hours apart: their days never
        // agree, so the date the notary reads is the zone's it was given.
        Spi::run("SELECT set_config('cella.timezone', 'Pacific/Kiritimati', true)")
            .expect("the zone");
        let date = Spi::get_one::<pgrx::datum::Date>("SELECT cella.verdict_date()")
            .expect("the verdict date")
            .expect("a date");
        assert_eq!(date, day_in("Pacific/Kiritimati"));
        assert_ne!(date, day_in("Etc/GMT+12"));
    }

    #[pg_test]
    fn a_fixed_clock_is_the_verdict_date_in_any_zone() {
        beside();
        Spi::run("SELECT set_config('cella.timezone', 'Pacific/Kiritimati', true), set_config('cella.clock', '2026-10-25', true)")
            .expect("the zone and the clock");
        let date =
            Spi::get_one::<String>("SELECT cella.verdict_date()::text").expect("the verdict date");
        assert_eq!(date.as_deref(), Some("2026-10-25"));
    }

    /// A subject's vault keys of a class, `(year, restricted)` by year: no
    /// key opens here, so the test seals none.
    fn keys(subject: &str, class: &str) -> Vec<(i32, Option<String>)> {
        Spi::connect(|c| {
            c.select(
                "SELECT year, restricted::text FROM vault.key WHERE subject = $1 AND class = $2 ORDER BY year",
                None,
                &[subject.into(), class.into()],
            )
            .expect("the keys")
            .map(|r| (r.get::<i32>(1).expect("year").expect("a year"), r.get::<String>(2).expect("restricted")))
            .collect()
        })
    }

    fn tombstone(subject: &str, class: &str) -> Option<(Option<i64>, String, bool)> {
        Spi::connect(|c| {
            let rows = c
                .select(
                    "SELECT receipt, date::text, restricted FROM vault.erased WHERE subject = $1 AND class = $2",
                    None,
                    &[subject.into(), class.into()],
                )
                .expect("the tombstone");
            rows.into_iter().next().map(|r| {
                (
                    r.get::<i64>(1).expect("receipt"),
                    r.get::<String>(2).expect("date").expect("a date"),
                    r.get::<bool>(3).expect("restricted").expect("restricted"),
                )
            })
        })
    }

    fn reerase(list: &Value) -> i64 {
        Spi::get_one_with_args::<i64>(
            "SELECT cella.vault_reerase($1)",
            &[JsonB(list.clone()).into()],
        )
        .expect("the re-erasure")
        .expect("a count")
    }

    /// A list as `cella backup` writes it, its erasures after the
    /// restored head: Ana's contact erased, Ben's payroll restricted.
    #[pg_test]
    fn a_restore_carries_out_each_erasure_its_vault_lacks_once() {
        beside();
        Spi::run(
            r"INSERT INTO vault.key (subject, class, year, sealed, wrap)
              SELECT subject, class, year, '\x00', decode(repeat('00', 32), 'hex') FROM (VALUES
                ('ana', 'contact', 2025), ('ana', 'contact', 2026), ('ana', 'profile', 2026),
                ('ben', 'payroll', 2020), ('ben', 'payroll', 2025)) k (subject, class, year)",
        )
        .expect("the keys");
        let list = json!({ "head": 9, "erasures": [
            { "subject": "ana", "class": "contact", "date": "2026-10-25", "receipt": 12, "restricted": false },
            { "subject": "ben", "class": "payroll", "date": "2026-10-25", "receipt": 14, "restricted": true },
        ] });
        assert_eq!(reerase(&list), 2);
        assert_eq!(keys("ana", "contact"), vec![]);
        assert_eq!(
            keys("ana", "profile"),
            vec![(2026, None)],
            "a class the list does not name is kept"
        );
        assert_eq!(
            tombstone("ana", "contact"),
            Some((None, "2026-10-25".into(), false))
        );
        // Restricted, not erased: the key past its clock on the erasure's
        // date goes, and the one the law still keeps is restricted.
        assert_eq!(
            keys("ben", "payroll"),
            vec![(2025, Some("2026-10-25".into()))]
        );
        assert_eq!(
            tombstone("ben", "payroll"),
            Some((None, "2026-10-25".into(), true))
        );
        assert_eq!(reerase(&list), 0, "run again, it carries out none");
        assert_eq!(
            keys("ben", "payroll"),
            vec![(2025, Some("2026-10-25".into()))]
        );

        // A newer list, after the sweep carried Ben's payroll out in full.
        let swept = json!({ "head": 11, "erasures": [
            { "subject": "ben", "class": "payroll", "date": "2026-10-25", "receipt": 14, "restricted": false },
        ] });
        assert_eq!(reerase(&swept), 1);
        assert_eq!(keys("ben", "payroll"), vec![]);
        assert_eq!(
            tombstone("ben", "payroll"),
            Some((None, "2026-10-25".into(), false))
        );
        assert_eq!(reerase(&swept), 0);
    }

    #[pg_test]
    fn a_list_naming_no_retention_class_is_refused() {
        beside();
        scope();
        let list = json!({ "erasures": [{ "subject": "ana", "class": "diary", "date": "2026-10-25", "restricted": false }] });
        let error = tries(&format!("SELECT cella.vault_reerase('{list}')")).expect("a refusal");
        assert!(
            error.contains("no retention class diary, which the list's erasure of ana names"),
            "{error}"
        );
    }

    /// The id of the wrap key the TEST-ONLY vault key derives, in hex.
    fn wrap_id() -> String {
        hex(&vault::wrap_id(&vault::wrap_key(&super::VAULT_KEY)))
    }

    /// `t.person`, whose email is Julien's contact data, registered as
    /// personal.
    fn personal() {
        Spi::run(
            "CREATE TABLE t.person (address text NOT NULL, email text);
             INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES ('t', 'person', 'email', 'contact', 'address', 't');",
        )
        .expect("the personal field");
    }

    /// Julien's email, written as entry 1 and sealed in the vault.
    fn give_email() {
        let request = json!({ "cents": 100 });
        let payload = json!({ "cents": 100, "email": { "$personal": { "field": "t.person.email", "subject": JULIEN, "value": "julien@petit.example" } } });
        assert_eq!(
            attempt(
                &payload,
                JULIEN,
                &signed(&device(1), JULIEN, &request, NONCE)
            ),
            None
        );
    }

    fn opened_email() -> Option<String> {
        Spi::get_one::<String>("SELECT cella.opened(1) ->> 'email'").expect("the entry, opened")
    }

    #[pg_test]
    fn a_vault_key_names_the_wrap_key_that_sealed_it_and_one_naming_another_is_refused_with_its_id()
    {
        beside();
        scope();
        personal();
        give_email();
        let named = Spi::get_one::<String>(
            "SELECT string_agg(DISTINCT encode(wrap, 'hex'), ',') FROM vault.key",
        )
        .expect("the wrap ids");
        assert_eq!(
            named,
            Some(wrap_id()),
            "the key is named by the current wrap key's id"
        );
        assert_ne!(
            named,
            Some(hex(&vault::wrap_key(&super::VAULT_KEY))),
            "never by the key itself"
        );
        assert_eq!(opened_email().as_deref(), Some("julien@petit.example"));

        let other = "ab".repeat(32);
        Spi::run(&format!(
            "UPDATE vault.key SET wrap = decode('{other}', 'hex')"
        ))
        .expect("another id");
        let error = tries("SELECT cella.opened(1)").expect("a refusal");
        assert!(
            error.contains(&format!(
                "is sealed under the wrap key {other}, which neither cella.vault_key_file nor cella.vault_key_previous derives"
            )),
            "{error}"
        );
    }

    #[pg_test]
    fn rewrap_moves_no_key_already_naming_the_current_wrap_key() {
        beside();
        scope();
        personal();
        give_email();
        assert_eq!(
            Spi::get_one::<i64>("SELECT cella.vault_rewrap()").expect("the rewrap"),
            Some(0)
        );
        assert_eq!(opened_email().as_deref(), Some("julien@petit.example"));
    }

    /// It drops the extension every other test reads, so it runs alone: a
    /// vault key 0.8.0 sealed names no wrap key, and the upgrade names the
    /// one that opens it; one that opens under no key file fails the
    /// upgrade, naming it.
    #[pg_test]
    fn the_upgrade_to_0_9_0_names_each_vault_key_s_wrap_key() {
        alone();
        let current = version();
        let at_0_8_0 = |sealed: &[u8]| {
            Spi::run(
                "DROP SCHEMA IF EXISTS t, old CASCADE;
                 DROP EXTENSION cella CASCADE;
                 CREATE EXTENSION cella VERSION '0.8.0';",
            )
            .expect("0.8.0");
            Spi::run_with_args(
                "INSERT INTO vault.key (subject, class, year, sealed) VALUES ($1, 'contact', 2026, $2)",
                &[JULIEN.into(), sealed.to_vec().into()],
            )
            .expect("a key 0.8.0 sealed");
        };
        let key = [5u8; 32];
        let sealed = vault::seal(
            &vault::wrap_key(&super::VAULT_KEY),
            &[3; vault::NONCE],
            &crate::vault::key_aad(JULIEN, "contact", 2026),
            &key,
        )
        .expect("sealed");
        at_0_8_0(&sealed);
        Spi::run("ALTER EXTENSION cella UPDATE").expect("the upgrade");
        assert_eq!(version(), current);
        let named = Spi::get_one::<String>("SELECT encode(wrap, 'hex') FROM vault.key")
            .expect("the wrap id");
        assert_eq!(named, Some(wrap_id()));
        let nullable =
            Spi::get_one::<bool>("SELECT NOT attnotnull FROM pg_attribute WHERE attrelid = 'vault.key'::regclass AND attname = 'wrap'")
                .expect("the column");
        assert_eq!(
            nullable,
            Some(false),
            "every key names its wrap key from 0.9.0"
        );

        at_0_8_0(b"opens under no key");
        scope();
        let error = tries("ALTER EXTENSION cella UPDATE").expect("a refusal");
        assert!(
            error.contains(&format!(
                "the key of {JULIEN}'s contact from 2026 opens under neither"
            )),
            "{error}"
        );
    }
}
