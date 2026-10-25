-- Who reads the books: whoever keeps, carries or closes them reads every
-- line; a graft that knows whose an account is opens its lines to more
-- readers, `key` naming the line's account, as the co-op's own accounts'
-- to every member. An entry reads wherever one of its lines does. A
-- write's transaction sees the whole journal, as its rules do.
INSERT INTO cella.reading (what, key, power, owner) VALUES
  ('transaction', NULL, 'record-entry', 'transaction'),
  ('transaction', NULL, 'carry-books', 'transaction'),
  ('transaction', NULL, 'close-period', 'transaction');

ALTER TABLE transaction.entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction.line ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON transaction.line FOR SELECT TO cella_app
  USING ((SELECT cella.sees('transaction')) OR cella.reaches('transaction', account));
CREATE POLICY reads ON transaction.entry FOR SELECT TO cella_app
  USING ((SELECT cella.sees('transaction')) OR EXISTS (SELECT FROM transaction.line l WHERE l.entry = entry.id));

CREATE POLICY rules ON transaction.entry FOR SELECT TO cella_rules USING (true);
CREATE POLICY rules ON transaction.line FOR SELECT TO cella_rules USING (true);

CREATE POLICY writes ON transaction.entry FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY writes ON transaction.line FOR INSERT TO cella_app WITH CHECK (true);

-- An entry's amount, what its debits add up to, whole for whoever reads
-- the entry: a line the reader may not read still counts, so an entry on
-- a capital account balances to the amount its bank line shows.
CREATE FUNCTION transaction.amount(entry text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
RETURN (SELECT coalesce(sum(cella.cents(l.amount)), 0)::bigint FROM transaction.line l WHERE l.entry = amount.entry AND l.side = 'debit');
