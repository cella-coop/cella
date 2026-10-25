CREATE SCHEMA membership;

-- A person's membership, by their address: invited, then a member,
-- suspended or exited, and the shares they hold. Who they are is the
-- person's, the core this feat nests in.
CREATE TABLE membership.member (
  address text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'exited')),
  since date,
  shares integer NOT NULL DEFAULT 0 CHECK (shares >= 0)
);

-- A membership moves only along its lifecycle; anything else is refused
-- whatever wrote it.
CREATE FUNCTION membership.moves() RETURNS trigger LANGUAGE plpgsql AS $$
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

CREATE TRIGGER moves BEFORE UPDATE OF status ON membership.member
  FOR EACH ROW EXECUTE FUNCTION membership.moves();

-- membership:member:admit — the write left the member active, since the
-- verdict date, holding shares.
CREATE FUNCTION membership.admitted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || p.address
    WHEN m.status <> 'active' THEN m.address || ' is ' || m.status
    WHEN m.since IS DISTINCT FROM cella.verdict_date() THEN m.address || ' was not admitted by this write'
    WHEN m.shares = 0 THEN m.address || ' holds no shares'
  END
  FROM (SELECT payload ->> 'member' AS address) p
  LEFT JOIN membership.member m ON m.address = p.address;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('membership:member:admit', 'membership.admitted(jsonb)', 'membership');

GRANT USAGE ON SCHEMA membership TO cella_app;
GRANT SELECT, INSERT, UPDATE ON membership.member TO cella_app;
