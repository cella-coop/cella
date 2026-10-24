\set ON_ERROR_STOP 1
\i sql/rules/decision.sql
\i sql/rules/decision_member.sql
\set ON_ERROR_STOP 0
\i sql/rules/invoice.sql
\set ON_ERROR_STOP 1
SET ROLE app;
SELECT d.id, decision.consented(d.id) AS consented, decision_member.two_thirds(d.id) AS two_thirds
FROM decision.decision d ORDER BY d.id;
RESET ROLE;
-- catalog-side cross-check: SQL-standard bodies (BEGIN ATOMIC / RETURN) record their dependencies
SELECT p.oid::regprocedure AS rule,
       array_agg(DISTINCT n.nspname ORDER BY n.nspname) AS schemas_depended_on
FROM pg_proc p
JOIN pg_depend dp ON dp.classid = 'pg_proc'::regclass AND dp.objid = p.oid AND dp.deptype = 'n'
LEFT JOIN pg_class c ON dp.refclassid = 'pg_class'::regclass AND c.oid = dp.refobjid
LEFT JOIN pg_proc f ON dp.refclassid = 'pg_proc'::regclass AND f.oid = dp.refobjid
JOIN pg_namespace n ON n.oid = coalesce(c.relnamespace, f.pronamespace)
WHERE p.pronamespace::regnamespace::text IN ('decision', 'decision_member', 'invoice')
GROUP BY p.oid ORDER BY 1;
