-- cella 0.6.0 to 0.7.0: a restore carries out again the erasures made
-- after its backup was taken, so no one erased comes back. A tombstone
-- `cella.vault_reerase(jsonb)` writes names no log entry, since the entry
-- that made it is past the restored head; `ALTER EXTENSION cella UPDATE`
-- runs it, with the 0.7.0 library loaded, and every tombstone stays as it
-- is.

ALTER TABLE vault.erased ALTER COLUMN receipt DROP NOT NULL;

CREATE FUNCTION cella."vault_reerase"(
	"erasures" jsonb /* pgrx::datum::json::JsonB */
) RETURNS bigint /* i64 */
STRICT VOLATILE SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'vault_reerase_wrapper';
REVOKE EXECUTE ON FUNCTION cella.vault_reerase(jsonb) FROM PUBLIC;
