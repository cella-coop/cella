CREATE SCHEMA patronage_transaction;

-- A distribution posts its split: the year's result (120) debited by the
-- surplus, and each share credited to where it goes, for a French SCOP's
-- chart: the work share to what the workers are owed (424), the legal
-- reserve (1061), the development fund, an indivisible reserve (1068),
-- and the interest on capital to what the members are owed (457).
CREATE TABLE patronage_transaction.distribution (
  distribution text PRIMARY KEY,
  entry text NOT NULL UNIQUE
);

CREATE FUNCTION patronage_transaction.lines(ref text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT '120', 'debit', cella.cents(d.surplus) FROM patronage.distribution d WHERE d.id = ref
  UNION ALL
  SELECT CASE s.kind WHEN 'work' THEN '424' WHEN 'legal' THEN '1061' WHEN 'development' THEN '1068' ELSE '457' END,
         'credit', cella.cents(s.amount)
  FROM patronage.share s WHERE s.distribution = ref;
END;

-- The members' capital, all the accounts of class 101, on a day: what the
-- journal credited them up to it, less what it debited.
CREATE FUNCTION patronage_transaction.capital(day date) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0)
  FROM transaction.line l
  JOIN transaction.entry e ON e.id = l.entry
  WHERE l.account LIKE '101%' AND e.date <= capital.day;
END;

-- The highest the members' capital ever reached, on any day the journal
-- moved it.
CREATE FUNCTION patronage_transaction.highest() RETURNS bigint
LANGUAGE sql STABLE
RETURN coalesce((
  SELECT max(patronage_transaction.capital(e.date))
  FROM transaction.entry e
  WHERE EXISTS (SELECT FROM transaction.line l WHERE l.entry = e.id AND l.account LIKE '101%')
), 0);

-- patronage:distribution:distribute — the distribution is in the books:
-- one entry, dated the day it was distributed, which posts every line of
-- its split. A write posts one entry, so what a graft above posts in the
-- same write, the work share employed in shares, is lines of that entry:
-- they balance among themselves and touch not the year's result (120),
-- and the graft that adds them checks they are exactly its own.
CREATE FUNCTION patronage_transaction.posted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.entry IS NULL THEN coalesce(x.distribution, 'the distribution') || ' posted no entry'
    WHEN e.date IS DISTINCT FROM d.distributed THEN p.entry || ' is not dated on the distribution'
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM patronage_transaction.lines(x.distribution) l)
      EXCEPT ALL
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
    ) THEN p.entry || ' does not post the split of ' || x.distribution
    WHEN EXISTS (
      SELECT FROM (
        (SELECT t.account, t.side, cella.cents(t.amount) AS cents FROM transaction.line t WHERE t.entry = p.entry)
        EXCEPT ALL
        (SELECT l.account, l.side, l.cents FROM patronage_transaction.lines(x.distribution) l)
      ) r
      WHERE r.account = '120'
    ) OR (
      SELECT coalesce(sum(CASE r.side WHEN 'debit' THEN r.cents ELSE -r.cents END), 0) FROM (
        (SELECT t.account, t.side, cella.cents(t.amount) AS cents FROM transaction.line t WHERE t.entry = p.entry)
        EXCEPT ALL
        (SELECT l.account, l.side, l.cents FROM patronage_transaction.lines(x.distribution) l)
      ) r
    ) <> 0 THEN p.entry || ' posts more than the split of ' || x.distribution || ', and not in balance away from the result'
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  LEFT JOIN patronage.distribution d ON d.id = x.distribution
  LEFT JOIN patronage_transaction.distribution p ON p.distribution = x.distribution
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;

-- patronage:distribution:approve — 15 % of the surplus goes to the legal
-- reserve until the reserve reaches the highest amount the capital ever
-- reached (loi n° 78-763 du 19 juillet 1978, art. 33, 1°). The reserve is
-- read from the journal before the distribution is posted, and the
-- capital's highest from every day the journal moved it.
CREATE FUNCTION patronage_transaction.reserves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN patronage.share_of(d.id, 'legal') * 100 < cella.cents(d.surplus) * 15
      AND (
        SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0)
        FROM transaction.line l
        WHERE l.account = '1061'
      ) < patronage_transaction.highest()
      THEN d.id || ' puts less than 15 % in the legal reserve, which is under the highest capital (loi 78-763, art. 33, 1°)'
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  JOIN patronage.distribution d ON d.id = x.distribution;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('patronage:distribution:distribute', 'patronage_transaction.posted(jsonb)', 'patronage-transaction'),
  ('patronage:distribution:approve', 'patronage_transaction.reserves(jsonb)', 'patronage-transaction');

GRANT USAGE ON SCHEMA patronage_transaction TO cella_app, cella_rules;
GRANT SELECT ON patronage_transaction.distribution TO cella_app, cella_rules;
GRANT INSERT ON patronage_transaction.distribution TO cella_app;
