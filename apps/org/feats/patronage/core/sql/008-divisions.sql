-- How each basis divides a distribution's work share among the workers,
-- as the grafts that know it register it: a function of the distribution,
-- `(text) → TABLE (worker text, basis text, quantity bigint, cents bigint)`,
-- answering each worker's quantity and the cents it gives them; the
-- division asked is read on its basis's rows alone, so one function may
-- divide several bases. This feat knows none of them by name, and no
-- extender writes a part or puts a trigger on a distribution.
CREATE TABLE patronage.division (
  basis text PRIMARY KEY CHECK (basis IN ('salary', 'hours', 'equal')),
  fn regprocedure NOT NULL
);

-- Registers the division of a basis. An extender's migration calls it,
-- and never inserts the row itself.
CREATE FUNCTION patronage.register_division(basis text, division regprocedure) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO patronage.division (basis, fn) VALUES (register_division.basis, register_division.division);
END;

REVOKE EXECUTE ON FUNCTION patronage.register_division(text, regprocedure) FROM PUBLIC;

-- Makes a distribution's parts, in the write that approves it: for each
-- basis its year's terms weigh, in the order of the bases, the parts the
-- division registered for it answers. A basis the terms weigh that no
-- division is registered for is refused (SQLSTATE 09000).
CREATE FUNCTION patronage.divide(ref text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  b text;
  f regprocedure;
BEGIN
  FOR b, f IN
    SELECT w.basis, v.fn
    FROM patronage.distribution d
    JOIN patronage.terms t ON t.id = patronage.terms_for(d.year)
    CROSS JOIN LATERAL (VALUES ('salary', t.salary, 1), ('hours', t.hours, 2), ('equal', t.equal, 3)) AS w (basis, weight, n)
    LEFT JOIN patronage.division v ON v.basis = w.basis
    WHERE d.id = ref AND w.weight > 0
    ORDER BY w.n
  LOOP
    IF f IS NULL THEN
      RAISE EXCEPTION '% divides its work share by %, which no division is registered for', ref, b
        USING ERRCODE = 'triggered_action_exception';
    END IF;
    EXECUTE format(
      'INSERT INTO patronage.part (distribution, worker, basis, quantity, amount)
       SELECT $1, v.worker, v.basis, v.quantity, cella.amount(v.cents) FROM %s($1) v WHERE v.basis = $2',
      f::oid::regproc
    ) USING ref, b;
  END LOOP;
END
$$;

GRANT SELECT ON patronage.division TO cella_app, cella_guards;

COMMENT ON TABLE patronage.division IS 'registry: how each basis divides the work share, as the grafts that know it register it';
