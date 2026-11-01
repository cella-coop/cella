-- Whose an expense is, as a guard on its capture rather than a trigger on
-- the expense feat's table: a graft refuses a feat's write by a guard on
-- the op, which the notary runs.
DROP TRIGGER whose ON expense.expense;
DROP FUNCTION expense_membership.whose();

-- expense:expense:capture — the expense is an active member's. The
-- expense feat holds the member's address on each expense, as a timesheet
-- entry does; this graft checks it against the members. Whether the
-- actor may claim at all is `expense.captures`'s.
CREATE FUNCTION expense_membership.whose(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT membership.active(p.member, cella.verdict_date())
      THEN coalesce(p.member, 'no one') || ' is no active member: an expense is claimed by one'
  END
  FROM (SELECT payload ->> 'member' AS member) p;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('expense:expense:capture', 'expense_membership.whose(jsonb)', 'expense-membership');
