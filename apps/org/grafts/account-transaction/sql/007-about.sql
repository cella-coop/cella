-- What each entry is about, by the chart, for the journal's list: its
-- category, the income or expense accounts it posts to, else, for a
-- payment or a return that only moves money between the balance sheet's
-- accounts, the non-cash ones; and its flow, income, expense or a move.
-- It reads every line as its owner, in one pass: the list joins it onto
-- the entries its reader reads, so it tells nothing of another, and
-- reading each line by its row-level policy again doubled the list's
-- seconds. It names only the accounts no one holds, the chart's own, so a
-- capital account's label, which names its member, is never told: an
-- entry on one is about "Members".
CREATE FUNCTION account_transaction.about() RETURNS TABLE (id text, category text, flow text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT
    l.entry,
    coalesce(
      string_agg(DISTINCT a.label, ' · ') FILTER (WHERE a.kind IN ('income', 'expense') AND a.holder IS NULL),
      string_agg(DISTINCT a.label, ' · ') FILTER (WHERE NOT a.cash AND a.holder IS NULL),
      CASE WHEN bool_or(a.holder IS NOT NULL) THEN 'Members' END),
    CASE WHEN bool_or(a.kind = 'income') THEN 'income' WHEN bool_or(a.kind = 'expense') THEN 'expense' ELSE 'move' END
  FROM transaction.line l JOIN account.account a ON a.code = l.account
  GROUP BY l.entry;
END;

COMMENT ON FUNCTION account_transaction.about() IS 'audience: shared by id, category, flow: the chart''s own account names an entry posts to and whether it is income, expense or a move, never a held account''s name nor any amount; the journal''s list joins it onto the entries its reader reads';
