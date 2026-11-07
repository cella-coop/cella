-- How each action that writes the invoice feat's schema applies to the
-- state before it (architecture.md, "Folds").

-- invoice:invoice:issue: the series' next number spent by the SQL its
-- handler runs, `invoice.spend`, which must make the invoice the entry
-- names; then the invoice and its lines as the entry keeps them, issued
-- on its day, the seller's mentions as they were kept, and the name and
-- address it bills as their commitments.
CREATE FUNCTION invoice.fold_issue(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  n bigint := (entry ->> 'n')::bigint;
  spent integer;
BEGIN
  spent := invoice.spend(p ->> 'series');
  IF invoice.number_id(p ->> 'series', spent) IS DISTINCT FROM p ->> 'invoice' THEN
    RAISE EXCEPTION 'invoice: entry % issues %, but % spends %', n, p ->> 'invoice', p ->> 'series',
      invoice.number_id(p ->> 'series', spent);
  END IF;
  INSERT INTO invoice.invoice (id, series, number, issued, due, bill_to, bill_address, seller, label, net, vat, total)
  VALUES (p ->> 'invoice', p ->> 'series', spent, (p ->> 'issued')::date, (p ->> 'due')::date,
          cella.commits('invoice.invoice.bill_to', p ->> 'invoice', n, p -> 'bill_to'),
          cella.commits('invoice.invoice.bill_address', p ->> 'invoice', n, p -> 'bill_address'),
          p -> 'seller', p ->> 'label', cella.amount((p ->> 'net')::bigint), cella.amount((p ->> 'vat')::bigint),
          cella.amount((p ->> 'total')::bigint));
  INSERT INTO invoice.line (invoice, n, description, quantity, unit_price, amount, vat_rate)
  SELECT p ->> 'invoice', x.n, x.description, x.quantity, cella.amount(x.unit_price), cella.amount(x.amount), x.vat_rate
  FROM jsonb_to_recordset(p -> 'priced') AS x (n integer, description text, quantity numeric, unit_price bigint, amount bigint, vat_rate numeric);
END
$$;

-- invoice:invoice:send: the invoice sent on the day the entry names; one
-- sent already keeps its first day, and a voided one, which the entry
-- names unsent, stays unsent.
CREATE FUNCTION invoice.fold_send(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE invoice.invoice SET sent = (fold_send.entry -> 'payload' ->> 'sent')::date
  WHERE id = fold_send.entry -> 'payload' ->> 'invoice' AND sent IS NULL AND voided IS NULL
    AND fold_send.entry -> 'payload' ->> 'sent' IS NOT NULL;
END;

-- invoice:invoice:payment: the payment under the id the entry names,
-- received on its day, with the receipt `cella.receipt()` gave its write,
-- as the entry keeps it. A payment that merged into one recorded before
-- adds nothing.
CREATE FUNCTION invoice.fold_payment(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO invoice.payment (id, invoice, receipt, at, amount, method, reference) OVERRIDING SYSTEM VALUE
  SELECT (p ->> 'payment')::bigint, p ->> 'invoice', (p ->> 'receipt')::bigint, (p ->> 'at')::date,
         cella.amount((p ->> 'amount')::bigint), p ->> 'method', p ->> 'reference'
  FROM (SELECT fold_payment.entry -> 'payload' AS p) x
  WHERE NOT coalesce((p ->> 'merged')::boolean, false);
END;

-- invoice:invoice:void: the invoice voided on the day the entry names,
-- its reason as its commitment.
CREATE FUNCTION invoice.fold_void(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  UPDATE invoice.invoice
  SET voided = (p ->> 'voided')::date,
      reason = cella.commits('invoice.invoice.reason', p ->> 'invoice', (entry ->> 'n')::bigint, p -> 'reason')
  WHERE id = p ->> 'invoice';
END
$$;

SELECT cella.lets_fold('invoice:invoice:issue', 1, 'invoice.fold_issue(jsonb)', 'invoice');
SELECT cella.lets_fold('invoice:invoice:send', 1, 'invoice.fold_send(jsonb)', 'invoice');
SELECT cella.lets_fold('invoice:invoice:payment', 1, 'invoice.fold_payment(jsonb)', 'invoice');
SELECT cella.lets_fold('invoice:invoice:void', 1, 'invoice.fold_void(jsonb)', 'invoice');
