-- Who reads a capital account: its holder, and whoever repays capital,
-- keeps, carries or closes the books, or distributes the surplus, in the
-- circles their mandates cover; every other account, whoever reads its
-- circle, as core's row-level policy, which this one replaces, reads it. The capital the grafts keep, what was called,
-- paid, drawn and is owed, reads the same, as `account`. A write's
-- transaction sees every account.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('account', NULL, 'repay-capital', 'account'),
  ('account', NULL, 'record-entry', 'account'),
  ('account', NULL, 'carry-books', 'account'),
  ('account', NULL, 'close-period', 'account'),
  ('account', NULL, 'distribute-surplus', 'account');

ALTER TABLE account.account ENABLE ROW LEVEL SECURITY;

DROP POLICY circle ON account.account;
CREATE POLICY reads ON account.account FOR SELECT TO cella_app USING ((holder IS NULL AND circle = ANY ((SELECT circle.reads('{account}'))::text[])) OR (SELECT cella.sees('account')) OR circle = ANY ((SELECT cella.circles('account'))::text[]) OR holder = cella.reader() OR cella.reaches('account', holder));
CREATE POLICY guards ON account.account FOR SELECT TO cella_guards USING (true);
CREATE POLICY writes ON account.account FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON account.account FOR UPDATE TO cella_app USING (true);
