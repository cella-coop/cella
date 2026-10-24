\set VERBOSITY terse
SELECT p.proname, p.prosecdef AS security_definer, p.proconfig
FROM pg_proc p WHERE p.pronamespace = 'cella'::regnamespace AND p.proname IN ('submit', 'verify_log');
SET ROLE app;
SELECT cella.submit('decision.close', '{"decision": "d-2026-012", "outcome": "adopted"}') AS verdict;
SELECT cella.submit('member.admit', '{"member": "ines@lanterne.example", "decision": "d-2026-012"}') AS verdict;
INSERT INTO cella.log VALUES (99, 'forged', '{}', '\x00', '\x00', '\x00');
UPDATE cella.head SET n = 0;
DELETE FROM cella.log;
SELECT n, op, payload, encode(substr(hash, 1, 8), 'hex') AS hash8, encode(substr(prev, 1, 8), 'hex') AS prev8,
       length(sig) AS sig_bytes FROM cella.log ORDER BY n;
SELECT cella.verify_log() AS verified;
RESET ROLE;
-- tampering with a past entry, as superuser, is caught by the chain
BEGIN;
UPDATE cella.log SET payload = '{"decision": "d-2026-012", "outcome": "refused"}' WHERE n = 1;
SELECT cella.verify_log();
ROLLBACK;
SELECT encode(cella.notary_key(), 'hex') AS notary_pubkey;
