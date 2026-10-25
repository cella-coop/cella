-- The statutes' terms for each year's work share: how it divides among the
-- workers, and what part of an associate's share is employed in shares of
-- the capital rather than paid. A SCOP gives at least 25 % of its surplus
-- to all its employees, associates or not, who count in it at the year's
-- close (loi n° 78-763, art. 33, 3°; BOI-BIC-PTP-10-30, § 90), divided in
-- proportion to pay, to time worked, in equal parts, or by a mix of these
-- (Code du travail, art. L3324-5; BOI-BIC-PTP-10-30, § 170 and 280); never
-- by revenue, which the law does not offer. Employing a share in shares
-- is reserved to the associates employed in the co-op (art. R3323-11), and
-- what is employed so is blocked five years from the first day of the
-- sixth month after the year (art. L3324-10). Terms govern from a fiscal
-- year on, until later terms are adopted; they are drafted, then adopted
-- once, citing the members' decision.
CREATE TABLE account.terms (
  id text PRIMARY KEY,
  "from" integer NOT NULL CHECK ("from" BETWEEN 1900 AND 9999),
  salary numeric(5, 2) NOT NULL DEFAULT 0 CHECK (salary BETWEEN 0 AND 100),
  hours numeric(5, 2) NOT NULL DEFAULT 0 CHECK (hours BETWEEN 0 AND 100),
  equal numeric(5, 2) NOT NULL DEFAULT 0 CHECK (equal BETWEEN 0 AND 100),
  capital numeric(5, 2) NOT NULL DEFAULT 0 CHECK (capital BETWEEN 0 AND 100),
  adopted date
);

COMMENT ON COLUMN account.terms.salary IS 'not personal: the weight the statutes give pay, a percent';

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

-- The terms governing a year: the adopted terms from the latest year not
-- after it, the latest adopted where two start the same year.
CREATE FUNCTION account.terms_for(year integer) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT t.id FROM account.terms t
  WHERE t.adopted IS NOT NULL AND t."from" <= year
  ORDER BY t."from" DESC, t.adopted DESC, t.id DESC
  LIMIT 1
);

-- What terms divide the work share by: one basis, or a mix.
CREATE FUNCTION account.basis_of(ref text) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT CASE WHEN t.salary = 100 THEN 'salary' WHEN t.hours = 100 THEN 'hours' WHEN t.equal = 100 THEN 'equal' ELSE 'mix' END
  FROM account.terms t WHERE t.id = ref
);

-- An allocation names how its work share divides, as its year's terms
-- say, and a mix is one way.
ALTER TABLE account.allocation DROP CONSTRAINT allocation_basis_check;
ALTER TABLE account.allocation ADD CONSTRAINT allocation_basis_check CHECK (basis IN ('salary', 'hours', 'equal', 'mix'));

-- The cents of an allocation's work share each basis divides, by its
-- year's terms, to the cent: the work share split by the terms' weights,
-- so the portions add up to it.
CREATE FUNCTION account.portion(ref text, of text) RETURNS bigint
LANGUAGE sql STABLE
RETURN coalesce((
  SELECT (cella.allocate(
    cella.amount(account.share_of(a.id, 'work')),
    ARRAY[(t.salary * 100)::bigint, (t.hours * 100)::bigint, (t.equal * 100)::bigint]
  ))[array_position(ARRAY['salary', 'hours', 'equal'], of)]
  FROM account.allocation a
  JOIN account.terms t ON t.id = account.terms_for(a.year)
  WHERE a.id = ref AND account.share_of(a.id, 'work') > 0 AND t.salary + t.hours + t.equal > 0
), 0);

-- Each worker's part of an allocation's work share, by basis: what they
-- were paid that year (cents), the minutes they worked, or one equal part,
-- and the cents it gave them. The graft that knows each basis divides its
-- portion when the allocation is allocated, in that write; a part of
-- nothing has no row. The figures are payroll, kept five years.
CREATE TABLE account.part (
  allocation text NOT NULL REFERENCES account.allocation,
  worker text NOT NULL,
  basis text NOT NULL CHECK (basis IN ('salary', 'hours', 'equal')),
  quantity bigint CHECK (quantity > 0),
  amount cella.amount,
  PRIMARY KEY (allocation, worker, basis)
);

COMMENT ON COLUMN account.part.worker IS 'not personal: the worker''s pseudonymous address';

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('account', 'part', 'quantity', 'payroll', 'worker', 'account'),
  ('account', 'part', 'amount', 'payroll', 'worker', 'account');

