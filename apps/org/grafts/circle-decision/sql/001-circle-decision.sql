CREATE SCHEMA circle_decision;

-- Who may vote on a decision: the members seated in its circle on the day
-- it was proposed, fixed when it is proposed. Both sides are referenced by
-- id and address, with no foreign key into either feat.
CREATE TABLE circle_decision.roll (
  decision text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (decision, member)
);

-- Seats are the circle-member graft's: the roll reads them through
-- `circle_member.seated` when the decision is proposed. It is the trigger's
-- alone to write, so it runs with its owner's rights.
CREATE FUNCTION circle_decision.fix_roll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO circle_decision.roll (decision, member)
  SELECT NEW.id, s FROM circle_member.seated(NEW.circle, NEW.proposed) s;
  RETURN NULL;
END
$$;

CREATE TRIGGER fix_roll AFTER INSERT ON decision.decision
  FOR EACH ROW EXECUTE FUNCTION circle_decision.fix_roll();

GRANT USAGE ON SCHEMA circle_decision TO cella_app, cella_rules;
GRANT SELECT ON circle_decision.roll TO cella_app, cella_rules;
