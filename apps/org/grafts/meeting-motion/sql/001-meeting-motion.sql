CREATE SCHEMA meeting_motion;

-- An agenda item that tables a motion: the item by its id and its
-- meeting's, the motion by its, with no foreign key into either feat.
-- An item tables one motion at most; a motion may be tabled at
-- several meetings, as one is discussed in coordination before its
-- assembly votes.
CREATE TABLE meeting_motion.tabled (
  item bigint PRIMARY KEY,
  meeting text NOT NULL,
  motion text NOT NULL
);

CREATE INDEX ON meeting_motion.tabled (meeting);
CREATE INDEX ON meeting_motion.tabled (motion);

-- Both sides resolve: the item is on its meeting's agenda, and the
-- motion exists.
CREATE FUNCTION meeting_motion.resolves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM meeting.item i WHERE i.id = NEW.item AND i.meeting = NEW.meeting) THEN
    RAISE EXCEPTION '% has no item %', NEW.meeting, NEW.item USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT EXISTS (SELECT FROM motion.motion d WHERE d.id = NEW.motion) THEN
    RAISE EXCEPTION 'no motion %', NEW.motion USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER resolves BEFORE INSERT OR UPDATE ON meeting_motion.tabled
  FOR EACH ROW EXECUTE FUNCTION meeting_motion.resolves();

GRANT USAGE ON SCHEMA meeting_motion TO cella_app, cella_guards;
GRANT SELECT, INSERT ON meeting_motion.tabled TO cella_app;
GRANT SELECT ON meeting_motion.tabled TO cella_guards;
