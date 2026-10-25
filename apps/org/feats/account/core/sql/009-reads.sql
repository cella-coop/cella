-- Who reads a capital account: its holder, and whoever repays capital,
-- keeps, carries or closes the books, or distributes the surplus; every
-- other account, anyone. The capital the grafts keep, what was called,
-- paid, drawn and is owed, reads the same, as `account`. A write's
-- transaction sees every account.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('account', NULL, 'repay-capital', 'account'),
  ('account', NULL, 'record-entry', 'account'),
  ('account', NULL, 'carry-books', 'account'),
  ('account', NULL, 'close-period', 'account'),
  ('account', NULL, 'distribute-surplus', 'account');

ALTER TABLE account.account ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON account.account FOR SELECT TO cella_app USING (holder IS NULL OR (SELECT cella.sees('account')) OR holder = cella.reader() OR cella.reaches('account', holder));
CREATE POLICY rules ON account.account FOR SELECT TO cella_rules USING (true);
CREATE POLICY writes ON account.account FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON account.account FOR UPDATE TO cella_app USING (true);
