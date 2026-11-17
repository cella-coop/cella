-- account.period's body: its free-form content, a Loro snapshot of core
-- body's blocks, set by each save an editor's browser signs, and always
-- one with a canonical form. Saving it needs `discuss` in its circle,
-- which every seat there holds.
ALTER TABLE account.period ADD COLUMN body bytea CHECK (body IS NULL OR cella.document_canonical(body) IS NOT NULL);

GRANT UPDATE (body) ON account.period TO cella_app;

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:body:save-period', 'discuss', NULL, 'account');

-- account:body:save-period: every person its entry names as a contributor since the last
-- save holds `discuss` in the record's circle on the verdict date, as
-- core body's session asks of each at every update. Refused, it names
-- who does not and what would let them.
CREATE FUNCTION account.contributed_period(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save names a contributor who holds no discuss in ' || (contributed_period.payload ->> 'circle') || ': '
      || string_agg(c, ', ' ORDER BY c) || '; a mandate granting it there, or saving without their edits, would allow it'
  FROM jsonb_array_elements_text(coalesce(contributed_period.payload -> 'contributors', '[]')) c
  WHERE NOT circle_person.may(c, 'discuss', NULL, contributed_period.payload ->> 'circle', cella.verdict_date())
  HAVING count(*) > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:body:save-period', 'account.contributed_period(jsonb)', 'account');

-- account:body:save-period: the save's snapshot holds the body it replaces. Its `base`,
-- the hash of the saved body the browser merged, empty for none, is
-- `replaced`, the `encode(sha256(body), 'hex')` of the body the record
-- held, which the handler read under the row's lock in the save's own
-- transaction. Refused, it names both and what would let it.
CREATE FUNCTION account.based_period(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save merged the body hashed ' || coalesce(nullif(based_period.payload ->> 'base', ''), 'none')
      || ', but the record held the one hashed ' || coalesce(nullif(based_period.payload ->> 'replaced', ''), 'none')
      || '; merging the saved body into the snapshot and saving again would allow it'
  WHERE coalesce(based_period.payload ->> 'base', '') <> coalesce(based_period.payload ->> 'replaced', '');
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:body:save-period', 'account.based_period(jsonb)', 'account');

-- account:body:save-period: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION account.fold_body_save_period(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE account.period SET body = decode(fold_body_save_period.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE month = (fold_body_save_period.entry -> 'payload' ->> 'period');
END;

SELECT cella.lets_fold('account:body:save-period', 1, 'account.fold_body_save_period(jsonb)', 'account');
