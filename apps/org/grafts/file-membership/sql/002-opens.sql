-- The powers that open other people's personal files of a class, beyond
-- the person a file concerns and who uploaded it: whoever approves or
-- reimburses expenses opens receipts; whoever approves or pays the pay
-- runs, or hires, opens employment records; whoever invites members opens
-- members' records.
CREATE TABLE file_membership.opener (
  class text NOT NULL,
  power text NOT NULL,
  PRIMARY KEY (class, power)
);

INSERT INTO file_membership.opener (class, power) VALUES
  ('expense-receipt', 'approve-expense'),
  ('expense-receipt', 'reimburse-expense'),
  ('payroll', 'approve-payroll'),
  ('payroll', 'pay-payroll'),
  ('payroll', 'hire-worker'),
  ('profile', 'invite-member');

-- Whether a member's seats, on the verdict date, give them a power that
-- opens the file's class.
CREATE FUNCTION file_membership.opens(id text, actor text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(bool_or(membership.may(opens.actor, o.power, NULL, cella.verdict_date())), false)
  FROM file.file f
  JOIN file_membership.opener o ON o.class = f.class
  WHERE f.id = opens.id;
END;

GRANT USAGE ON SCHEMA file_membership TO cella_app, cella_guards;
GRANT SELECT ON file_membership.opener TO cella_app, cella_guards;