-- Parts are made in the write that allocates, and never change after,
-- but for the notary's redaction once their clock runs out.
CREATE FUNCTION account.part_fixed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND cella.redacting() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT FROM account.allocation a WHERE a.id = NEW.allocation AND a.allocated = cella.verdict_date()
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'the parts of % are made when it is allocated, and never change', coalesce(NEW.allocation, OLD.allocation)
    USING ERRCODE = 'triggered_action_exception';
END
$$;

CREATE TRIGGER part_fixed BEFORE INSERT OR UPDATE OR DELETE ON account.part
  FOR EACH ROW EXECUTE FUNCTION account.part_fixed();

-- Each basis's parts of an allocation, against its portion.
CREATE FUNCTION account.divided(ref text)
RETURNS TABLE (basis text, parts bigint, portion bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT b.kind,
         coalesce((SELECT sum(cella.cents(p.amount)) FROM account.part p WHERE p.allocation = ref AND p.basis = b.kind), 0)::bigint,
         account.portion(ref, b.kind)
  FROM unnest(ARRAY['salary', 'hours', 'equal']) WITH ORDINALITY AS b (kind, n)
  ORDER BY b.n;
END;

-- account:surplus:allocate — the year has adopted terms, the allocation
-- names their basis, and each basis's parts add up to its portion of the
-- work share, to the cent. That each part is the worker's due on its basis
-- is the rule of the graft that divides it.
CREATE FUNCTION account.divides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN a.id IS NULL THEN NULL
    WHEN account.terms_for(a.year) IS NULL THEN a.year || ' has no adopted terms dividing its work share'
    WHEN a.basis IS DISTINCT FROM account.basis_of(account.terms_for(a.year))
      THEN a.id || ' divides its work share by ' || a.basis || ', not by ' || account.basis_of(account.terms_for(a.year))
        || ' as ' || account.terms_for(a.year) || ' say'
    WHEN EXISTS (SELECT FROM account.divided(a.id) d WHERE d.parts <> d.portion)
      THEN (
        SELECT a.id || '''s parts by ' || d.basis || ' make ' || d.parts || ' cents, not its portion of ' || d.portion
        FROM account.divided(a.id) d WHERE d.parts <> d.portion LIMIT 1
      )
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  LEFT JOIN account.allocation a ON a.id = x.allocation;
END;

-- account:terms:adopt — the write adopted the terms on the verdict date;
-- their weights divide the whole work share; and no year they would
-- govern has its surplus allocated already. That the members decided them
-- is account-decision's.
CREATE FUNCTION account.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN t.id IS NULL THEN 'no terms ' || coalesce(x.terms, 'are named')
    WHEN t.adopted IS DISTINCT FROM cella.verdict_date() THEN t.id || ' were not adopted by this write'
    WHEN t.salary + t.hours + t.equal <> 100
      THEN t.id || ' divide ' || (t.salary + t.hours + t.equal) || ' % of the work share, not 100 %'
    WHEN EXISTS (SELECT FROM account.allocation a WHERE a.year >= t."from" AND a.allocated IS NOT NULL)
      THEN t.id || ' would govern ' || (SELECT min(a.year) FROM account.allocation a WHERE a.year >= t."from" AND a.allocated IS NOT NULL)
        || ', whose surplus is allocated'
  END
  FROM (SELECT payload ->> 'terms' AS terms) x
  LEFT JOIN account.terms t ON t.id = x.terms;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('account:surplus:allocate', 'account.divides(jsonb)', 'account'),
  ('account:terms:adopt', 'account.adopts(jsonb)', 'account');

-- Each worker's statement for a year: their part of the work share, in
-- all and by basis.
CREATE VIEW account.statement AS
SELECT p.allocation || ':' || p.worker AS id, p.allocation, a.year, p.worker,
       sum(cella.cents(p.amount))::bigint AS amount,
       coalesce(sum(cella.cents(p.amount)) FILTER (WHERE p.basis = 'salary'), 0)::bigint AS salary,
       coalesce(sum(cella.cents(p.amount)) FILTER (WHERE p.basis = 'hours'), 0)::bigint AS hours,
       coalesce(sum(cella.cents(p.amount)) FILTER (WHERE p.basis = 'equal'), 0)::bigint AS equal
FROM account.part p
JOIN account.allocation a ON a.id = p.allocation
GROUP BY p.allocation, a.year, p.worker;

GRANT SELECT ON account.terms, account.part, account.statement TO cella_app, cella_rules;
GRANT INSERT ON account.part TO cella_app;
GRANT UPDATE (adopted) ON account.terms TO cella_app;
