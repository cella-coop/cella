CREATE SCHEMA patronage;

-- The statutes' terms for each year's work share: how it divides among the
-- workers, and what part of an associate's part is employed in shares of
-- the capital rather than paid. A SCOP gives at least 25 % of its surplus
-- to all its employees, associates or not, who count in it at the year's
-- close (loi n° 78-763, art. 33, 3°; BOI-BIC-PTP-10-30, § 90), divided in
-- proportion to pay, to time worked, in equal parts, or by a mix of these
-- (Code du travail, art. L3324-5; BOI-BIC-PTP-10-30, § 170 and 280); never
-- by revenue, which the law does not offer. Employing a part in shares is
-- reserved to the associates employed in the co-op (art. R3323-11), and
-- what is employed so is blocked five years from the first day of the
-- sixth month after the year (art. L3324-10). Terms are a rule the
-- members adopt by motion, its values named for this feat and copied here
-- as it is adopted; they govern from the fiscal year their rule applies
-- in, until later terms do.
CREATE TABLE patronage.terms (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY,
  -- The rule they copy, `m-2026-013/1`, by its id in the policy register.
  policy text NOT NULL UNIQUE,
  "from" integer NOT NULL CHECK ("from" BETWEEN 1900 AND 9999),
  salary numeric(5, 2) NOT NULL DEFAULT 0 CHECK (salary BETWEEN 0 AND 100),
  hours numeric(5, 2) NOT NULL DEFAULT 0 CHECK (hours BETWEEN 0 AND 100),
  equal numeric(5, 2) NOT NULL DEFAULT 0 CHECK (equal BETWEEN 0 AND 100),
  capital numeric(5, 2) NOT NULL DEFAULT 0 CHECK (capital BETWEEN 0 AND 100),
  adopted date NOT NULL
);

COMMENT ON COLUMN patronage.terms.salary IS 'not personal: the weight the statutes give pay, a percent';

-- Adopted terms never change; later terms replace them from their year.
-- Their body, a free-form discussion, is not a term: an update that
-- changes no other column, their id included, passes, so a save repeated
-- does too.
CREATE FUNCTION patronage.stays_adopted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) - 'body' = to_jsonb(OLD) - 'body' THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION '% were adopted on %', OLD.id, OLD.adopted
    USING ERRCODE = 'triggered_action_exception';
END
$$;

CREATE TRIGGER stays_adopted BEFORE UPDATE OR DELETE ON patronage.terms
  FOR EACH ROW EXECUTE FUNCTION patronage.stays_adopted();

-- The terms governing a year: those from the latest year not after it,
-- the latest adopted where two start the same year.
CREATE FUNCTION patronage.terms_for(year integer) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT t.id FROM patronage.terms t
  WHERE t."from" <= year
  ORDER BY t."from" DESC, t.adopted DESC, t.id DESC
  LIMIT 1
);

-- What terms divide the work share by: one basis, or a mix.
CREATE FUNCTION patronage.basis_of(ref text) RETURNS text
LANGUAGE sql STABLE
RETURN (
  SELECT CASE WHEN t.salary = 100 THEN 'salary' WHEN t.hours = 100 THEN 'hours' WHEN t.equal = 100 THEN 'equal' ELSE 'mix' END
  FROM patronage.terms t WHERE t.id = ref
);

-- A year's distribution of its surplus, one per financial year, and how
-- the statutes split it, one share per kind: the work share, the legal
-- reserve, the development fund and the interest on capital. A share of
-- nothing has no row. The split is drafted, approved by the assembly once
-- its year is closed, and then distributed: posted to the books, after
-- which what each part employs in shares is credited to its associate's
-- capital, by a write of its own.
CREATE TABLE patronage.distribution (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY,
  year integer NOT NULL UNIQUE CHECK (year BETWEEN 1900 AND 9999),
  surplus cella.amount NOT NULL,
  -- How the work share divides among the workers, as the year's terms
  -- say: by salary, by hours worked, equally, or by a mix of these.
  basis text NOT NULL CHECK (basis IN ('salary', 'hours', 'equal', 'mix')),
  approved date,
  distributed date,
  CHECK (distributed IS NULL OR (approved IS NOT NULL AND distributed >= approved))
);

