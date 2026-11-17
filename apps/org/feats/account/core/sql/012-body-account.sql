-- account.account's body: its free-form content, a Loro snapshot of core
-- body's blocks, set by each save an editor's browser signs, and always
-- one with a canonical form. Saving it needs `discuss` in its circle,
-- which every seat there holds.
ALTER TABLE account.account ADD COLUMN body bytea CHECK (body IS NULL OR cella.document_canonical(body) IS NOT NULL);

GRANT UPDATE (body) ON account.account TO cella_app;

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('account:body:save-account', 'discuss', NULL, 'account');

-- account:body:save-account: every person its entry names as a contributor since the last
-- save holds `discuss` in the record's circle on the verdict date, as
-- core body's session asks of each at every update. Refused, it names
-- who does not and what would let them.
CREATE FUNCTION account.contributed_account(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save names a contributor who holds no discuss in ' || (contributed_account.payload ->> 'circle') || ': '
      || string_agg(c, ', ' ORDER BY c) || '; a mandate granting it there, or saving without their edits, would allow it'
  FROM jsonb_array_elements_text(coalesce(contributed_account.payload -> 'contributors', '[]')) c
  WHERE NOT circle_person.may(c, 'discuss', NULL, contributed_account.payload ->> 'circle', cella.verdict_date())
  HAVING count(*) > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:body:save-account', 'account.contributed_account(jsonb)', 'account');

-- account:body:save-account: the save's snapshot holds the body it replaces. Its `base`,
-- the hash of the saved body the browser merged, empty for none, is
-- `replaced`, the `encode(sha256(body), 'hex')` of the body the record
-- held, which the handler read under the row's lock in the save's own
-- transaction. Refused, it names both and what would let it.
CREATE FUNCTION account.based_account(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save merged the body hashed ' || coalesce(nullif(based_account.payload ->> 'base', ''), 'none')
      || ', but the record held the one hashed ' || coalesce(nullif(based_account.payload ->> 'replaced', ''), 'none')
      || '; merging the saved body into the snapshot and saving again would allow it'
  WHERE coalesce(based_account.payload ->> 'base', '') <> coalesce(based_account.payload ->> 'replaced', '');
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('account:body:save-account', 'account.based_account(jsonb)', 'account');

-- account:body:save-account: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION account.fold_body_save_account(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE account.account SET body = decode(fold_body_save_account.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE code = (fold_body_save_account.entry -> 'payload' ->> 'account');
END;

SELECT cella.lets_fold('account:body:save-account', 1, 'account.fold_body_save_account(jsonb)', 'account');
