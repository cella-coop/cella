-- cella 0.10.0 to 0.11.0: a receipt keeps the entry that names it, which
-- the notary writes with it, so a verification resumed from a checkpoint
-- reads only the receipts after it and still finds one no entry names
-- before it, by the index of those that keep none. `ALTER EXTENSION cella
-- UPDATE` runs it, with the 0.11.0 library loaded: each receipt the log
-- names is given its entry, once, and one it names not keeps none.

ALTER TABLE cella.receipt ADD COLUMN entry bigint UNIQUE;
UPDATE cella.receipt r SET entry = l.n FROM cella.log l WHERE l.receipt = r.n;
CREATE INDEX receipt_unnamed ON cella.receipt (n) WHERE entry IS NULL;
GRANT SELECT (entry) ON cella.receipt TO PUBLIC;
