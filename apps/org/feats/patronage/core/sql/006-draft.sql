-- Drafting by a write what the assembly's approval acts on: a year's
-- distribution of its surplus. A draft is a register: drafting the same
-- year again replaces it, the latest standing, until it is approved,
-- after which it never changes (`stays_approved`, `share_fixed`).

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
  ('patronage:distribution:draft', 'patronage.drafts(jsonb)', 'patronage');

-- Drafting is the books' keeper's, as distributing is: finance prepares
-- what the assembly decides.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('patronage:distribution:draft', 'distribute-surplus', NULL, 'patronage');

GRANT INSERT ON patronage.distribution TO cella_app;
GRANT UPDATE (surplus, basis) ON patronage.distribution TO cella_app;
GRANT INSERT, DELETE ON patronage.share TO cella_app;
