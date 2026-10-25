//! The notary's own tests, run in Postgres by `cella test notary`: the
//! member's signature, the payload restating the request, the nonce, the
//! keyring, the rules and the chain. Each runs in a transaction pgrx rolls
//! back, on a keyring and devices of its own; the notary signs with a
//! TEST-ONLY seed that `pg_test::setup` writes to the cluster's key file.

use pgrx::prelude::*;

/// The notary's TEST-ONLY seed: never a scope's key.
pub const NOTARY_SEED: [u8; 32] = [7; 32];

/// The vault's TEST-ONLY key.
#[cfg(test)]
pub const VAULT_KEY: [u8; 32] = [9; 32];

#[pg_schema]
mod tests {
    use super::NOTARY_SEED;
    use cella_rules::hex::hex;
    use cella_rules::log::{self, Entry, Key, Receipt};
    use cella_rules::sign::{self, Request};
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

    /// A member's device, from a TEST-ONLY seed.
    fn device(seed: u8) -> SigningKey {
        SigningKey::from_bytes(&[seed; 32])
    }

    /// The scope, a fixed verdict date, the rules role as the org core
    /// grants it, a keyring over
    /// `t.device`, Julien's device 1 and Camille's device 2 enrolled, and
    /// `t.attempt`, which submits and answers the error it raised, if any,
    /// as `SQLSTATE message`.
    fn scope() {
        Spi::run(&format!(
            r"
SELECT set_config('cella.scope', '{SCOPE}', true), set_config('cella.clock', '2026-10-25', true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_rules') THEN
    CREATE ROLE cella_rules NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;
CREATE SCHEMA t;
CREATE TABLE t.device (actor text NOT NULL, device bytea NOT NULL, revoked boolean NOT NULL DEFAULT false);
CREATE FUNCTION t.keyring(actor text, device bytea) RETURNS text LANGUAGE sql STABLE AS $f$
  SELECT CASE WHEN EXISTS (SELECT FROM t.device d WHERE d.actor = $1 AND d.device = $2 AND NOT d.revoked) THEN NULL
    ELSE 'the device is not a current key of ' || $1 END
$f$;
GRANT USAGE ON SCHEMA cella, t TO cella_rules;
GRANT SELECT ON t.device TO cella_rules;
INSERT INTO cella.keyring (fn, owner) VALUES ('t.keyring(text, bytea)', 't');
INSERT INTO t.device (actor, device) VALUES ('{JULIEN}', '\x{julien}'), ('{CAMILLE}', '\x{camille}');
CREATE FUNCTION t.attempt(op text, payload jsonb, actor text, signed jsonb) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM cella.submit(op, payload, actor, signed);
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
    fn signed_in(scope: &str, key: &SigningKey, op: &str, actor: &str, request: &Value, nonce: &str) -> Value {
        let digest = sign::request_digest(request, SALT).expect("a digest");
        let device = key.verifying_key().to_bytes();
        let r = Request { scope, op, actor, device, digest, nonce };
        let sig = key.sign(r.message().expect("a message").as_bytes()).to_bytes();
        json!({ "request": request, "device": hex(&device), "salt": SALT, "nonce": nonce, "sig": hex(&sig) })
    }

    fn signed(key: &SigningKey, actor: &str, request: &Value, nonce: &str) -> Value {
        signed_in(SCOPE, key, OP, actor, request, nonce)
    }

    /// Submits a write; `None` when it settles, else the error it raised.
    fn attempt(payload: &Value, actor: &str, signed: &Value) -> Option<String> {
        Spi::get_one_with_args::<String>(
            "SELECT t.attempt($1, $2, $3, $4)",
            &[OP.into(), JsonB(payload.clone()).into(), actor.into(), JsonB(signed.clone()).into()],
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
        Spi::get_one::<i64>("SELECT coalesce((SELECT n FROM cella.head), 0)").expect("the head").expect("a number")
    }

    fn verifies() -> bool {
        Spi::get_one::<bool>("SELECT cella.verify_log()").expect("verify_log").expect("a verdict")
    }

    fn settle(cents: i64) -> i64 {
        let request = json!({ "cents": cents });
        assert_eq!(attempt(&request, JULIEN, &signed(&device(1), JULIEN, &request, NONCE)), None);
        Spi::get_one::<i64>("SELECT receipt FROM cella.log WHERE n = 1").expect("the entry").expect("its receipt")
    }

    #[pg_test]
    fn a_signed_write_settles_and_keeps_what_was_signed() {
        scope();
        let receipt = settle(100);
        assert_eq!(head(), 1);
        assert!(verifies());
        let salt = Spi::get_one_with_args::<String>("SELECT salt FROM cella.receipt WHERE n = $1", &[receipt.into()]);
        assert_eq!(salt.expect("the salt").as_deref(), Some(SALT));
        let signer = Spi::get_one::<Vec<u8>>("SELECT public FROM cella.signer WHERE id = (SELECT key FROM cella.log WHERE n = 1)");
        assert_eq!(signer.expect("the signer"), Some(Key::from_seed(&NOTARY_SEED).expect("the seed").public().to_vec()));
        let kept = |n: i64, request: Value| {
            Spi::get_one_with_args::<bool>("SELECT cella.signed($1, $2)", &[n.into(), JsonB(request).into()]).expect("signed")
        };
        assert_eq!(kept(receipt, json!({ "cents": 100 })), Some(true));
        assert_eq!(kept(receipt, json!({ "cents": 101 })), Some(false));
        assert_eq!(kept(receipt + 1000, json!({ "cents": 100 })), None);
    }

    #[pg_test]
    fn the_salt_and_signed_are_the_owners() {
        scope();
        let public = |what: &str| {
            Spi::get_one_with_args::<bool>("SELECT has_column_privilege('public', 'cella.receipt', $1, 'SELECT')", &[what.into()])
                .expect("a privilege")
        };
        assert_eq!(public("salt"), Some(false));
        assert_eq!(public("request"), Some(true));
        let call = Spi::get_one::<bool>("SELECT has_function_privilege('public', 'cella.signed(bigint, jsonb)', 'EXECUTE')");
        assert_eq!(call.expect("a privilege"), Some(false));
    }

    #[pg_test]
    fn an_unsigned_write_is_refused() {
        scope();
        refused(&json!({ "cents": 100 }), JULIEN, &json!({}), "is not signed");
    }

    #[pg_test]
    fn a_signature_by_another_key_is_refused() {
        scope();
        let request = json!({ "cents": 100 });
        let mut forged = signed(&device(3), JULIEN, &request, NONCE);
        forged["device"] = json!(hex(&device(1).verifying_key().to_bytes()));
        refused(&request, JULIEN, &forged, "the signature does not verify");
    }

    #[pg_test]
    fn a_request_swapped_under_its_signature_is_refused() {
        scope();
        let mut swapped = signed(&device(1), JULIEN, &json!({ "cents": 100 }), NONCE);
        swapped["request"] = json!({ "cents": 900 });
        refused(&json!({ "cents": 900 }), JULIEN, &swapped, "the signature does not verify");
    }

    #[pg_test]
    fn a_signature_names_its_scope_op_and_actor() {
        scope();
        let request = json!({ "cents": 100 });
        let elsewhere = signed_in("other.example", &device(1), OP, JULIEN, &request, NONCE);
        refused(&request, JULIEN, &elsewhere, "the signature does not verify");
        let another_op = signed_in(SCOPE, &device(1), "test:thing:drop", JULIEN, &request, NONCE);
        refused(&request, JULIEN, &another_op, "the signature does not verify");
        refused(&request, CAMILLE, &signed(&device(1), JULIEN, &request, NONCE), "the signature does not verify");
    }

    #[pg_test]
    fn a_payload_restates_the_request_or_is_refused() {
        scope();
        let request = json!({ "cents": 100, "note": "lunch" });
        let s = signed(&device(1), JULIEN, &request, NONCE);
        refused(&json!({ "cents": 900 }), JULIEN, &s, "the payload's cents is not what the member signed");
        assert_eq!(attempt(&json!({ "cents": 100, "entry": "7" }), JULIEN, &s), None);
        assert_eq!(head(), 1);
    }

    #[pg_test]
    fn a_nonce_counts_once() {
        scope();
        settle(100);
        let again = json!({ "cents": 200 });
        let error = attempt(&again, JULIEN, &signed(&device(1), JULIEN, &again, NONCE)).expect("a refusal");
        assert!(error.starts_with("09000 ") && error.contains("was already counted"), "{error}");
        assert_eq!(head(), 1);
    }

    #[pg_test]
    fn the_keyring_says_which_devices_are_current() {
        scope();
        let request = json!({ "cents": 100 });
        refused(&request, JULIEN, &signed(&device(3), JULIEN, &request, NONCE), "the device is not a current key of julien");
        refused(&request, JULIEN, &signed(&device(2), JULIEN, &request, NONCE), "the device is not a current key of julien");
        Spi::run("UPDATE t.device SET revoked = true WHERE actor = 'julien@test.example'").expect("a revocation");
        refused(&request, JULIEN, &signed(&device(1), JULIEN, &request, NONCE), "the device is not a current key of julien");
    }

    #[pg_test]
    fn no_keyring_no_write() {
        scope();
        Spi::run("DELETE FROM cella.keyring").expect("no keyring");
        let request = json!({ "cents": 100 });
        let error = attempt(&request, JULIEN, &signed(&device(1), JULIEN, &request, NONCE)).expect("an error");
        assert!(error.contains("no keyring is registered"), "{error}");
    }

    #[pg_test]
    fn a_rule_refuses_with_its_reason() {
        scope();
        Spi::run(
            "CREATE FUNCTION t.small(payload jsonb) RETURNS text LANGUAGE sql STABLE AS $f$
               SELECT CASE WHEN (payload->>'cents')::bigint > 500 THEN cella.op() || ' is over 500 cents' END
             $f$;
             INSERT INTO cella.rule (op, fn, owner) VALUES ('test:thing:make', 't.small(jsonb)', 't');",
        )
        .expect("a rule");
        let big = json!({ "cents": 900 });
        refused(&big, JULIEN, &signed(&device(1), JULIEN, &big, NONCE), "test:thing:make is over 500 cents");
        settle(100);
        let rules = Spi::get_one::<String>("SELECT rules->0->>'function' FROM cella.log WHERE n = 1").expect("the entry's rules");
        assert_eq!(rules.as_deref(), Some("t.small(jsonb)"));
        assert!(verifies());
    }

    #[pg_test]
    fn the_chain_breaks_where_it_is_tampered_with() {
        scope();
        settle(100);
        assert!(verifies());
        let breaks = |tamper: &str| Spi::get_one_with_args::<bool>("SELECT t.breaks($1)", &[tamper.into()]).expect("a tamper") == Some(true);
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

    /// Entry 2 made by hand as `submit` makes one, under the notary's key
    /// in office, chained to entry 1 by `prev`.
    fn entry_after(prev: [u8; 32]) {
        let notary = Key::from_seed(&NOTARY_SEED).expect("the seed");
        let request = json!({ "cents": 200 });
        let nonce = "fedcba9876543210fedcba9876543210";
        let s = signed(&device(1), JULIEN, &request, nonce);
        let sig: [u8; 64] = cella_rules::hex::unhex(s["sig"].as_str().expect("a sig")).expect("hex").try_into().expect("64 bytes");
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
        let entry =
            Entry { n: 2, op: OP.into(), actor: JULIEN.into(), date: "2026-10-25".into(), payload, receipt: receipt.n, receipt_hash, rules: vec![] };
        let hash = log::hash(&prev, &entry).expect("a hash");
        Spi::run_with_args(
            "INSERT INTO cella.receipt (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key, salt)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12)",
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
            "INSERT INTO cella.log (n, op, actor, date, payload, form, receipt, rules, prev, hash, sig, key)
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
        Spi::run_with_args("UPDATE cella.head SET n = 2, hash = $1", &[hash.to_vec().into()]).expect("the head");
    }

    fn first_hash() -> [u8; 32] {
        let hash = Spi::get_one::<Vec<u8>>("SELECT hash FROM cella.log WHERE n = 1").expect("entry 1").expect("its hash");
        hash.try_into().expect("32 bytes")
    }

    #[pg_test]
    fn an_entry_chains_on_the_one_before() {
        scope();
        settle(100);
        entry_after(first_hash());
        assert!(verifies());
    }

    #[pg_test]
    fn an_entry_chained_elsewhere_breaks_the_log() {
        scope();
        settle(100);
        entry_after(log::GENESIS);
        assert!(!verifies());
    }
}
