-- An entry's minutes are personal data of its member, of class `payroll`:
-- a log and a correction commit to them in the log, and the vault keeps
-- them, so the log's digest confirms no guess at a colleague's time.
-- Erasing a member who has left restricts them; once their clock runs out
-- the sweep redacts them to NULL, so the minutes are nullable, and an
-- approved month's entries take that one change.
ALTER TABLE timesheet.entry ALTER COLUMN minutes DROP NOT NULL;

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('timesheet', 'entry', 'minutes', 'payroll', 'member', 'timesheet');

-- As before, and an entry is logged with its time: only the redaction
-- leaves none.
CREATE OR REPLACE FUNCTION timesheet.some_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.minutes IS NULL OR NEW.minutes = 0 THEN
    RAISE EXCEPTION 'an entry of no time is not logged' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

-- As before, but for the notary's redaction (`cella.redacting()`), the one
-- change an approved month's entries take.
CREATE OR REPLACE FUNCTION timesheet.lowers() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  approved date;
BEGIN
  IF cella.redacting() THEN
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.circle, NEW.member, NEW.day, NEW.billable, NEW.note) IS DISTINCT FROM (OLD.id, OLD.circle, OLD.member, OLD.day, OLD.billable, OLD.note)
    OR NEW.minutes IS NULL OR NEW.minutes > OLD.minutes THEN
    RAISE EXCEPTION 'entry % is corrected only by lowering its time', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT p.approved INTO approved FROM timesheet.period p
  WHERE p.member = OLD.member AND p.month = timesheet.month_of(OLD.day) AND p.circle = OLD.circle FOR SHARE;
  IF approved IS NOT NULL THEN
    RAISE EXCEPTION '%''s % in % was approved on %: its entries stand', OLD.member, timesheet.month_of(OLD.day), OLD.circle, approved
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

-- timesheet:entry:correct — the actor's own entry. The payload commits to
-- the minutes it was brought to, so the guard reads the entry alone; that
-- a correction only lowers is `timesheet.lowers`'.
CREATE OR REPLACE FUNCTION timesheet.corrects(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no entry ' || coalesce(w.entry, 'is named')
    WHEN e.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may not correct ' || e.member || '''s time'
  END
  FROM (SELECT payload ->> 'entry' AS entry) w
  LEFT JOIN timesheet.entry e ON e.id::text = w.entry;
END;
