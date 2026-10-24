-- A year's surplus and how the statutes split it, one share per kind: the
-- work share, the legal reserve, the development fund and the interest on
-- capital. A share of nothing has no row. The split is drafted before the
-- assembly decides it; allocating it, once its year is closed, posts it.
CREATE TABLE account.allocation (
  id text PRIMARY KEY,
  year integer NOT NULL UNIQUE CHECK (year BETWEEN 1900 AND 9999),
  surplus cella.amount NOT NULL,
  -- How the work share divides among the workers, as the statutes say:
  -- by salary, by hours worked, or equally (art. 33, 3°).
  basis text NOT NULL CHECK (basis IN ('salary', 'hours', 'equal')),
  allocated date
);

CREATE TABLE account.share (
  allocation text NOT NULL REFERENCES account.allocation,
  kind text NOT NULL CHECK (kind IN ('work', 'legal', 'development', 'interest')),
  percent numeric(5, 2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  amount cella.amount NOT NULL,
  PRIMARY KEY (allocation, kind)
);

-- An allocation is made once, and its split never changes after.
CREATE FUNCTION account.stays_allocated() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.allocated IS NOT NULL THEN
    RAISE EXCEPTION 'the % surplus was allocated on %', OLD.year, OLD.allocated
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_allocated BEFORE UPDATE ON account.allocation
  FOR EACH ROW EXECUTE FUNCTION account.stays_allocated();

CREATE FUNCTION account.share_fixed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM account.allocation a WHERE a.id = coalesce(NEW.allocation, OLD.allocation) AND a.allocated IS NOT NULL) THEN
    RAISE EXCEPTION 'the split of % is allocated and never changes', coalesce(NEW.allocation, OLD.allocation)
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;

CREATE TRIGGER share_fixed BEFORE INSERT OR UPDATE OR DELETE ON account.share
  FOR EACH ROW EXECUTE FUNCTION account.share_fixed();

-- A share's amount in cents, nothing where the split holds none.
CREATE FUNCTION account.share_of(ref text, of text) RETURNS bigint
LANGUAGE sql STABLE
RETURN coalesce((SELECT cella.cents(s.amount) FROM account.share s WHERE s.allocation = ref AND s.kind = of), 0);

-- account:surplus:allocate — the write allocated the split on the verdict
-- date, once its year was over and every period of it closed; the shares
-- add up to the surplus, each at its percent to the cent; and they honour
-- the floors of a SCOP's surplus, loi n° 78-763 du 19 juillet 1978, art.
-- 33: the work share at least 25 % (3°), and the interest on capital no
-- more than the reserves' share (1° and 2°) nor the work share (4°). The
-- legal reserve's 15 % (1°) holds until the reserve reaches the highest
-- capital, which the books know: it is account-transaction's rule.
CREATE FUNCTION account.splits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN a.id IS NULL THEN 'no allocation ' || coalesce(x.allocation, 'is named')
    WHEN a.allocated IS DISTINCT FROM cella.verdict_date() THEN a.id || ' was not allocated by this write'
    WHEN cella.verdict_date() < make_date(a.year + 1, 1, 1) THEN a.year || ' is not over'
    WHEN EXISTS (SELECT FROM account.period p WHERE p.month LIKE a.year || '-%' AND p.closed IS NULL)
      THEN a.year || ' has a period still open: '
        || (SELECT min(p.month) FROM account.period p WHERE p.month LIKE a.year || '-%' AND p.closed IS NULL)
    WHEN (SELECT coalesce(sum(cella.cents(s.amount)), 0) FROM account.share s WHERE s.allocation = a.id) <> cella.cents(a.surplus)
      THEN a.id || '''s shares make '
        || (SELECT coalesce(sum(cella.cents(s.amount)), 0) FROM account.share s WHERE s.allocation = a.id)
        || ' cents, not its surplus of ' || cella.cents(a.surplus)
    WHEN EXISTS (
      SELECT FROM account.share s
      WHERE s.allocation = a.id AND abs(cella.cents(s.amount) * 100 - cella.cents(a.surplus) * s.percent) >= 100
    ) THEN a.id || '''s ' || (
      SELECT min(s.kind) FROM account.share s
      WHERE s.allocation = a.id AND abs(cella.cents(s.amount) * 100 - cella.cents(a.surplus) * s.percent) >= 100
    ) || ' share is not its percent of the surplus'
    WHEN account.share_of(a.id, 'work') * 4 < cella.cents(a.surplus)
      THEN a.id || '''s work share is under 25 % of the surplus (loi 78-763, art. 33, 3°)'
    WHEN account.share_of(a.id, 'interest') > account.share_of(a.id, 'legal') + account.share_of(a.id, 'development')
      THEN a.id || '''s interest on capital exceeds what it puts in reserve (loi 78-763, art. 33, 4°)'
    WHEN account.share_of(a.id, 'interest') > account.share_of(a.id, 'work')
      THEN a.id || '''s interest on capital exceeds the work share (loi 78-763, art. 33, 4°)'
  END
  FROM (SELECT payload ->> 'allocation' AS allocation) x
  LEFT JOIN account.allocation a ON a.id = x.allocation;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:surplus:allocate', 'account.splits(jsonb)', 'account');

GRANT SELECT ON account.allocation, account.share TO cella_app, cella_rules;
GRANT UPDATE (allocated) ON account.allocation TO cella_app;
