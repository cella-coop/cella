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

-- What the grafts above add to a run's payment, as they register it: for
-- each, a function of the run's month answering the lines its entry also
-- carries, `(text) → TABLE (account text, side text, cents bigint,
-- person text)`, `person` naming whose own figure a line is, where it is
-- a person's, and one of the month and the posted entry, `(text, text) →
-- TABLE (field text, subject text, cents bigint)`, by which the graft
-- records in its own schema what it keeps of them and answers each
-- personal figure it kept, by its personal column and its subject, which
-- the payment's payload commits to. This graft knows none of them by
-- name, and no graft above puts a trigger on `posting`.
CREATE TABLE payslip_transaction.payment_lines (
  lines regprocedure PRIMARY KEY,
  keeps regprocedure NOT NULL,
  owner text NOT NULL
);

-- Registers what a graft adds to a run's payment. A graft's migration
-- calls it, and never inserts the row itself.
CREATE FUNCTION payslip_transaction.register_payment_lines(lines regprocedure, keeps regprocedure, owner text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO payslip_transaction.payment_lines (lines, keeps, owner)
  VALUES (register_payment_lines.lines, register_payment_lines.keeps, register_payment_lines.owner);
END;

REVOKE EXECUTE ON FUNCTION payslip_transaction.register_payment_lines(regprocedure, regprocedure, text) FROM PUBLIC;

-- The lines a run's payment carries beside its own: each registered
-- function's, in the order of their owners and names, so the order is the
-- same in every scope. Each is called by the schema and name its function
-- has, the month cast to the type it was registered with, so a function
-- overloaded under its name runs the overload registered; `keep` calls
-- the functions that keep the same way.
CREATE FUNCTION payslip_transaction.added(month text)
RETURNS TABLE (account text, side text, cents bigint, person text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  call text;
BEGIN
  FOR call IN
    SELECT format('SELECT x.account, x.side, x.cents, x.person FROM %I.%I($1::%s) x', n.nspname, f.proname, f.proargtypes[0]::regtype)
    FROM payslip_transaction.payment_lines p
    JOIN pg_catalog.pg_proc f ON f.oid = p.lines
    JOIN pg_catalog.pg_namespace n ON n.oid = f.pronamespace
    ORDER BY p.owner, p.lines::text
  LOOP
    RETURN QUERY EXECUTE call USING month;
  END LOOP;
END
$$;

-- Once a run's payment is posted, in the write that pays it, each
-- registrant records what it keeps of the lines it added, and the
-- personal figures it kept, which the payment's payload commits to.
CREATE FUNCTION payslip_transaction.keep(month text, entry text)
RETURNS TABLE (field text, subject text, cents bigint)
LANGUAGE plpgsql AS $$
DECLARE
  call text;
BEGIN
  FOR call IN
    SELECT format('SELECT x.field, x.subject, x.cents FROM %I.%I($1::%s, $2::%s) x', n.nspname, f.proname, f.proargtypes[0]::regtype, f.proargtypes[1]::regtype)
    FROM payslip_transaction.payment_lines p
    JOIN pg_catalog.pg_proc f ON f.oid = p.keeps
    JOIN pg_catalog.pg_namespace n ON n.oid = f.pronamespace
    ORDER BY p.owner, p.lines::text
  LOOP
    RETURN QUERY EXECUTE call USING month, entry;
  END LOOP;
END
$$;

GRANT SELECT ON payslip_transaction.payment_lines TO cella_app, cella_guards;

COMMENT ON TABLE payslip_transaction.payment_lines IS 'registry: what the grafts above add to a run''s payment, as they register it';
