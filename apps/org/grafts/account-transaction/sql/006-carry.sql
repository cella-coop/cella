-- transaction:transaction:post, when it carries an entry over from the
-- co-op's last tool: each account it opened, as its payload names them,
-- is in the chart and of the kind its code's class makes it. A post that
-- opens nothing names none.
CREATE FUNCTION account_transaction.opens(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT string_agg(o.code || ' was not opened as the write names', '; ' ORDER BY o.code)
  FROM jsonb_array_elements_text(coalesce(payload -> 'opened', '[]'::jsonb)) AS o(code)
  LEFT JOIN account.account a ON a.code = o.code
  WHERE a.code IS NULL OR a.kind IS DISTINCT FROM account.kind_of(o.code);
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('transaction:transaction:post', 'account_transaction.opens(jsonb)', 'account-transaction');
