-- The notary at 0.7.0: a restore re-applies the erasures made after its
-- backup through `cella.vault_reerase(jsonb)`, a superuser's, and a
-- tombstone it writes names no log entry. A database made before it is
-- upgraded in place.
ALTER EXTENSION cella UPDATE;
