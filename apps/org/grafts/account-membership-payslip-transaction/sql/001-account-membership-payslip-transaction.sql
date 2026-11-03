CREATE SCHEMA account_membership_payslip_transaction;

-- An associate's subscription paid in monthly instalments withheld from
-- their pay: how many they spread what they owe over, the cents of each,
-- the last being what is left, the day they chose it, and how many their
-- pay had withheld before it. Their own register: spreading again
-- replaces it for the instalments to come.
CREATE TABLE account_membership_payslip_transaction.plan (
  member text PRIMARY KEY,
  instalments integer NOT NULL CHECK (instalments > 0),
  each cella.amount NOT NULL,
  since date NOT NULL,
  prior integer NOT NULL CHECK (prior >= 0)
);

-- What a month's pay run withheld from an associate's pay for their
-- subscription, and the entry, the run's payment, that posted it.
CREATE TABLE account_membership_payslip_transaction.withheld (
  month text NOT NULL,
  member text NOT NULL,
  amount cella.amount NOT NULL,
  entry text NOT NULL,
  PRIMARY KEY (month, member)
);

-- What a month's run withholds from each associate on a plan who has a
-- payslip in it, while the plan has instalments left: an instalment, and
-- on the plan's last all they still owe, never more than they still owe,
-- nor than their net pay. A month that withheld anything counts as one
-- instalment, whatever its amount, so a net pay below the instalment
-- never stretches the plan past its count. What this month withheld
-- already counts as still owed and as left, so the guard reads the same
-- after the payment as the trigger before it.
CREATE FUNCTION account_membership_payslip_transaction.due(month text)
RETURNS TABLE (member text, account text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT p.member, c.account,
         least(CASE WHEN p.instalments - k.n = 1 THEN o.owed ELSE cella.cents(p.each) END, o.owed, cella.cents(s.net))
  FROM account_membership_payslip_transaction.plan p
  JOIN account_membership_transaction.called c ON c.member = p.member
  JOIN payslip.payslip s ON s.member = p.member AND s.month = due.month
  LEFT JOIN account_membership_payslip_transaction.withheld w ON w.member = p.member AND w.month = due.month
  CROSS JOIN LATERAL (SELECT c.unpaid + coalesce(cella.cents(w.amount), 0) AS owed) o
  CROSS JOIN LATERAL (
    SELECT count(*) - p.prior AS n FROM account_membership_payslip_transaction.withheld v
    WHERE v.member = p.member AND v.month <> due.month
  ) k
  WHERE o.owed > 0 AND s.net IS NOT NULL AND k.n < p.instalments
  ORDER BY c.account;
END;

-- When a run is paid, in that write, each instalment due is withheld from
-- the pay: posted as lines of the payment's own entry, since a write
-- posts one, as a payment in through the bank, 512 debited and 4562
-- credited, which nets what the bank pays the associate, and 1012
-- debited and their capital account credited; and recorded as paid in
-- through their pay.
CREATE FUNCTION account_membership_payslip_transaction.withholds() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  last integer;
BEGIN
  IF NEW.event <> 'payment' THEN
    RETURN NULL;
  END IF;
  INSERT INTO account_membership_payslip_transaction.withheld (month, member, amount, entry)
  SELECT NEW.month, d.member, cella.amount(d.cents), NEW.entry
  FROM account_membership_payslip_transaction.due(NEW.month) d WHERE d.cents > 0;
  SELECT max(l.n) INTO last FROM transaction.line l WHERE l.entry = NEW.entry;
  INSERT INTO transaction.line (entry, n, account, side, amount)
  SELECT NEW.entry, last + row_number() OVER (ORDER BY c.account, x.n), x.account, x.side, cella.amount(x.cents)
  FROM account_membership_payslip_transaction.withheld w
  JOIN account_membership_transaction.called c ON c.member = w.member
  CROSS JOIN LATERAL (
    SELECT p.account, p.side, p.cents, row_number() OVER () AS n
    FROM account_membership_transaction.paying(c.account, cella.cents(w.amount)) p
  ) x
  WHERE w.month = NEW.month;
  INSERT INTO account_membership_transaction.paid (entry, member, amount, via)
  SELECT NEW.entry, w.member, w.amount, 'pay'
  FROM account_membership_payslip_transaction.withheld w WHERE w.month = NEW.month;
  RETURN NULL;
END
$$;

CREATE TRIGGER withholds AFTER INSERT ON payslip_transaction.posting
  FOR EACH ROW EXECUTE FUNCTION account_membership_payslip_transaction.withholds();

-- payslip:run:pay — the payment withheld exactly each instalment due, and
-- its entry posts exactly those beyond the run's own lines.
CREATE FUNCTION account_membership_payslip_transaction.deducted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN EXISTS (
      (SELECT d.member, d.cents FROM account_membership_payslip_transaction.due(x.month) d WHERE d.cents > 0)
      EXCEPT
      (SELECT w.member, cella.cents(w.amount) FROM account_membership_payslip_transaction.withheld w WHERE w.month = x.month)
    ) OR EXISTS (
      (SELECT w.member, cella.cents(w.amount) FROM account_membership_payslip_transaction.withheld w WHERE w.month = x.month)
      EXCEPT
      (SELECT d.member, d.cents FROM account_membership_payslip_transaction.due(x.month) d WHERE d.cents > 0)
    ) THEN coalesce(x.month, 'the month') || '''s pay does not withhold the instalments its associates owe'
    WHEN EXISTS (
      SELECT FROM account_membership_payslip_transaction.withheld w
      WHERE w.month = x.month AND (w.entry IS DISTINCT FROM p.entry OR NOT EXISTS (
        SELECT FROM account_membership_transaction.paid d WHERE d.entry = w.entry AND d.member = w.member AND d.via = 'pay' AND cella.cents(d.amount) = cella.cents(w.amount)
      ))
    ) OR EXISTS (
      (SELECT y.account, y.side, y.cents
       FROM account_membership_payslip_transaction.withheld w
       JOIN account_membership_transaction.called c ON c.member = w.member
       CROSS JOIN LATERAL account_membership_transaction.paying(c.account, cella.cents(w.amount)) y
       WHERE w.month = x.month)
      EXCEPT ALL
      (
        (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = p.entry)
        EXCEPT ALL
        (SELECT o.account, o.side, o.cents FROM payslip_transaction.lines(x.month, 'payment') o)
      )
    ) OR EXISTS (
      (
        (SELECT l.account, l.side, cella.cents(l.amount) FROM transaction.line l WHERE l.entry = p.entry)
        EXCEPT ALL
        (SELECT o.account, o.side, o.cents FROM payslip_transaction.lines(x.month, 'payment') o)
      )
      EXCEPT ALL
      (SELECT y.account, y.side, y.cents
       FROM account_membership_payslip_transaction.withheld w
       JOIN account_membership_transaction.called c ON c.member = w.member
       CROSS JOIN LATERAL account_membership_transaction.paying(c.account, cella.cents(w.amount)) y
       WHERE w.month = x.month)
    ) THEN coalesce(p.entry, 'the payment') || ' does not post what ' || x.month || '''s pay withheld: for each, 512 debited and 4562 credited, 1012 debited and the capital account credited'
  END
  FROM (SELECT payload ->> 'month' AS month) x
  LEFT JOIN payslip_transaction.posting p ON p.month = x.month AND p.event = 'payment';
END;

-- account:capital:spread — an associate spreads what they owe on their
-- subscription over monthly instalments from their pay: their own, no
-- more instalments than the statutes allow less those their pay has
-- withheld already, under this plan or an earlier one, a refusal quoting
-- the rule they copy (`policy.says`), each what is owed divided by them,
-- rounded up to the cent, and set by this write, which counts those
-- withheld before it.
CREATE FUNCTION account_membership_payslip_transaction.spreads(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN c.member IS NULL OR c.unpaid <= 0 THEN coalesce(x.member, 'no one') || ' owes nothing on a subscription'
    WHEN t.instalments IS NULL OR x.instalments > t.instalments - k.n
      THEN x.member || ' spreads their subscription over ' || x.instalments || ' instalments'
        || CASE WHEN k.n > 0 THEN ', ' || k.n || ' already withheld from their pay' ELSE '' END || ': '
        || coalesce('"' || policy.says(t.policy) || '"', t.id || ' allow at most ' || t.instalments, 'no adopted terms allow any')
    WHEN p.member IS NULL OR p.since IS DISTINCT FROM cella.verdict_date() OR p.instalments <> x.instalments
      OR cella.cents(p.each) <> (c.unpaid + x.instalments - 1) / x.instalments OR p.prior <> k.n
      THEN x.member || '''s plan was not set by this write: ' || x.instalments || ' instalments of what they owe, rounded up to the cent'
    WHEN x.member IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may spread only their own subscription, not ' || coalesce(x.member, 'no one') || '''s'
  END
  FROM (SELECT payload ->> 'member' AS member, (payload ->> 'instalments')::integer AS instalments) x
  LEFT JOIN account_membership_transaction.called c ON c.member = x.member
  LEFT JOIN account.terms t ON t.id = account.capital_for(cella.verdict_date())
  LEFT JOIN account_membership_payslip_transaction.plan p ON p.member = x.member
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS n FROM account_membership_payslip_transaction.withheld v WHERE v.member = x.member
  ) k;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('payslip:run:pay', 'account_membership_payslip_transaction.deducted(jsonb)', 'account-membership-payslip-transaction'),
  ('account:capital:spread', 'account_membership_payslip_transaction.spreads(jsonb)', 'account-membership-payslip-transaction');

GRANT USAGE ON SCHEMA account_membership_payslip_transaction TO cella_app, cella_guards;
GRANT SELECT ON account_membership_payslip_transaction.plan, account_membership_payslip_transaction.withheld TO cella_app, cella_guards;
GRANT INSERT ON account_membership_payslip_transaction.plan, account_membership_payslip_transaction.withheld TO cella_app;
GRANT UPDATE (instalments, each, since, prior) ON account_membership_payslip_transaction.plan TO cella_app;
