CREATE SCHEMA account_patronage;

-- patronage:distribution:approve — a year's surplus is approved once
-- every period of its year is closed: the books it was drawn from no
-- longer change. The period is an account's and the distribution
-- patronage's; neither feat sees both.
CREATE FUNCTION account_patronage.closed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT d.year || ' has a period still open: ' || min(p.month)
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  JOIN patronage.distribution d ON d.id = x.distribution
  JOIN account.period p ON p.month LIKE d.year || '-%' AND p.closed IS NULL
  GROUP BY d.year;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('patronage:distribution:approve', 'account_patronage.closed(jsonb)', 'account-patronage');

GRANT USAGE ON SCHEMA account_patronage TO cella_app, cella_rules;
