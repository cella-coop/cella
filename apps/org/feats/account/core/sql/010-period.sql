-- account:period:open — the write opened the period, and the books' months
-- follow one another with no gap, as they close one after another: the
-- month opened is the one after the latest, or before the first. Opening
-- a month already open changes nothing. That a year's periods are its
-- twelve months is the books' own: a fiscal year off the calendar is not
-- built.
CREATE FUNCTION account.opens(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.month IS NULL THEN 'no period ' || coalesce(x.month, 'is named')
    WHEN s.held <> s.spanned THEN p.month || ' leaves a gap in the periods, which follow one another from ' || s.first || ' to ' || s.last
  END
  FROM (SELECT payload ->> 'month' AS month) x
  LEFT JOIN account.period p ON p.month = x.month
  CROSS JOIN (
    SELECT count(*) AS held, min(q.month) AS first, max(q.month) AS last,
           (extract(year FROM age(to_date(max(q.month), 'YYYY-MM'), to_date(min(q.month), 'YYYY-MM'))) * 12
             + extract(month FROM age(to_date(max(q.month), 'YYYY-MM'), to_date(min(q.month), 'YYYY-MM'))) + 1)::bigint AS spanned
    FROM account.period q
  ) s;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:period:open', 'account.opens(jsonb)', 'account');

-- Finance keeps the periods: the power that closes them opens them.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:period:open', 'close-period', NULL, 'account');

GRANT INSERT ON account.period TO cella_app;
