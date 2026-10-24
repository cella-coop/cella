-- feat invoice
CREATE FUNCTION invoice.issued_total() RETURNS numeric
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT coalesce(sum(i.total::numeric), 0) FROM invoice.invoice i WHERE i.status = 'issued';
END;

-- refused: reads the client feat's table directly, and through an unqualified name
CREATE FUNCTION invoice.billed_to(inv text) RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT c.name FROM client.client c JOIN billed b ON b.client = c.id WHERE b.invoice = inv $$;
