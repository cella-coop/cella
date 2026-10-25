CREATE SCHEMA timesheet_worker;

-- Whose time an entry is, where it is a worker's: theirs on a day of their
-- employment, never before their hire nor after they leave. An entry of
-- no worker's, a member's who is not employed, is member-timesheet's to
-- judge.
CREATE FUNCTION timesheet_worker.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM worker.worker w WHERE w.address = NEW.member) AND NOT worker.employed(NEW.member, NEW.day) THEN
    RAISE EXCEPTION '% is not employed on %: a worker logs time while employed', NEW.member, NEW.day
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER worker BEFORE INSERT ON timesheet.entry
  FOR EACH ROW EXECUTE FUNCTION timesheet_worker.whose();

-- timesheet-worker:entry:log and :period:submit — a worker logs and
-- submits their own time by their employment, member or not, where the
-- timesheet feat's writes need the log-time mandate a seat gives: the
-- actor is a worker employed on the entry's day, or in the month. That it
-- is their own time, on a day that has come, or their own month with time
-- in it, is the timesheet feat's rules, run on these ops too.
CREATE FUNCTION timesheet_worker.works(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (SELECT FROM worker.worker w WHERE w.address = cella.actor())
      THEN coalesce(cella.actor(), 'no one') || ' is no worker: a worker logs their time by their employment'
    WHEN p.day IS NOT NULL AND NOT worker.employed(cella.actor(), p.day)
      THEN cella.actor() || ' is not employed on ' || p.day::text
    WHEN p.month IS NOT NULL AND NOT worker.employed_in(cella.actor(), p.month)
      THEN cella.actor() || ' is employed in no day of ' || p.month
  END
  FROM (SELECT (payload ->> 'day')::date AS day, payload ->> 'month' AS month) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('timesheet-worker:entry:log', 'timesheet.logs(jsonb)', 'timesheet-worker'),
  ('timesheet-worker:entry:log', 'timesheet_worker.works(jsonb)', 'timesheet-worker'),
  ('timesheet-worker:period:submit', 'timesheet.submits(jsonb)', 'timesheet-worker'),
  ('timesheet-worker:period:submit', 'timesheet_worker.works(jsonb)', 'timesheet-worker');

-- Each worker's months, by name: their hours and where each stands, and
-- who approved it.
CREATE VIEW timesheet_worker.sheet AS
SELECT s.member, w.name, s.month, s.hours, s.billable, s.entries, s.state, s.submitted, s.approved,
       s.approver, a.name AS approver_name
FROM timesheet.sheet s
JOIN worker.worker w ON w.address = s.member
LEFT JOIN worker.worker a ON a.address = s.approver;

GRANT USAGE ON SCHEMA timesheet_worker TO cella_app, cella_rules;
GRANT SELECT ON timesheet_worker.sheet TO cella_app, cella_rules;
