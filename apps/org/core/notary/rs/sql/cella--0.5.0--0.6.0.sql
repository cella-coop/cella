-- cella 0.5.0 to 0.6.0: every change to the records is an action. The
-- function a guard reads the id of the action being judged through,
-- `cella.op()`, is `cella.action()`. A guard whose body is SQL-standard
-- holds it by its oid, so Postgres refuses to drop it: it is renamed,
-- keeping its oid and every body that calls it, and rebound in place to the
-- library's new symbol. `ALTER EXTENSION cella UPDATE` runs it, with the
-- 0.6.0 library loaded.

ALTER FUNCTION cella.op() RENAME TO action;
CREATE OR REPLACE FUNCTION cella.action() RETURNS text
STRICT STABLE
LANGUAGE c
AS 'MODULE_PATHNAME', 'action_wrapper';
