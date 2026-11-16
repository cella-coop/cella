-- Who runs a project day to day, Linear's lead and members, independent
-- of who wrote its log: at most one lead, as many members as join it,
-- both active members as membership-task's assignee is one. The last
-- crew written replaces the whole of it.
CREATE TABLE membership_project.lead (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  project text PRIMARY KEY,
  member text NOT NULL
);

CREATE TABLE membership_project.member (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  project text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (project, member)
);

CREATE INDEX ON membership_project.member (member);

-- Both sides resolve: the project exists, and the member is active, as
-- membership-task's assignee is.
CREATE FUNCTION membership_project.crewed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM project.project p WHERE p.id = NEW.project) THEN
    RAISE EXCEPTION 'no project %', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF NOT membership.active(NEW.member, cella.verdict_date()) THEN
    RAISE EXCEPTION '% is no active member: a project''s crew is of them', NEW.member USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER crewed BEFORE INSERT OR UPDATE ON membership_project.lead
  FOR EACH ROW EXECUTE FUNCTION membership_project.crewed();

CREATE TRIGGER crewed BEFORE INSERT OR UPDATE ON membership_project.member
  FOR EACH ROW EXECUTE FUNCTION membership_project.crewed();

GRANT SELECT, INSERT, UPDATE, DELETE ON membership_project.lead, membership_project.member TO cella_app;
GRANT SELECT ON membership_project.lead, membership_project.member TO cella_guards;
