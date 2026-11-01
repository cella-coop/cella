CREATE SCHEMA decision_meeting;

-- An agenda item that tables a decision: the item by its id and its
-- meeting's, the decision by its, with no foreign key into either feat.
-- An item tables one decision at most; a decision may be tabled at
-- several meetings, as one is discussed in coordination before its
-- assembly votes.
CREATE TABLE decision_meeting.tabled (
  item bigint PRIMARY KEY,
  meeting text NOT NULL,
  decision text NOT NULL
);

CREATE INDEX ON decision_meeting.tabled (meeting);
CREATE INDEX ON decision_meeting.tabled (decision);

-- Both sides resolve: the item is on its meeting's agenda, and the
-- decision exists.
CREATE FUNCTION decision_meeting.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM meeting.item i WHERE i.id = NEW.item AND i.meeting = NEW.meeting) THEN
    RAISE EXCEPTION '% has no item %', NEW.meeting, NEW.item USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM decision.decision d WHERE d.id = NEW.decision) THEN
    RAISE EXCEPTION 'no decision %', NEW.decision USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON decision_meeting.tabled
  FOR EACH ROW EXECUTE FUNCTION decision_meeting.resolves();

GRANT USAGE ON SCHEMA decision_meeting TO cella_app, cella_guards;
GRANT SELECT, INSERT ON decision_meeting.tabled TO cella_app;
GRANT SELECT ON decision_meeting.tabled TO cella_guards;