CREATE TABLE patronage.share (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  distribution text NOT NULL REFERENCES patronage.distribution,
  kind text NOT NULL CHECK (kind IN ('work', 'legal', 'development', 'interest')),
  percent numeric(5, 2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  amount cella.amount NOT NULL,
  PRIMARY KEY (distribution, kind)
);

-- A distribution is approved once, and its split never changes after; it
-- is distributed once, after it is approved.
CREATE FUNCTION patronage.stays_approved() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Its body, a free-form discussion, is not part of the split: an
  -- update that changes no other column, its id included, passes, before
  -- or after it is approved or distributed, and when repeated.
  IF to_jsonb(NEW) - 'body' = to_jsonb(OLD) - 'body' THEN
    RETURN NEW;
  END IF;
  IF OLD.distributed IS NOT NULL THEN
    RAISE EXCEPTION 'the % surplus was distributed on %', OLD.year, OLD.distributed
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.approved IS NOT NULL
    AND (NEW.approved, NEW.year, cella.cents(NEW.surplus), NEW.basis) IS DISTINCT FROM (OLD.approved, OLD.year, cella.cents(OLD.surplus), OLD.basis) THEN
    RAISE EXCEPTION 'the % surplus was approved on %', OLD.year, OLD.approved
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NEW.distributed IS NOT NULL AND NEW.approved IS NULL THEN
    RAISE EXCEPTION '% is not approved by the assembly', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_approved BEFORE UPDATE ON patronage.distribution
  FOR EACH ROW EXECUTE FUNCTION patronage.stays_approved();

CREATE FUNCTION patronage.share_fixed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM patronage.distribution d WHERE d.id = coalesce(NEW.distribution, OLD.distribution) AND d.approved IS NOT NULL) THEN
    RAISE EXCEPTION 'the split of % is approved and never changes', coalesce(NEW.distribution, OLD.distribution)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER share_fixed BEFORE INSERT OR UPDATE OR DELETE ON patronage.share
  FOR EACH ROW EXECUTE FUNCTION patronage.share_fixed();

-- A share's amount in cents, nothing where the split holds none.
CREATE FUNCTION patronage.share_of(ref text, of text) RETURNS bigint
LANGUAGE sql STABLE
RETURN coalesce((SELECT cella.cents(s.amount) FROM patronage.share s WHERE s.distribution = ref AND s.kind = of), 0);

-- The cents of a distribution's work share each basis divides, by its
-- year's terms, to the cent: the work share split by the terms' weights
-- with `cella.allocate`, so the portions add up to it.
CREATE FUNCTION patronage.portion(ref text, of text) RETURNS bigint
LANGUAGE sql STABLE
RETURN coalesce((
  SELECT (cella.allocate(
    cella.amount(patronage.share_of(d.id, 'work')),
    ARRAY[(t.salary * 100)::bigint, (t.hours * 100)::bigint, (t.equal * 100)::bigint]
  ))[array_position(ARRAY['salary', 'hours', 'equal'], of)]
  FROM patronage.distribution d
  JOIN patronage.terms t ON t.id = patronage.terms_for(d.year)
  WHERE d.id = ref AND patronage.share_of(d.id, 'work') > 0 AND t.salary + t.hours + t.equal > 0
), 0);

-- Each worker's part of a distribution's work share, by basis: what they
-- were paid that year (cents), the minutes they worked, or one equal part,
-- and the cents it gave them. The graft that knows each basis divides its
-- portion when the distribution is approved, in that write; a part of
-- nothing has no row.
CREATE TABLE patronage.part (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  distribution text NOT NULL REFERENCES patronage.distribution,
  worker text NOT NULL,
  basis text NOT NULL CHECK (basis IN ('salary', 'hours', 'equal')),
  quantity bigint CHECK (quantity > 0),
  amount cella.amount,
  PRIMARY KEY (distribution, worker, basis)
);

COMMENT ON COLUMN patronage.part.worker IS 'not personal: the worker''s pseudonymous address';

-- Parts are made in the write that approves, and never change after, but
-- for the notary's redaction once their clock runs out.
CREATE FUNCTION patronage.part_fixed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND cella.redacting() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT FROM patronage.distribution d WHERE d.id = NEW.distribution AND d.approved = cella.verdict_date() AND d.distributed IS NULL
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'the parts of % are made when it is approved, and never change', coalesce(NEW.distribution, OLD.distribution)
    USING ERRCODE = 'triggered_action_exception';
END
$$;

CREATE TRIGGER part_fixed BEFORE INSERT OR UPDATE OR DELETE ON patronage.part
  FOR EACH ROW EXECUTE FUNCTION patronage.part_fixed();

