-- Whose time an entry is, as a rule on its log rather than a trigger on
-- the timesheet feat's table: a graft refuses a feat's write by a rule on
-- the op, which the notary runs.
DROP TRIGGER whose ON timesheet.entry;
DROP FUNCTION membership_timesheet.whose();

-- timesheet:entry:log — whose time an entry is, as the members see it: no
-- member's who is suspended or has left. A worker logs their own while
-- employed, member or not, by employment-timesheet's own ops, which this
-- graft does not judge; Inès, invited and employed, logs hers before the
-- assembly admits her. Whether the actor may log at all is the log-time
-- power's.
CREATE FUNCTION membership_timesheet.whose(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT p.member || ' is a member suspended or gone: they log no time'
  FROM (SELECT payload ->> 'member' AS member) p
  JOIN membership.member m ON m.address = p.member
  WHERE m.status IN ('suspended', 'exited');
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('timesheet:entry:log', 'membership_timesheet.whose(jsonb)', 'membership-timesheet');
