-- How each action that writes the transaction feat's schema applies to
-- the state before it (architecture.md, "Folds").

-- The receipt of the write entry `n` is in: its own, or, for an effect,
-- the decision's before it, as `cella.receipt()` gave the write.
CREATE FUNCTION transaction.receipt_of(n bigint) RETURNS bigint
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT l.receipt FROM cella.log l WHERE l.n <= receipt_of.n AND l.receipt IS NOT NULL ORDER BY l.n DESC LIMIT 1;
END;

-- An entry and its lines as the log keeps them, `{date, label, lines}`,
-- posted again under the id `id` the entry names, in the write of entry
-- `n`: what `record` wrote, so a write that posts, this feat's or a
-- graft's, folds its entry by calling it from its fold. A person's line
-- keeps its amount as its commitment, which the line takes as a folded
-- scope does, with no amount (`cella.commits`). The journal's trigger
-- numbers it and refuses an id that is not its next.
CREATE FUNCTION transaction.fold_record(n bigint, id text, posting jsonb, corrects text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF posting ->> 'label' IS NULL OR posting -> 'lines' IS NULL THEN
    RAISE EXCEPTION 'transaction: entry % keeps no label and lines for %, so no fold posts it', n, id;
  END IF;
  INSERT INTO transaction.entry (id, date, label, corrects, receipt)
  VALUES (id, (posting ->> 'date')::date, posting ->> 'label', corrects, transaction.receipt_of(n));
  INSERT INTO transaction.line (entry, n, account, side, amount, person)
  SELECT id, x.n, x.l ->> 'account', x.l ->> 'side',
         CASE WHEN x.l ->> 'person' IS NULL THEN cella.amount((x.l ->> 'cents')::bigint)
              WHEN cella.commits('transaction.line.amount', x.l ->> 'person', fold_record.n, x.l -> 'cents') IS NOT NULL THEN NULL::cella.amount END,
         x.l ->> 'person'
  FROM jsonb_array_elements(posting -> 'lines') WITH ORDINALITY AS x (l, n);
END
$$;

-- transaction:transaction:post, :pay and :adjust: the entry the payload
-- names, posted as it keeps it, a correction naming what it corrects.
CREATE FUNCTION transaction.fold_post(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  PERFORM transaction.fold_record((entry ->> 'n')::bigint, p ->> 'entry', p, p ->> 'corrects');
END
$$;

SELECT cella.lets_fold('transaction:transaction:post', 1, 'transaction.fold_post(jsonb)', 'transaction');
SELECT cella.lets_fold('transaction:transaction:pay', 1, 'transaction.fold_post(jsonb)', 'transaction');
SELECT cella.lets_fold('transaction:transaction:adjust', 1, 'transaction.fold_post(jsonb)', 'transaction');
