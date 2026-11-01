CREATE SCHEMA expense_file;

-- The receipts attached to an expense, each a file of class
-- expense-receipt about the expense's member, attached once. Both by id,
-- with no foreign key into either feat.
CREATE TABLE expense_file.receipt (
  expense text NOT NULL,
  file text NOT NULL UNIQUE,
  PRIMARY KEY (expense, file)
);

-- expense-file:expense:attach, and a capture that carries its receipt:
-- the receipt is a file the actor uploaded by this write, about
-- themselves and of class expense-receipt, attached to their own expense
-- while it is neither refused nor reimbursed. A capture without one
-- attaches nothing.
CREATE FUNCTION expense_file.attaches(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.file IS NULL AND cella.op() = 'expense:expense:capture' THEN NULL
    WHEN e.id IS NULL THEN 'no expense ' || coalesce(x.expense, 'is named')
    WHEN e.member IS DISTINCT FROM cella.actor()
      THEN coalesce(cella.actor(), 'no one') || ' may not attach a receipt to ' || e.member || '''s expense'
    WHEN e.status IN ('refused', 'reimbursed') THEN e.id || ' is ' || e.status
    WHEN r.file IS NULL THEN coalesce(x.file, 'no file') || ' is not attached to ' || e.id
    ELSE file.stored(x.file, 'expense-receipt', e.member)
  END
  FROM (SELECT payload ->> 'expense' AS expense, payload ->> 'file' AS file) x
  LEFT JOIN expense.expense e ON e.id = x.expense
  LEFT JOIN expense_file.receipt r ON r.expense = x.expense AND r.file = x.file;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('expense-file:expense:attach', 'expense_file.attaches(jsonb)', 'expense-file'),
  ('expense:expense:capture', 'expense_file.attaches(jsonb)', 'expense-file');

GRANT USAGE ON SCHEMA expense_file TO cella_app, cella_guards;
GRANT SELECT ON expense_file.receipt TO cella_app, cella_guards;
GRANT INSERT ON expense_file.receipt TO cella_app;
