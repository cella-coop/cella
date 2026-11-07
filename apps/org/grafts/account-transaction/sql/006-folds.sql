-- How each action that writes the account-transaction graft's schema, or
-- the feats' it joins through their published writes, applies to the
-- state before it (architecture.md, "Folds").

-- account-transaction:entry:carry: the accounts the entry asks to open
-- that the chart lacks, opened as `opening` opened them, then the entry
-- posted as the journal keeps it.
CREATE FUNCTION account_transaction.fold_carry(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM account.fold_opening(a ->> 'code', a ->> 'label') FROM jsonb_array_elements(p -> 'accounts') a;
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p);
END
$$;

SELECT cella.lets_fold('account-transaction:entry:carry', 1, 'account_transaction.fold_carry(jsonb)', 'account-transaction');
