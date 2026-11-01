-- patronage:distribution:approve — the interest on capital comes to no
-- more than the rate its year's terms adopted of the members' capital
-- (loi n° 47-1775 du 10 septembre 1947, art. 14), to the cent below: the
-- capital the journal holds on the day the split is approved, before the
-- shares the work share buys. That the terms' rate is within the law's
-- ceiling is the members' to adopt; the TMO is not known here.
CREATE FUNCTION patronage_transaction.interest(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.interest > c.cap
      THEN c.id || '''s interest on capital of ' || c.interest || ' cents exceeds the ' || c.rate
        || ' % its terms pay on ' || c.capital || ' cents of capital, ' || c.cap || ' cents (loi 47-1775, art. 14)'
  END
  FROM (
    SELECT d.id, patronage.share_of(d.id, 'interest') AS interest, coalesce(t.interest, 0) AS rate,
           patronage_transaction.capital(cella.verdict_date()) AS capital,
           floor(greatest(patronage_transaction.capital(cella.verdict_date()), 0) * coalesce(t.interest, 0) / 100)::bigint AS cap
    FROM (SELECT payload ->> 'distribution' AS distribution) x
    JOIN patronage.distribution d ON d.id = x.distribution
    LEFT JOIN patronage.terms t ON t.id = patronage.terms_for(d.year)
  ) c;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('patronage:distribution:approve', 'patronage_transaction.interest(jsonb)', 'patronage-transaction');
