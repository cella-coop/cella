CREATE SCHEMA invoice_transaction;

-- Which entry each invoice event posted: its issue, each payment, its void.
-- Both sides are referenced by id, with no foreign key into either feat.
CREATE TABLE invoice_transaction.posting (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  entry text PRIMARY KEY,
  invoice text NOT NULL,
  event text NOT NULL CHECK (event IN ('issue', 'payment', 'void')),
  -- The invoice feat's payment, for a payment's posting.
  payment bigint UNIQUE,
  CHECK ((event = 'payment') = (payment IS NOT NULL))
);

CREATE UNIQUE INDEX ON invoice_transaction.posting (invoice, event) WHERE event <> 'payment';

-- The lines an invoice's issue or void posts, for a French SCOP's chart:
-- an issue debits clients (411) by the total and credits services (706) by
-- the net and VAT collected (44571) by the VAT; a void's credit note
-- reverses it.
CREATE FUNCTION invoice_transaction.lines(ref text, event text)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.account,
         CASE WHEN lines.event = 'void' THEN (CASE x.side WHEN 'debit' THEN 'credit' ELSE 'debit' END) ELSE x.side END,
         x.cents
  FROM invoice.invoice i
  CROSS JOIN LATERAL (VALUES
    ('411', 'debit', cella.cents(i.total)),
    ('706', 'credit', cella.cents(i.net)),
    ('44571', 'credit', cella.cents(i.vat))
  ) x (account, side, cents)
  WHERE i.id = ref AND x.cents IS NOT NULL;
END;

-- The lines a payment posts: the bank (512) debited and clients (411)
-- credited by what was received. A payment beyond what is owed leaves the
-- client's 411 in credit: the credit owed to them.
CREATE FUNCTION invoice_transaction.payment_lines(ref bigint)
RETURNS TABLE (account text, side text, cents bigint)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT x.account, x.side, x.cents
  FROM invoice.payment p
  CROSS JOIN LATERAL (VALUES
    ('512', 'debit', cella.cents(p.amount)),
    ('411', 'credit', cella.cents(p.amount))
  ) x (account, side, cents)
  WHERE p.id = ref;
END;

-- Why an invoice's issue or void is not in the books as it should be, or
-- NULL: the posting exists, is dated the day of the event, and its lines
-- are exactly the event's.
CREATE FUNCTION invoice_transaction.unposted(ref text, event text) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN p.entry IS NULL THEN ref || ' posted no ' || unposted.event || ' entry'
    WHEN e.date IS DISTINCT FROM CASE unposted.event WHEN 'void' THEN i.voided ELSE i.issued END
      THEN p.entry || ' is not dated on ' || ref || '''s ' || unposted.event
    WHEN EXISTS (
      (SELECT l.account, l.side, l.cents FROM invoice_transaction.lines(ref, unposted.event) l)
      EXCEPT ALL
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
    ) OR EXISTS (
      (SELECT t.account, t.side, cella.cents(t.amount) FROM transaction.line t WHERE t.entry = p.entry)
      EXCEPT ALL
      (SELECT l.account, l.side, l.cents FROM invoice_transaction.lines(ref, unposted.event) l)
    ) THEN p.entry || ' does not post ' || ref || '''s ' || unposted.event
  END
  FROM invoice.invoice i
  LEFT JOIN invoice_transaction.posting p ON p.invoice = i.id AND p.event = unposted.event
  LEFT JOIN transaction.entry e ON e.id = p.entry
  WHERE i.id = ref;
END;

-- invoice:invoice:issue — the issue is in the books.
CREATE FUNCTION invoice_transaction.issued(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN invoice_transaction.unposted(payload ->> 'invoice', 'issue');

-- invoice:invoice:void — the credit note is in the books.
CREATE FUNCTION invoice_transaction.voided(payload jsonb) RETURNS text
LANGUAGE sql STABLE
RETURN invoice_transaction.unposted(payload ->> 'invoice', 'void');

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('invoice:invoice:issue', 'invoice_transaction.issued(jsonb)', 'invoice-transaction'),
  ('invoice:invoice:void', 'invoice_transaction.voided(jsonb)', 'invoice-transaction');

GRANT USAGE ON SCHEMA invoice_transaction TO cella_app, cella_guards;
GRANT SELECT ON invoice_transaction.posting TO cella_app, cella_guards;
GRANT INSERT ON invoice_transaction.posting TO cella_app;
