CREATE SCHEMA member;

CREATE TABLE member.member (
  address text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'exited')),
  since date,
  shares integer NOT NULL DEFAULT 0 CHECK (shares >= 0)
);

-- A membership moves only along its lifecycle; anything else is refused
-- whatever wrote it.
CREATE FUNCTION member.moves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> OLD.status AND (OLD.status, NEW.status) NOT IN (
    ('invited', 'active'), ('active', 'suspended'), ('suspended', 'active'),
    ('active', 'exited'), ('suspended', 'exited')
  ) THEN
    RAISE EXCEPTION '% is %, and cannot become %', OLD.address, OLD.status, NEW.status
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER moves BEFORE UPDATE OF status ON member.member
  FOR EACH ROW EXECUTE FUNCTION member.moves();

-- member:member:admit — the write left the member active, since the
-- verdict date, holding shares.
CREATE FUNCTION member.admitted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || p.address
    WHEN m.status <> 'active' THEN m.address || ' is ' || m.status
    WHEN m.since IS DISTINCT FROM cella.verdict_date() THEN m.address || ' was not admitted by this write'
    WHEN m.shares = 0 THEN m.address || ' holds no shares'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN member.member m ON m.address = p.address;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('member:member:admit', 'member.admitted(jsonb)', 'member');

GRANT USAGE ON SCHEMA member TO cella_app;
GRANT SELECT, INSERT, UPDATE ON member.member TO cella_app;
