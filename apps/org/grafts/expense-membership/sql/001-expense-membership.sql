CREATE SCHEMA expense_membership;

-- Whose an expense is: an active member's. The expense feat holds the
-- member's address on each expense, as a timesheet entry does; this graft
-- checks it against the members. Whether the actor may claim at all is
-- `expense.captures`'s.
CREATE FUNCTION expense_membership.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM membership.member m WHERE m.address = NEW.member AND m.status = 'active') THEN
    RAISE EXCEPTION '% is no active member: an expense is claimed by one', NEW.member
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER whose BEFORE INSERT ON expense.expense
  FOR EACH ROW EXECUTE FUNCTION expense_membership.whose();

-- Each expense with its member's name and its decider's.
CREATE VIEW expense_membership.claim AS
SELECT e.id AS expense, e.member, mp.name, e.decider, dp.name AS decider_name
FROM expense.expense e
JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = e.member
LEFT JOIN (membership.member d JOIN person.person dp ON dp.address = d.address) ON d.address = e.decider;

GRANT USAGE ON SCHEMA expense_membership TO cella_app, cella_guards;
GRANT SELECT ON expense_membership.claim TO cella_app, cella_guards;
