-- The financial statements, from the journal, in the account feat's
-- rubrics. The income statement sums the entries dated within a span; the
-- balance sheet, every entry up to the span's last day.

-- Each account's figure on a sheet over a span: its lines' amounts dated
-- from `since` (from the start when null) to `until`, both included, signed
-- by its rubric's side, with the rubric it is presented in.
CREATE FUNCTION account_transaction.figures(sheet text, since date, until date)
RETURNS TABLE (rubric text, code text, label text, amount bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT r.id, a.code, a.label,
         sum(CASE WHEN l.side = r.side THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END)::bigint
  FROM transaction.line l
  JOIN transaction.entry e ON e.id = l.entry
  JOIN account.account a ON a.code = l.account
  JOIN account.rubric r ON r.id = account.rubric_of(figures.sheet, a.code)
  WHERE e.date <= figures.until AND (figures.since IS NULL OR e.date >= figures.since)
  GROUP BY r.id, a.code, a.label;
END;

-- A sheet over a span, rubric by rubric in its order: a line's figure, the
-- sum of its accounts'; a total's, what it adds less what it subtracts,
-- totals expanded down to their lines; a heading's, none.
CREATE FUNCTION account_transaction.statement(sheet text, since date, until date)
RETURNS TABLE (id text, n integer, kind text, label text, amount bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH RECURSIVE lines AS (
    SELECT f.rubric, sum(f.amount)::bigint AS amount
    FROM account_transaction.figures(statement.sheet, statement.since, statement.until) f
    GROUP BY f.rubric
  ),
  terms AS (
    SELECT r.id AS total, x.part, 1 AS sign FROM account.rubric r, unnest(r.adds) x(part) WHERE r.sheet = statement.sheet
    UNION ALL
    SELECT r.id, x.part, -1 FROM account.rubric r, unnest(r.subtracts) x(part) WHERE r.sheet = statement.sheet
  ),
  expanded AS (
    SELECT t.total, t.part, t.sign FROM terms t
    UNION ALL
    SELECT e.total, t.part, e.sign * t.sign FROM expanded e JOIN terms t ON t.total = e.part
  ),
  totals AS (
    SELECT e.total, coalesce(sum(e.sign * l.amount), 0)::bigint AS amount
    FROM expanded e
    JOIN account.rubric r ON r.id = e.part AND r.kind = 'line'
    LEFT JOIN lines l ON l.rubric = e.part
    GROUP BY e.total
  )
  SELECT r.id, r.n, r.kind, r.label,
         CASE r.kind WHEN 'line' THEN coalesce(l.amount, 0) WHEN 'total' THEN coalesce(t.amount, 0) END
  FROM account.rubric r
  LEFT JOIN lines l ON l.rubric = r.id
  LEFT JOIN totals t ON t.total = r.id
  WHERE r.sheet = statement.sheet
  ORDER BY r.n;
END;
