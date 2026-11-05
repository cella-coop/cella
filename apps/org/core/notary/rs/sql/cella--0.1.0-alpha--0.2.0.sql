-- cella 0.1.0-alpha to 0.2.0: every key the notary signs with is kept,
-- and each receipt and entry names its own; the vault's wrap key comes
-- from a file of its own, which `cella.vault_rewrap()` moves the vault's
-- keys to. `ALTER EXTENSION cella UPDATE` runs it, with the 0.2.0 library
-- loaded; the log, its receipts and the vault stay as they are.

-- The key that signed the log so far is the key file's: the upgrade runs
-- with the key that signed it, and refuses if the log then fails to verify;
-- an empty log has nothing to verify.
CREATE TABLE cella.signer (
    id integer PRIMARY KEY CHECK (id > 0),
    public bytea NOT NULL UNIQUE CHECK (length(public) = 32),
    since bigint NOT NULL UNIQUE CHECK (since > 0)
);
REVOKE ALL ON cella.signer FROM PUBLIC;
GRANT SELECT ON cella.signer TO PUBLIC;
SELECT pg_catalog.pg_extension_config_dump('cella.signer', '');
INSERT INTO cella.signer (id, public, since)
SELECT 1, cella.notary_key(), 1 WHERE EXISTS (SELECT FROM cella.log);

ALTER TABLE cella.receipt ADD COLUMN key integer REFERENCES cella.signer;
ALTER TABLE cella.log ADD COLUMN key integer REFERENCES cella.signer;
UPDATE cella.receipt SET key = 1;
UPDATE cella.log SET key = 1;
ALTER TABLE cella.receipt ALTER COLUMN key SET NOT NULL;
ALTER TABLE cella.log ALTER COLUMN key SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM cella.log) THEN
    IF NOT cella.verify_log() THEN
      RAISE EXCEPTION 'cella 0.2.0: the log does not verify under cella.key_file''s key; upgrade with the key that signed it';
    END IF;
  END IF;
END
$$;

CREATE FUNCTION cella."vault_rewrap"() RETURNS bigint /* i64 */
STRICT VOLATILE SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'vault_rewrap_wrapper';
REVOKE EXECUTE ON FUNCTION cella.vault_rewrap() FROM PUBLIC;
