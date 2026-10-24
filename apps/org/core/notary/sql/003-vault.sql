-- The vault's functions: the app opens an entry's commitments for a read
-- it has authorised; the sweep is a superuser's, run by `cella vault
-- sweep`. The rules role reads neither.
REVOKE EXECUTE ON FUNCTION cella.opened(bigint), cella.vault_sweep() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cella.opened(bigint) TO cella_app;
