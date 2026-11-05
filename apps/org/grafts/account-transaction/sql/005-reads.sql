-- Whose an account's lines are, which only this graft knows: a line on an
-- account no one holds reads for every member, and one on a capital
-- account for its holder and whoever reads capital (`account`'s readers),
-- beside the books' own readers. It reads the chart whole, as its owner,
-- since what it answers is whose an account is, and it answers only for
-- the reader, so it tells no one else whose an account is.
CREATE FUNCTION account_transaction.holds(code text, reader text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT coalesce(bool_and(a.holder IS NULL OR a.holder = holds.reader OR a.circle = ANY (cella.circles('account')) OR cella.reaches('account', a.holder)), false)
  FROM account.account a
  WHERE a.code = holds.code AND holds.reader = cella.reader();
END;

INSERT INTO cella.reach (what, fn, owner) VALUES
  ('transaction', 'account_transaction.holds(text, text)', 'account-transaction');

-- The trial balance reads each account and its lines as its reader may:
-- the co-op's own accounts whole, a capital account for whoever reads it.
ALTER VIEW account_transaction.balance SET (security_invoker = true);

-- The statements, rubric by rubric, are the co-op's, which every member
-- reads: they sum the whole journal whoever reads them. The figures of a
-- rubric's accounts read as their lines do.
ALTER FUNCTION account_transaction.statement(text, date, date) SECURITY DEFINER SET search_path = pg_catalog, pg_temp;
COMMENT ON FUNCTION account_transaction.statement(text, date, date) IS 'audience: shared by sheet, id: a sheet''s figures, rubric by rubric, summed over the whole journal';

-- Whether the trial balance agrees, over the whole journal whoever reads
-- it: a member who reads only some accounts' lines still learns whether
-- the co-op's books balance, not whether the part they read does.
CREATE FUNCTION account_transaction.agrees() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
RETURN (SELECT coalesce(sum(b.debit), 0) = coalesce(sum(b.credit), 0) FROM account_transaction.balance b);
