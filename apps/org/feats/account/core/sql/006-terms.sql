-- The statutes' capital clauses, adopted once by the members' decision:
-- the value of one share; the fewest shares an associate subscribes; the
-- most monthly instalments they may pay a subscription in; and, for an
-- associate who leaves, the months after the exit before their capital's
-- first repayment and the yearly repayments it is spread over. A SCOP
-- repays a departing associate's shares at their nominal value (loi n°
-- 47-1775 du 10 septembre 1947, art. 18) within five years (Avise, « La
-- Scop », 2014: « l'entreprise a cinq années pour rembourser les parts
-- sociales »; the article setting it is not verified on Légifrance, which
-- refuses the box). Terms govern from a year on, until later terms are
-- adopted. How the work share divides is the patronage feat's terms.
CREATE TABLE account.terms (
  id text PRIMARY KEY,
  "from" integer NOT NULL CHECK ("from" BETWEEN 1900 AND 9999),
  share cella.amount NOT NULL,
  minimum integer NOT NULL CHECK (minimum > 0),
  instalments integer NOT NULL CHECK (instalments > 0),
  delay integer NOT NULL CHECK (delay >= 0),
  repayments integer NOT NULL CHECK (repayments > 0),
  adopted date
);

-- Adopted terms never change; later terms replace them from their year.
CREATE FUNCTION account.stays_adopted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.adopted IS NOT NULL THEN
    RAISE EXCEPTION '% were adopted on %', OLD.id, OLD.adopted
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER stays_adopted BEFORE UPDATE OR DELETE ON account.terms
  FOR EACH ROW EXECUTE FUNCTION account.stays_adopted();

-- The terms whose capital clauses govern a day: the adopted terms from the
-- latest year not after the day's, the latest adopted where two start the
-- same year.
CREATE FUNCTION account.capital_for(day date) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT t.id FROM account.terms t
  WHERE t.adopted IS NOT NULL AND t."from" <= extract(year FROM day)
  ORDER BY t."from" DESC, t.adopted DESC, t.id DESC
  LIMIT 1
);

-- The day each of a capital's repayments falls due, by the clauses of
-- `terms`, for an associate who left on `exited`: the first `delay`
-- months after the exit, the others a year apart.
CREATE FUNCTION account.repayments(terms text, exited date)
RETURNS TABLE (n integer, due date)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT k.n::integer, (exited + make_interval(months => t.delay + 12 * (k.n::integer - 1)))::date
  FROM account.terms t
  CROSS JOIN LATERAL generate_series(1, t.repayments) AS k (n)
  WHERE t.id = terms
  ORDER BY k.n;
END;

-- account:terms:adopt — the write adopted the terms on the verdict date,
-- and their clauses repay a departing associate within five years of the
-- exit. That the members decided them is account-decision's.
CREATE FUNCTION account.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN t.id IS NULL THEN 'no terms ' || coalesce(x.terms, 'are named')
    WHEN t.adopted IS DISTINCT FROM cella.verdict_date() THEN t.id || ' were not adopted by this write'
    WHEN t.delay + 12 * (t.repayments - 1) > 60
      THEN t.id || ' repay a departing associate ' || (t.delay + 12 * (t.repayments - 1)) || ' months after the exit: a SCOP repays within five years'
  END
  FROM (SELECT payload ->> 'terms' AS terms) x
  LEFT JOIN account.terms t ON t.id = x.terms;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:terms:adopt', 'account.adopts(jsonb)', 'account');

-- The powers the capital's money writes need: recording what an
-- associate pays in is recording money received; repaying a departed
-- one's capital is money out of the bank, under its own power. Spreading
-- a subscription over instalments is the associate's own.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:capital:pay', 'record-receipt', NULL, 'account'),
  ('account:capital:repay', 'repay-capital', NULL, 'account');

GRANT SELECT ON account.terms TO cella_app, cella_rules;
GRANT UPDATE (adopted) ON account.terms TO cella_app;
