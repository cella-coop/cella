-- The notary at 0.2.0: each receipt and entry names the key that signed
-- it, kept in cella.signer, and the vault's keys are sealed under a key
-- file of the vault's own. A database made before it is upgraded in
-- place; a new one is made at it by 001 and takes nothing here but its
-- head row, which a fresh install leaves to the first write so that a
-- dump of the head restores. Each later change of the notary appends a
-- migration that updates the extension the same way.
ALTER EXTENSION cella UPDATE;

INSERT INTO cella.head VALUES (true, 0, '\x0000000000000000000000000000000000000000000000000000000000000000')
ON CONFLICT DO NOTHING;
