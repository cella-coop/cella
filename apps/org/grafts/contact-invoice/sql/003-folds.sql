-- How each action that writes the contact-invoice graft's schema applies
-- to the state before it (architecture.md, "Folds").

-- contact-invoice:billing:link: the invoice linked to the contact the
-- entry names; linking again moves it, as its handler does.
CREATE FUNCTION contact_invoice.fold_link(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO contact_invoice.billing (invoice, contact)
  VALUES (fold_link.entry -> 'payload' ->> 'invoice', fold_link.entry -> 'payload' ->> 'contact')
  ON CONFLICT (invoice) DO UPDATE SET contact = excluded.contact;
END;

SELECT cella.lets_fold('contact-invoice:billing:link', 1, 'contact_invoice.fold_link(jsonb)', 'contact-invoice');
