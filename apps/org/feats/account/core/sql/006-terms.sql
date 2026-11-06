-- The statutes' capital clauses, a rule the members adopt by motion, its
-- values named for this feat and copied here as it is adopted: the value
-- of one share; the fewest shares an associate subscribes; the most
-- monthly instalments they may pay a subscription in; and, for an
-- associate who leaves, the months after the exit before their capital's
-- first repayment and the yearly repayments it is spread over. A SCOP
-- repays a departing associate's shares at their nominal value (loi n°
-- 47-1775 du 10 septembre 1947, art. 18) within five years (Avise, « La
-- Scop », 2014: « l'entreprise a cinq années pour rembourser les parts
-- sociales »; the article setting it is not verified on Légifrance, which
-- refuses the box). Terms govern from the day their rule applies, until
-- later terms do. How the work share divides is the patronage feat's
-- terms.
CREATE TABLE account.terms (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY,
  -- The rule they copy, `m-2026-013/1`, by its id in the policy register.
  policy text NOT NULL UNIQUE,
  "from" date NOT NULL,
  share cella.amount NOT NULL,
  minimum integer NOT NULL CHECK (minimum > 0),
  instalments integer NOT NULL CHECK (instalments > 0),
  delay integer NOT NULL CHECK (delay >= 0),
  repayments integer NOT NULL CHECK (repayments > 0),
  adopted date NOT NULL
);

-- Adopted terms never change; later terms replace them from their day.
CREATE FUNCTION account.stays_adopted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% were adopted on %', OLD.id, OLD.adopted
    USING ERRCODE = 'triggered_action_exception';
END
$$;

CREATE TRIGGER stays_adopted BEFORE UPDATE OR DELETE ON account.terms
  FOR EACH ROW EXECUTE FUNCTION account.stays_adopted();

