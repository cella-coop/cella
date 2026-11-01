-- cella 0.4.0 to 0.5.0: the notary's checks are guards. `cella.rule` is
-- `cella.guard`, `cella.rule_text` is `cella.guard_text`, and a log
-- entry's `rules` are its `guards`; each keeps its rows, its grants and its
-- place in a dump. `ALTER EXTENSION cella UPDATE` runs it, with the 0.5.0
-- library loaded; the org core makes the role guards run as.

ALTER TABLE cella.rule RENAME TO guard;
ALTER TABLE cella.rule_text RENAME TO guard_text;
ALTER TABLE cella.log RENAME COLUMN rules TO guards;
