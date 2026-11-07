-- How each action that writes the account feat's schema applies to the
-- state before it (architecture.md, "Folds"), and the folds of the
-- writes it publishes, which a graft's fold calls as its handler calls
-- them.

-- What `opening` wrote: an account the chart lacked, of the kind its
-- code's class makes it, under the longest code the chart holds that
-- begins its own. A code the chart holds already opens nothing.
CREATE FUNCTION account.fold_opening(code text, label text) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO account.account (code, label, kind, parent)
  SELECT fold_opening.code, fold_opening.label, account.kind_of(fold_opening.code),
         (SELECT p.code FROM account.account p WHERE fold_opening.code LIKE p.code || '%' AND p.code <> fold_opening.code
          ORDER BY length(p.code) DESC LIMIT 1)
  WHERE account.kind_of(fold_opening.code) IS NOT NULL AND NOT EXISTS (SELECT FROM account.account a WHERE a.code = fold_opening.code);
END;

-- What `holding` wrote, in the write of entry `n`: the capital account
-- `code` the entry names, under `parent` and of its kind, for its holder,
-- its label, which names them, as its commitment.
CREATE FUNCTION account.fold_holding(n bigint, code text, parent text, holder text, label jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO account.account (code, label, kind, parent, holder)
  SELECT fold_holding.code, cella.commits('account.account.label', fold_holding.holder, fold_holding.n, fold_holding.label),
         p.kind, p.code, fold_holding.holder
  FROM account.account p WHERE p.code = fold_holding.parent;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account: entry % opens % under %, which the chart does not hold', n, code, parent;
  END IF;
END
$$;

-- account:period:open: the month, opened; one open already stays as it is.
CREATE FUNCTION account.fold_open(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO account.period (month) VALUES (fold_open.entry -> 'payload' ->> 'month') ON CONFLICT DO NOTHING;
END;

-- account:period:close: the month, closed on the entry's day.
CREATE FUNCTION account.fold_close(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE account.period SET closed = (fold_close.entry ->> 'date')::date WHERE month = fold_close.entry -> 'payload' ->> 'month';
END;

-- account:terms:adopt: the rule's values copied into terms by the SQL
-- its handler runs, `account.terms_from`, on the policy register as the
-- fold has it, which must make the terms the entry names.
CREATE FUNCTION account.fold_adopt(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  made text := account.terms_from(p ->> 'policy');
BEGIN
  IF made IS DISTINCT FROM nullif(p ->> 'terms', '') THEN
    RAISE EXCEPTION 'account: entry % adopts % from %, but its rule makes %', entry ->> 'n', p ->> 'terms', p ->> 'policy', coalesce(made, 'no terms');
  END IF;
END
$$;

-- account:account:freeze and account:own:freeze: the accounts the entry
-- names, frozen.
CREATE FUNCTION account.fold_freeze(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE account.account SET frozen = true
  WHERE code IN (SELECT jsonb_array_elements_text(fold_freeze.entry -> 'payload' -> 'accounts')) AND NOT frozen;
END;

SELECT cella.lets_fold('account:period:open', 1, 'account.fold_open(jsonb)', 'account');
SELECT cella.lets_fold('account:period:close', 1, 'account.fold_close(jsonb)', 'account');
SELECT cella.lets_fold('account:terms:adopt', 1, 'account.fold_adopt(jsonb)', 'account');
SELECT cella.lets_fold('account:account:freeze', 1, 'account.fold_freeze(jsonb)', 'account');
SELECT cella.lets_fold('account:own:freeze', 1, 'account.fold_freeze(jsonb)', 'account');
