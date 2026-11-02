CREATE SCHEMA expense_membership;

-- Whose an expense is: a person's, by the address the expense feat holds
-- on each expense, as a timesheet entry does. Who may claim is every
-- employee's right, `claim-expense`, and that the claim is the actor's
-- own `expense.captures`'s, so this graft refuses none: it names them.

-- Each expense with its claimant's name and its decider's.
CREATE VIEW expense_membership.claim AS
SELECT e.id AS expense, e.member, mp.name, e.decider, dp.name AS decider_name
FROM expense.expense e
JOIN person.person mp ON mp.address = e.member
LEFT JOIN person.person dp ON dp.address = e.decider;

GRANT USAGE ON SCHEMA expense_membership TO cella_app, cella_guards;
GRANT SELECT ON expense_membership.claim TO cella_app, cella_guards;
