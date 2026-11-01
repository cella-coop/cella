CREATE SCHEMA circle_expense_membership;

-- What a member approved of expenses in the month, or the year, of a day,
-- in cents.
CREATE FUNCTION circle_expense_membership.approved(member text, day date, per text) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(sum(expense.total(e)), 0)
  FROM expense.expense e
  WHERE e.decider = approved.member
    AND e.status IN ('approved', 'reimbursed')
    AND date_trunc(approved.per, e.decided) = date_trunc(approved.per, approved.day);
END;

-- expense:expense:approve — a mandate's budget is a total over its period,
-- which the approvals of whoever holds it spend: the actor holds
-- approve-expense on the verdict date through a mandate with no budget, or
-- through one whose budget their approvals over its month or year, this
-- one included, stay within. Whether they hold the power at all, and
-- within its limit for this one expense, is circle-membership's guard; this one
-- reads the same seats and mandates, and the expenses they decided.
CREATE FUNCTION circle_expense_membership.within(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  WITH held AS (
    SELECT cella.cents(m.budget) AS budget, m.per,
           circle_expense_membership.approved(cella.actor(), cella.verdict_date(), coalesce(m.per, 'month')) AS spent
    FROM circle_membership.seat p
    JOIN circle.mandate m ON m.role = p.role
    WHERE p.member = cella.actor()
      AND m.power = 'approve-expense'
      AND (p.since IS NULL OR p.since <= cella.verdict_date())
      AND (p.until IS NULL OR p.until > cella.verdict_date())
      AND (m."from" IS NULL OR m."from" <= cella.verdict_date())
      AND (m.until IS NULL OR m.until > cella.verdict_date())
      AND m.revoked IS NULL
  )
  SELECT CASE
    WHEN EXISTS (SELECT FROM held h WHERE h.budget IS NOT NULL)
      AND NOT EXISTS (SELECT FROM held h WHERE h.budget IS NULL OR h.spent <= h.budget)
      THEN cella.actor() || '''s approvals this ' || (SELECT min(h.per) FROM held h WHERE h.budget IS NOT NULL)
        || ' come to ' || (SELECT min(h.spent) FROM held h WHERE h.budget IS NOT NULL)
        || ' cents, beyond their approve-expense budget of ' || (SELECT max(h.budget) FROM held h) || ' cents'
  END;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('expense:expense:approve', 'circle_expense_membership.within(jsonb)', 'circle-expense-membership');

GRANT USAGE ON SCHEMA circle_expense_membership TO cella_app, cella_guards;
