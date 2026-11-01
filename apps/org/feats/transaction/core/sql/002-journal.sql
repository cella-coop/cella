-- Entry ids are gapless: the FEC export (rung 3) requires a continuous
-- journal. Each entry takes the next number from a counter row it locks
-- until its write commits, as the log's head is; a write that rolls back
-- returns its number, so a refused post leaves no gap. The lock is taken
-- before `cella.submit` takes the head's, in every write that posts.
CREATE TABLE transaction.journal (
  one boolean PRIMARY KEY DEFAULT true CHECK (one),
  last integer NOT NULL CHECK (last >= 0)
);

INSERT INTO transaction.journal VALUES (true, 0);

-- Numbers every entry. An entry that names its id, as one carried over
-- from before the log does, must name the next number; any other is
-- refused. The counter is this trigger's alone to write.
CREATE FUNCTION transaction.numbers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  n integer;
  next text;
BEGIN
  UPDATE transaction.journal SET last = last + 1 RETURNING last INTO n;
  next := 'je-' || lpad(n::text, 4, '0');
  IF NEW.id IS NOT NULL AND NEW.id <> next THEN
    RAISE EXCEPTION '% is not the journal''s next entry, %', NEW.id, next
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  NEW.id := next;
  RETURN NEW;
END
$$;

CREATE TRIGGER numbers BEFORE INSERT ON transaction.entry
  FOR EACH ROW EXECUTE FUNCTION transaction.numbers();

ALTER TABLE transaction.entry ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE transaction.entry_no;

GRANT SELECT ON transaction.journal TO cella_app, cella_guards;
