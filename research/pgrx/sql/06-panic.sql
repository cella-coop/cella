\set VERBOSITY default
SELECT pg_backend_pid() AS pid_before;
BEGIN;
SELECT cella.submit('panic.test', '{}') AS verdict;
SELECT cella.boom('panic');
SELECT 1;
ROLLBACK;
SELECT pg_backend_pid() AS pid_after, (SELECT max(n) FROM cella.log) AS head;
