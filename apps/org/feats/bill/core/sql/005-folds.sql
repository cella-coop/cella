-- How each action that writes the bill feat's schema applies to the state
-- before it (architecture.md, "Folds").

-- bill:bill:record: the bill under the id the entry names, in its circle,
-- recorded on the entry's day by its actor, and its lines, as the entry
-- keeps them; the feat's trigger puts each line in its bill's circle. A
-- record that merged into a bill recorded before adds nothing.
CREATE FUNCTION bill.fold_record(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  IF coalesce((p ->> 'merged')::boolean, false) THEN
    RETURN;
  END IF;
  INSERT INTO bill.bill (id, supplier, reference, issued, due, label, category, net, vat, total, recorded, recorder, circle)
  VALUES (p ->> 'bill', p ->> 'supplier', p ->> 'reference', (p ->> 'issued')::date, (p ->> 'due')::date, p ->> 'label',
          p ->> 'category', cella.amount((p ->> 'net')::bigint), cella.amount((p ->> 'vat')::bigint),
          cella.amount((p ->> 'total')::bigint), (entry ->> 'date')::date, entry ->> 'actor', p ->> 'circle');
  INSERT INTO bill.line (bill, circle, n, description, quantity, unit_price, amount, vat_rate)
  SELECT p ->> 'bill', p ->> 'circle', x.n, x.description, x.quantity, cella.amount(x.unit_price), cella.amount(x.amount), x.vat_rate
  FROM jsonb_to_recordset(p -> 'priced') AS x (n integer, description text, quantity numeric, unit_price bigint, amount bigint, vat_rate numeric);
END
$$;

-- bill:bill:approve: the bill approved on the entry's day by its actor.
CREATE FUNCTION bill.fold_approve(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE bill.bill SET status = 'approved', approved = (fold_approve.entry ->> 'date')::date, approver = fold_approve.entry ->> 'actor'
  WHERE id = fold_approve.entry -> 'payload' ->> 'bill';
END;

-- bill:bill:pay: the bill paid on the entry's day.
CREATE FUNCTION bill.fold_pay(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE bill.bill SET status = 'paid', paid = (fold_pay.entry ->> 'date')::date
  WHERE id = fold_pay.entry -> 'payload' ->> 'bill';
END;

SELECT cella.lets_fold('bill:bill:record', 1, 'bill.fold_record(jsonb)', 'bill');
SELECT cella.lets_fold('bill:bill:approve', 1, 'bill.fold_approve(jsonb)', 'bill');
SELECT cella.lets_fold('bill:bill:pay', 1, 'bill.fold_pay(jsonb)', 'bill');