-- Each basis's parts of a distribution, against its portion.
CREATE FUNCTION patronage.divided(ref text)
RETURNS TABLE (basis text, parts bigint, portion bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT b.kind,
         coalesce((SELECT sum(cella.cents(p.amount)) FROM patronage.part p WHERE p.distribution = ref AND p.basis = b.kind), 0)::bigint,
         patronage.portion(ref, b.kind)
  FROM unnest(ARRAY['salary', 'hours', 'equal']) WITH ORDINALITY AS b (kind, n)
  ORDER BY b.n;
END;

-- Each worker's statement for a year: their part of the work share, in
-- all and by basis, owned by the circle that owns its distribution.
CREATE VIEW patronage.statement AS
SELECT p.distribution || ':' || p.worker AS id, p.distribution, d.year, p.worker, d.circle,
       sum(cella.cents(p.amount))::bigint AS amount,
       coalesce(sum(cella.cents(p.amount)) FILTER (WHERE p.basis = 'salary'), 0)::bigint AS salary,
       coalesce(sum(cella.cents(p.amount)) FILTER (WHERE p.basis = 'hours'), 0)::bigint AS hours,
       coalesce(sum(cella.cents(p.amount)) FILTER (WHERE p.basis = 'equal'), 0)::bigint AS equal
FROM patronage.part p
JOIN patronage.distribution d ON d.id = p.distribution
GROUP BY p.distribution, d.year, p.worker, d.circle;

-- patronage:distribution:approve — the write approved the split on the
-- verdict date, once its year was over; the shares add up to the surplus,
-- each at its percent to the cent; and they honour the floors of a SCOP's
-- surplus, loi n° 78-763 du 19 juillet 1978, art. 33: the work share at
-- least 25 % (3°), and the interest on capital no more than the reserves'
-- share (1° and 2°) nor the work share (4°). The legal reserve's 15 % (1°)
-- holds until the reserve reaches the highest capital, which the books
-- know: it is patronage-transaction's guard; that every period of the year
-- is closed, account-patronage's.
CREATE FUNCTION patronage.splits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no distribution ' || coalesce(x.distribution, 'is named')
    WHEN d.approved IS DISTINCT FROM cella.verdict_date() THEN d.id || ' was not approved by this write'
    WHEN cella.verdict_date() < make_date(d.year + 1, 1, 1) THEN d.year || ' is not over'
    WHEN (SELECT coalesce(sum(cella.cents(s.amount)), 0) FROM patronage.share s WHERE s.distribution = d.id) <> cella.cents(d.surplus)
      THEN d.id || '''s shares make '
        || (SELECT coalesce(sum(cella.cents(s.amount)), 0) FROM patronage.share s WHERE s.distribution = d.id)
        || ' cents, not its surplus of ' || cella.cents(d.surplus)
    WHEN EXISTS (
      SELECT FROM patronage.share s
      WHERE s.distribution = d.id AND abs(cella.cents(s.amount) * 100 - cella.cents(d.surplus) * s.percent) >= 100
    ) THEN d.id || '''s ' || (
      SELECT min(s.kind) FROM patronage.share s
      WHERE s.distribution = d.id AND abs(cella.cents(s.amount) * 100 - cella.cents(d.surplus) * s.percent) >= 100
    ) || ' share is not its percent of the surplus'
    WHEN patronage.share_of(d.id, 'work') * 4 < cella.cents(d.surplus)
      THEN d.id || '''s work share is under 25 % of the surplus (loi 78-763, art. 33, 3°)'
    WHEN patronage.share_of(d.id, 'interest') > patronage.share_of(d.id, 'legal') + patronage.share_of(d.id, 'development')
      THEN d.id || '''s interest on capital exceeds what it puts in reserve (loi 78-763, art. 33, 4°)'
    WHEN patronage.share_of(d.id, 'interest') > patronage.share_of(d.id, 'work')
      THEN d.id || '''s interest on capital exceeds the work share (loi 78-763, art. 33, 4°)'
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  LEFT JOIN patronage.distribution d ON d.id = x.distribution;
END;

-- patronage:distribution:approve — the year has adopted terms, the
-- distribution names their basis, and each basis's parts add up to its
-- portion of the work share, to the cent. That each part is the worker's
-- due on its basis is the guard of the graft that divides it.
CREATE FUNCTION patronage.divides(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN NULL
    WHEN patronage.terms_for(d.year) IS NULL THEN d.year || ' has no adopted terms dividing its work share'
    WHEN d.basis IS DISTINCT FROM patronage.basis_of(patronage.terms_for(d.year))
      THEN d.id || ' divides its work share by ' || d.basis || ', not by ' || patronage.basis_of(patronage.terms_for(d.year))
        || ' as ' || patronage.terms_for(d.year) || ' say'
    WHEN EXISTS (SELECT FROM patronage.divided(d.id) v WHERE v.parts <> v.portion)
      THEN (
        SELECT d.id || '''s parts by ' || v.basis || ' make ' || v.parts || ' cents, not its portion of ' || v.portion
        FROM patronage.divided(d.id) v WHERE v.parts <> v.portion LIMIT 1
      )
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  LEFT JOIN patronage.distribution d ON d.id = x.distribution;
END;

