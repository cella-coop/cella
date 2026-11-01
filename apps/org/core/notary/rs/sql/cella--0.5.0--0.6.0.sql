-- cella 0.5.0 to 0.6.0: every change to the records is an action. The
-- function a guard reads the id of the action being judged through,
-- `cella.op()`, is `cella.action()`; the library binds it by its new
-- symbol, so it is made anew rather than renamed. `ALTER EXTENSION cella
-- UPDATE` runs it, with the 0.6.0 library loaded.

DROP FUNCTION cella.op();
CREATE FUNCTION cella.action() RETURNS text
STRICT STABLE
LANGUAGE c
AS 'MODULE_PATHNAME', 'action_wrapper';
