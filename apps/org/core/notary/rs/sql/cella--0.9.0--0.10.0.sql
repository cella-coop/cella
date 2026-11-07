-- cella 0.9.0 to 0.10.0: the log verifies a page at a time, so a
-- verification's memory is one page's whatever the log's length, and from
-- a checkpoint: `cella.verify_log(after)` checks the entries after entry
-- `after` from its hash, as the fold resumes there. `ALTER EXTENSION cella
-- UPDATE` runs it, with the 0.10.0 library loaded.

CREATE FUNCTION cella."verify_log"("after" bigint) RETURNS bool /* bool */
STRICT STABLE SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'verify_log_after_wrapper';
