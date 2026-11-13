-- The notary at 0.13.0: the log's index of the records its entries are
-- about (`cella.about`). A database made before it is upgraded in place;
-- the read of each record's first and latest entries is org core's,
-- beside `cella.records`.
ALTER EXTENSION cella UPDATE;

-- Each id's first and latest settled entries about it, their dates and
-- actors: when the record was created and last updated, and by whom, as
-- the core read gives every collection's rows them. A forgone effect
-- changed nothing and counts for neither; an id no entry names has no
-- row. A thousand ids or fewer, as a page's, are found through the log's
-- index; more, as a view keeping every row by them asks, by one read of
-- the log, since the index looks many ids up at once at a cost that grows
-- with the square of their number. What it gives, an entry's date and
-- actor and the ids `cella.records` names, is every reader's already.
CREATE FUNCTION cella.made(ids text[])
RETURNS TABLE (id text, created date, created_by text, updated date, updated_by text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF coalesce(cardinality(ids), 0) = 0 THEN
    RETURN;
  ELSIF cardinality(ids) <= 1000 THEN
    RETURN QUERY
      SELECT a.id, f.date, f.actor, u.date, u.actor
      FROM (SELECT x.id, min(l.n) AS first, max(l.n) AS last
            FROM cella.log l CROSS JOIN LATERAL unnest(cella.about(l.op, l.form)) x(id)
            WHERE cella.about(l.op, l.form) && made.ids AND l.settled AND x.id = ANY (made.ids)
            GROUP BY x.id) a
      JOIN cella.log f ON f.n = a.first JOIN cella.log u ON u.n = a.last;
  ELSE
    RETURN QUERY
      SELECT a.id, f.date, f.actor, u.date, u.actor
      FROM (SELECT x.id, min(l.n) AS first, max(l.n) AS last
            FROM cella.log l CROSS JOIN LATERAL unnest(cella.about(l.op, l.form)) x(id)
            JOIN (SELECT DISTINCT i FROM unnest(made.ids) i) i ON i.i = x.id
            WHERE l.settled
            GROUP BY x.id) a
      JOIN cella.log f ON f.n = a.first JOIN cella.log u ON u.n = a.last;
  END IF;
END
$$;
