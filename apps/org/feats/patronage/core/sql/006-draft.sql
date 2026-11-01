-- Drafting by a write what adoption and approval act on: the statutes'
-- terms, and a year's distribution of its surplus. A draft is a register:
-- drafting the same terms, or the same year, again replaces it, the
-- latest standing, until it is adopted or approved, after which it never
-- changes (`stays_adopted`, `stays_approved`, `share_fixed`). Percents
-- arrive in hundredths, as a signed request holds integers only.

-- patronage:terms:draft — the write drafted the terms as its request
-- says, not yet adopted, and their weights divide the whole work share.
CREATE FUNCTION patronage.drafts_terms(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN t.id IS NULL THEN 'no terms ' || coalesce(x.terms, 'are named')
    WHEN t.adopted IS NOT NULL THEN t.id || ' were adopted on ' || t.adopted
    WHEN (t."from", t.salary * 100, t.hours * 100, t.equal * 100, t.capital * 100, t.interest * 100)
      IS DISTINCT FROM (x."from", x.salary, x.hours, x.equal, x.capital, x.interest)
      THEN t.id || ' were not drafted by this write'
    WHEN t.salary + t.hours + t.equal <> 100
      THEN t.id || ' divide ' || (t.salary + t.hours + t.equal) || ' % of the work share, not 100 %'
  END
  FROM (
    SELECT payload ->> 'terms' AS terms, (payload ->> 'from')::integer AS "from",
           (payload ->> 'salary')::numeric AS salary, (payload ->> 'hours')::numeric AS hours,
           (payload ->> 'equal')::numeric AS equal, (payload ->> 'capital')::numeric AS capital,
           (payload ->> 'interest')::numeric AS interest
  ) x
  LEFT JOIN patronage.terms t ON t.id = x.terms;
END;

-- patronage:distribution:draft — the write drafted the year's split as
-- its request says, not yet approved: a surplus, which an amount holds
-- as more than nothing, its shares' percents adding up to the whole of
-- it, and the basis of the terms governing the year, which it must have. Whether the split honours the law's floors is
-- judged when the assembly approves it (`patronage.splits`).
CREATE FUNCTION patronage.drafts(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no distribution for ' || coalesce(x.year::text, 'a year')
    WHEN d.approved IS NOT NULL THEN d.id || ' was approved on ' || d.approved
    WHEN cella.cents(d.surplus) IS DISTINCT FROM x.surplus THEN d.id || ' was not drafted by this write'
    WHEN patronage.terms_for(d.year) IS NULL THEN d.year || ' has no adopted terms dividing its work share'
    WHEN (SELECT coalesce(sum(s.percent), 0) FROM patronage.share s WHERE s.distribution = d.id) <> 100
      THEN d.id || '''s shares make ' || (SELECT coalesce(sum(s.percent), 0) FROM patronage.share s WHERE s.distribution = d.id)
        || ' % of its surplus, not 100 %'
  END
  FROM (SELECT (payload ->> 'year')::integer AS year, (payload ->> 'surplus')::bigint AS surplus) x
  LEFT JOIN patronage.distribution d ON d.year = x.year;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('patronage:terms:draft', 'patronage.drafts_terms(jsonb)', 'patronage'),
  ('patronage:distribution:draft', 'patronage.drafts(jsonb)', 'patronage');

-- Drafting is the books' keeper's, as distributing is: finance prepares
-- what the assembly decides.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('patronage:terms:draft', 'distribute-surplus', NULL, 'patronage'),
  ('patronage:distribution:draft', 'distribute-surplus', NULL, 'patronage');

GRANT INSERT ON patronage.terms, patronage.distribution TO cella_app;
GRANT UPDATE ("from", salary, hours, equal, capital, interest) ON patronage.terms TO cella_app;
GRANT UPDATE (surplus, basis) ON patronage.distribution TO cella_app;
GRANT INSERT, DELETE ON patronage.share TO cella_app;
