-- A correction lowers an entry's time, to none where none was worked,
-- while its month is not approved: the entry stays, as the log keeps what
-- it was logged as and what it was corrected to, and every sum reads what
-- it says now. Only lowering is a correction, which keeps corrections
-- confluent: two of one entry leave the lower, in either order. Time
-- missed is logged as an entry of its own.
ALTER TABLE timesheet.entry
  DROP CONSTRAINT entry_minutes_check,
  ADD CONSTRAINT entry_minutes_check CHECK (minutes >= 0 AND minutes <= 1440);

-- An entry is logged as more than no time; only a correction brings it to
-- none.
CREATE FUNCTION timesheet.some_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.minutes = 0 THEN
    RAISE EXCEPTION 'an entry of no time is not logged' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER some_time BEFORE INSERT ON timesheet.entry
  FOR EACH ROW EXECUTE FUNCTION timesheet.some_time();

-- An entry changes only by lowering its time, and only while its month is
-- not approved: the period is read FOR SHARE, as a log reads it, so a
-- correction and a concurrent approval are serialised.
CREATE FUNCTION timesheet.lowers() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  approved date;
BEGIN
  IF (NEW.id, NEW.member, NEW.day, NEW.billable, NEW.note) IS DISTINCT FROM (OLD.id, OLD.member, OLD.day, OLD.billable, OLD.note)
    OR NEW.minutes > OLD.minutes THEN
    RAISE EXCEPTION 'entry % is corrected only by lowering its time', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT p.approved INTO approved FROM timesheet.period p
  WHERE p.member = OLD.member AND p.month = timesheet.month_of(OLD.day) FOR SHARE;
  IF approved IS NOT NULL THEN
    RAISE EXCEPTION '%''s % was approved on %: its entries stand', OLD.member, timesheet.month_of(OLD.day), approved
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER lowers BEFORE UPDATE ON timesheet.entry
  FOR EACH ROW EXECUTE FUNCTION timesheet.lowers();

-- A month's entries count those with time in them: one corrected to none
-- is in the log, not in the month.
CREATE OR REPLACE VIEW timesheet.sheet AS
SELECT p.member, p.month, p.submitted, p.approved, p.approver,
       (coalesce(sum(e.minutes), 0) / 60.0)::numeric(6, 2) AS hours,
       (coalesce(sum(e.minutes) FILTER (WHERE e.billable), 0) / 60.0)::numeric(6, 2) AS billable,
       (count(e.id) FILTER (WHERE e.minutes > 0))::integer AS entries,
       CASE WHEN p.approved IS NOT NULL THEN 'approved' WHEN p.submitted IS NOT NULL THEN 'submitted' ELSE 'open' END AS state
FROM timesheet.period p
LEFT JOIN timesheet.entry e ON e.member = p.member AND timesheet.month_of(e.day) = p.month
GROUP BY p.member, p.month, p.submitted, p.approved, p.approver;

ALTER VIEW timesheet.sheet SET (security_invoker = true);

-- timesheet:entry:correct — the actor's own entry, which the write
-- brought to the minutes it names, or had fewer already.
CREATE FUNCTION timesheet.corrects(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no entry ' || coalesce(w.entry, 'is named')
    WHEN e.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may not correct ' || e.member || '''s time'
    WHEN w.minutes IS NULL OR e.minutes > w.minutes THEN 'entry ' || e.id || ' was not corrected by this write'
  END
  FROM (SELECT payload ->> 'entry' AS entry, (payload ->> 'minutes')::integer AS minutes) w
  LEFT JOIN timesheet.entry e ON e.id::text = w.entry;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('timesheet:entry:correct', 'timesheet.corrects(jsonb)', 'timesheet');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('timesheet:entry:correct', 'log-time', NULL, 'timesheet');

CREATE POLICY changes ON timesheet.entry FOR UPDATE TO cella_app USING (true);

GRANT UPDATE (minutes) ON timesheet.entry TO cella_app;
