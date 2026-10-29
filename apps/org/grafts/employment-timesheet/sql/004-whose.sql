-- Whose time an entry is, as a rule on its log rather than a trigger on
-- the timesheet feat's table: a graft refuses a feat's write by a rule on
-- the op, which the notary runs.
DROP TRIGGER worker ON timesheet.entry;
DROP FUNCTION employment_timesheet.whose();

-- timesheet:entry:log — whose time an entry is, where it is a worker's:
-- theirs on a day of their employment, never before their hire nor after
-- they leave. An entry of no worker's, a member's who is not employed, is
-- membership-timesheet's to judge. A worker's log by their employment is
-- `employment_timesheet.works`'s.
CREATE FUNCTION employment_timesheet.whose(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT p.member || ' is not employed on ' || p.day::text || ': a worker logs time while employed'
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'day')::date AS day) p
  WHERE EXISTS (SELECT FROM employment.worker w WHERE w.address = p.member)
    AND NOT employment.employed(p.member, p.day);
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('timesheet:entry:log', 'employment_timesheet.whose(jsonb)', 'employment-timesheet');
