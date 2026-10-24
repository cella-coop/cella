CREATE SCHEMA expense_member;

-- Whose an expense is: an active member's. The expense feat holds the
-- member's address on each expense, as a timesheet entry does; this graft
-- checks it against the members. Whether the actor may claim at all is
-- `expense.captures`'s.
CREATE FUNCTION expense_member.whose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM member.member m WHERE m.address = NEW.member AND m.status = 'active') THEN
    RAISE EXCEPTION '% is no active member: an expense is claimed by one', NEW.member
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER whose BEFORE INSERT ON expense.expense
  FOR EACH ROW EXECUTE FUNCTION expense_member.whose();

-- Each expense with its member's name and its decider's.
CREATE VIEW expense_member.claim AS
SELECT e.id AS expense, e.member, m.name, e.decider, d.name AS decider_name
FROM expense.expense e
JOIN member.member m ON m.address = e.member
LEFT JOIN member.member d ON d.address = e.decider;

GRANT USAGE ON SCHEMA expense_member TO cella_app, cella_rules;
GRANT SELECT ON expense_member.claim TO cella_app, cella_rules;
