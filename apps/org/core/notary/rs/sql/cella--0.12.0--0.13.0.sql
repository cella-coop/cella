-- cella 0.12.0 to 0.13.0: the ids of the records an entry is about, as
-- text (`cella.about`), and the log's index of them, so the entries about
-- a record are found without reading the log. `ALTER EXTENSION cella
-- UPDATE` runs it; it adds a function and the index alone.

CREATE FUNCTION cella.about(op text, form jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
RETURN ARRAY(
  SELECT form ->> k
  FROM unnest(array_prepend(split_part(op, ':', 2), string_to_array(split_part(op, ':', 1), '-'))) k
  WHERE jsonb_typeof(form -> k) IN ('string', 'number')
);
CREATE INDEX log_about ON cella.log USING gin (cella.about(op, form));
