-- import:state:carry — the state a scope held before its log comes in
-- once, as the log's first entry: refused once the log holds any.
CREATE FUNCTION import.carries(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'the state before the log comes in once, as its first entry; the log holds ' || h.n || ' already'
  FROM cella.head h
  WHERE h.n > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('import:state:carry', 'import.carries(jsonb)', 'import');