-- The values a capital rule marks, typed, from its values by name as
-- written (`{"account_share": "25 €", "account_minimum": "10"}`): the
-- share in cents, the others whole numbers, or null where one is not.
CREATE FUNCTION account.capital(marked jsonb) RETURNS TABLE (
  share bigint, minimum integer, instalments integer, delay integer, repayments integer
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT
    (SELECT (t.value #>> '{}')::bigint FROM policy.typed('account_share', marked ->> 'account_share') t WHERE t.type = 'amount'),
    (SELECT (t.value #>> '{}')::integer FROM policy.typed('account_minimum', marked ->> 'account_minimum') t
     WHERE t.type = 'number' AND (t.value #>> '{}') ~ '^[0-9]+$'),
    (SELECT (t.value #>> '{}')::integer FROM policy.typed('account_instalments', marked ->> 'account_instalments') t
     WHERE t.type = 'number' AND (t.value #>> '{}') ~ '^[0-9]+$'),
    (SELECT (t.value #>> '{}')::integer FROM policy.typed('account_delay', marked ->> 'account_delay') t
     WHERE t.type = 'number' AND (t.value #>> '{}') ~ '^[0-9]+$'),
    (SELECT (t.value #>> '{}')::integer FROM policy.typed('account_repayments', marked ->> 'account_repayments') t
     WHERE t.type = 'number' AND (t.value #>> '{}') ~ '^[0-9]+$');
END;

-- Whether a rule's values, by name, are this feat's to read: it marks a
-- value named `account_…`.
CREATE FUNCTION account.reads(marked jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE
RETURN EXISTS (SELECT FROM jsonb_object_keys(coalesce(marked, '{}')) k WHERE k LIKE 'account\_%');

-- What is wrong with the capital terms a rule's values would make, by
-- name as written, or null: it marks the share, an amount, and the
-- fewest shares, the instalments, the delay and the repayments, whole
-- numbers, and no other value of this feat's; and it repays a departing
-- associate within five years of the exit.
CREATE FUNCTION account.terms_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.other IS NOT NULL THEN 'the capital''s terms mark account_share, account_minimum, account_instalments, account_delay and account_repayments, not ' || x.other
    WHEN x.missing IS NOT NULL THEN 'the capital''s terms mark ' || x.missing || ' too'
    WHEN c.share IS NULL OR c.share <= 0 THEN 'account_share is the value of a share, an amount, as 50 €, not ' || (marked ->> 'account_share')
    WHEN c.minimum IS NULL OR c.minimum = 0 THEN 'account_minimum is the fewest shares, a whole number, not ' || (marked ->> 'account_minimum')
    WHEN c.instalments IS NULL OR c.instalments = 0 THEN 'account_instalments is how many monthly instalments, a whole number, not ' || (marked ->> 'account_instalments')
    WHEN c.delay IS NULL THEN 'account_delay is the months before the first repayment, a whole number, not ' || (marked ->> 'account_delay')
    WHEN c.repayments IS NULL OR c.repayments = 0 THEN 'account_repayments is how many yearly repayments, a whole number, not ' || (marked ->> 'account_repayments')
    WHEN c.delay + 12 * (c.repayments - 1) > 60
      THEN 'the capital''s terms repay a departing associate ' || (c.delay + 12 * (c.repayments - 1)) || ' months after the exit: a SCOP repays within five years'
  END
  FROM account.capital(marked) c,
  LATERAL (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k LIKE 'account\_%' AND k NOT IN ('account_share', 'account_minimum', 'account_instalments', 'account_delay', 'account_repayments')
            ORDER BY k LIMIT 1) AS other,
           (SELECT k FROM unnest(ARRAY['account_share', 'account_minimum', 'account_instalments', 'account_delay', 'account_repayments']) k
            WHERE NOT coalesce(marked, '{}') ? k LIMIT 1) AS missing
  ) x;
END;

-- A rule's values in the register, by name as written.
CREATE FUNCTION account.marked_by(ref text) RETURNS jsonb
LANGUAGE sql STABLE
RETURN (SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref);

-- Copies a capital rule's values into the terms they make, in the write
-- that adopts them, from the day the rule applies, adopted the day it
-- was. Returns the terms, or
-- null for a policy that is no rule of this feat's; a rule copied already,
-- or values that make no terms, are refused (SQLSTATE 09000).
CREATE FUNCTION account.terms_from(ref text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  marked jsonb := account.marked_by(ref);
  wrong text;
  made text;
BEGIN
  IF NOT EXISTS (SELECT FROM policy.policy p WHERE p.id = ref AND p.kind = 'rule') OR NOT account.reads(marked) THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT FROM account.terms t WHERE t.policy = ref) THEN
    RAISE EXCEPTION '% are copied into terms already', ref USING ERRCODE = 'triggered_action_exception';
  END IF;
  wrong := account.terms_flaw(marked);
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO account.terms (id, policy, "from", share, minimum, instalments, delay, repayments, adopted)
  SELECT replace(p.id, '/', '-'), p.id, p.applies, cella.amount(c.share), c.minimum, c.instalments, c.delay, c.repayments, p.adopted
  FROM policy.policy p, account.capital(marked) c
  WHERE p.id = ref
  RETURNING id INTO made;
  RETURN made;
END
$$;

-- The terms whose capital clauses govern a day: those whose rule applies
-- latest, on the day or before, the latest adopted where two apply the
-- same day.
CREATE FUNCTION account.capital_for(day date) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT t.id FROM account.terms t
  WHERE t."from" <= day
  ORDER BY t."from" DESC, t.adopted DESC, t.id DESC
  LIMIT 1
);

-- What is wrong with subscribing that many shares on that day, or null:
-- no terms govern it; fewer shares than the minimum of those that do,
-- saying the minimum, the rule that sets it and the shares asked; or its
-- month closed, saying the month and the first open one. It names no
-- person, so a reason it gives may enter the log: the subscription's
-- guard calls it at the close, and account-motion's on the proposal.
CREATE FUNCTION account.subscribe_flaw(shares integer, day date) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN t.id IS NULL THEN 'no adopted terms value a share on ' || to_char(day, 'YYYY-MM-DD')
      || ': the members adopt the capital''s terms by motion first'
    WHEN shares < t.minimum THEN shares || ' shares are fewer than the ' || t.minimum || ' the capital''s terms ask, by '
      || t.policy || coalesce(' ("' || policy.says(t.policy) || '")', '') || ': ask at least ' || t.minimum || ' shares'
    WHEN p.closed IS NOT NULL THEN p.month || ' is closed, so nothing subscribed on ' || to_char(day, 'YYYY-MM-DD') || ' posts into it: '
      || coalesce('the first open month is ' || o.month, 'no month of the books is open')
  END
  FROM (SELECT account.capital_for(day) AS id) c
  LEFT JOIN account.terms t ON t.id = c.id
  LEFT JOIN account.period p ON p.month = to_char(day, 'YYYY-MM')
  CROSS JOIN (SELECT min(q.month) AS month FROM account.period q WHERE q.closed IS NULL) o;
END;

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

-- account:terms:adopt — the write copied the capital rule it names into
-- terms on the verdict date, from the day the rule applies, its values as
-- the rule marks them, and they repay a departing associate within five
-- years of the exit. That the members adopted the rule is account-motion's.
CREATE FUNCTION account.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN t.id IS NULL THEN 'no terms copy ' || coalesce(x.policy, 'a rule')
    WHEN t.id IS DISTINCT FROM x.terms OR t.adopted IS DISTINCT FROM cella.verdict_date() THEN t.id || ' were not adopted by this write'
    WHEN NOT EXISTS (
      SELECT FROM policy.policy p, account.capital(account.marked_by(p.id)) c
      WHERE p.id = t.policy AND p.kind = 'rule' AND p.applies = t."from"
        AND (c.share, c.minimum, c.instalments, c.delay, c.repayments)
          IS NOT DISTINCT FROM (cella.cents(t.share), t.minimum, t.instalments, t.delay, t.repayments)
    ) THEN t.id || ' are not what ' || t.policy || ' marks'
    WHEN t.delay + 12 * (t.repayments - 1) > 60
      THEN t.id || ' repay a departing associate ' || (t.delay + 12 * (t.repayments - 1)) || ' months after the exit: a SCOP repays within five years'
  END
  FROM (SELECT payload ->> 'policy' AS policy, payload ->> 'terms' AS terms) x
  LEFT JOIN account.terms t ON t.policy = x.policy;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:terms:adopt', 'account.adopts(jsonb)', 'account');

-- The powers the capital's money writes need: recording what an
-- associate pays in is recording money received; repaying a departed
-- one's capital is money out of the bank, under its own power. Spreading
-- a subscription over instalments is the associate's own.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:capital:pay', 'record-receipt', NULL, 'account'),
  ('account:capital:repay', 'repay-capital', NULL, 'account');

GRANT SELECT ON account.terms TO cella_app, cella_guards;
GRANT INSERT ON account.terms TO cella_app;
