-- cella 0.8.0 to 0.9.0: each vault key names the wrap key that sealed it,
-- by its id, so a restore opens each under its own key file and names the
-- one it lacks. `ALTER EXTENSION cella UPDATE` runs it, with the 0.9.0
-- library loaded and the cluster's vault key settings as they are: every
-- vault key is named by the wrap key that opens it, the current one or the
-- previous one, and one opening under neither fails the upgrade, naming it.

ALTER TABLE vault.key ADD COLUMN wrap bytea CHECK (length(wrap) = 32);

CREATE FUNCTION cella."vault_name_wraps"() RETURNS bigint /* i64 */
VOLATILE SECURITY DEFINER
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'vault_name_wraps_wrapper';
SELECT cella.vault_name_wraps();
DROP FUNCTION cella.vault_name_wraps();

ALTER TABLE vault.key ALTER COLUMN wrap SET NOT NULL;