-- patronage:distribution:distribute — the write distributed an approved
-- split on the verdict date. What it posts is the guard of the graft that
-- posts.
CREATE FUNCTION patronage.distributes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no distribution ' || coalesce(x.distribution, 'is named')
    WHEN d.approved IS NULL THEN d.id || ' is not approved by the assembly'
    WHEN d.distributed IS DISTINCT FROM cella.verdict_date() THEN d.id || ' was not distributed by this write'
  END
  FROM (SELECT payload ->> 'distribution' AS distribution) x
  LEFT JOIN patronage.distribution d ON d.id = x.distribution;
END;

-- patronage:part:employ — a part is employed in shares once its split is
-- distributed, and the worker the payload names has a part in it. What
-- it buys, and its credit, are the guards of the graft that credits.
CREATE FUNCTION patronage.employs(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no distribution ' || coalesce(x.distribution, 'is named')
    WHEN d.distributed IS NULL THEN d.id || ' is not distributed'
    WHEN NOT EXISTS (SELECT FROM patronage.part p WHERE p.distribution = d.id AND p.worker = x.worker)
      THEN coalesce(x.worker, 'no one') || ' has no part in ' || d.id
  END
  FROM (SELECT payload ->> 'distribution' AS distribution, payload ->> 'member' AS worker) x
  LEFT JOIN patronage.distribution d ON d.id = x.distribution;
END;

-- patronage:terms:adopt — the write copied the rule it names into the
-- terms on the verdict date (`patronage.copies`, beside the rule's
-- functions, holds them to its values); their weights divide the whole work share; and no year they would
-- govern has its distribution approved already. That the members decided
-- them is motion-patronage's.
CREATE FUNCTION patronage.adopts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN t.id IS NULL THEN 'no terms copy ' || coalesce(x.policy, 'a rule')
    WHEN t.id IS DISTINCT FROM x.terms OR t.adopted IS DISTINCT FROM cella.verdict_date() THEN t.id || ' were not adopted by this write'
    WHEN t.salary + t.hours + t.equal <> 100
      THEN t.id || ' divide ' || (t.salary + t.hours + t.equal) || ' % of the work share, not 100 %'
    WHEN EXISTS (SELECT FROM patronage.distribution d WHERE d.year >= t."from" AND d.approved IS NOT NULL)
      THEN t.id || ' would govern ' || (SELECT min(d.year) FROM patronage.distribution d WHERE d.year >= t."from" AND d.approved IS NOT NULL)
        || ', whose distribution is approved'
  END
  FROM (SELECT payload ->> 'policy' AS policy, payload ->> 'terms' AS terms) x
  LEFT JOIN patronage.terms t ON t.policy = x.policy;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('patronage:distribution:approve', 'patronage.splits(jsonb)', 'patronage'),
  ('patronage:distribution:approve', 'patronage.divides(jsonb)', 'patronage'),
  ('patronage:distribution:distribute', 'patronage.distributes(jsonb)', 'patronage'),
  ('patronage:part:employ', 'patronage.employs(jsonb)', 'patronage'),
  ('patronage:terms:adopt', 'patronage.adopts(jsonb)', 'patronage');

GRANT USAGE ON SCHEMA patronage TO cella_app, cella_guards;
GRANT SELECT ON patronage.terms, patronage.distribution, patronage.share, patronage.part, patronage.statement TO cella_app, cella_guards;
GRANT INSERT ON patronage.part TO cella_app;
GRANT INSERT ON patronage.terms TO cella_app;
GRANT UPDATE (approved, distributed) ON patronage.distribution TO cella_app;
