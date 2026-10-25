-- Why a run's event is not in the books as it should be, or NULL, as
-- before; but a write posts one entry, so what a graft above posts in the
-- same write, such as an instalment of capital withheld from a member's
-- pay, is lines of that entry: they balance among themselves and credit
-- no account the event's own lines post to, nor the bank, and the graft
-- that adds them checks they are exactly its own.
CREATE OR REPLACE FUNCTION payslip_transaction.unposted(ref text, event text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN r.month IS NULL THEN 'no run for ' || coalesce(ref, 'the month')
    WHEN p.entry IS NULL THEN ref || '''s run posted no ' || unposted.event
    WHEN e.date IS DISTINCT FROM CASE unposted.event WHEN 'accrual' THEN payslip.after(ref) - 1 ELSE r.paid END
      THEN p.entry || ' is not dated on ' || ref || '''s ' || unposted.event
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM payslip_transaction.lines(ref, unposted.event) l)
      EXCEPT ALL
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
    ) THEN p.entry || ' does not post ' || ref || '''s ' || unposted.event
    WHEN EXISTS (
      SELECT FROM (
        (SELECT t.account, t.side, cella.cents(t.amount) AS cents FROM transaction.line t WHERE t.entry = p.entry)
        EXCEPT ALL
        (SELECT l.account, l.side, l.cents FROM payslip_transaction.lines(ref, unposted.event) l)
      ) x
      WHERE x.side = 'credit' AND (x.account = '512' OR x.account IN (SELECT l.account FROM payslip_transaction.lines(ref, unposted.event) l))
    ) OR (
      SELECT coalesce(sum(CASE x.side WHEN 'debit' THEN x.cents ELSE -x.cents END), 0) FROM (
        (SELECT t.account, t.side, cella.cents(t.amount) AS cents FROM transaction.line t WHERE t.entry = p.entry)
        EXCEPT ALL
        (SELECT l.account, l.side, l.cents FROM payslip_transaction.lines(ref, unposted.event) l)
      ) x
    ) <> 0 THEN p.entry || ' posts more than ' || ref || '''s ' || unposted.event || ', and not in balance away from its own accounts and the bank'
  END
  FROM (SELECT 1) one
  LEFT JOIN payslip.run r ON r.month = ref
  LEFT JOIN payslip_transaction.posting p ON p.month = ref AND p.event = unposted.event
  LEFT JOIN transaction.entry e ON e.id = p.entry;
END;
