-- transaction.entry's body: its free-form content, a Loro snapshot of core
-- body's blocks, set by each save an editor's browser signs, and always
-- one with a canonical form. Saving it needs `discuss` in its circle,
-- which every seat there holds, and that the saver reads the record.
ALTER TABLE transaction.entry ADD COLUMN body bytea CHECK (body IS NULL OR cella.document_canonical(body) IS NOT NULL);

GRANT UPDATE (body) ON transaction.entry TO cella_app;

-- A body's save updates its entry, one of the rows the policy `reads`
-- shows: in a write's transaction every entry, whose guards judge the
-- saver by the same terms as `reads`.
CREATE POLICY changes ON transaction.entry FOR UPDATE TO cella_app
  USING ((SELECT cella.sees('transaction')) OR circle = ANY ((SELECT cella.circles('transaction'))::text[]) OR EXISTS (SELECT FROM transaction.line l WHERE l.entry = entry.id));

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('transaction:body:save', 'discuss', NULL, 'transaction');

-- transaction:body:save: every person its entry names as a contributor since the last
-- save holds `discuss` in the record's circle on the verdict date, as
-- core body's session asks of each at every update. Refused, it names
-- who does not and what would let them.
CREATE FUNCTION transaction.contributed(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save names a contributor who holds no discuss in ' || (contributed.payload ->> 'circle') || ': '
      || string_agg(c, ', ' ORDER BY c) || '; a mandate granting it there, or saving without their edits, would allow it'
  FROM jsonb_array_elements_text(coalesce(contributed.payload -> 'contributors', '[]')) c
  WHERE NOT circle_person.may(c, 'discuss', NULL, contributed.payload ->> 'circle', cella.verdict_date())
  HAVING count(*) > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('transaction:body:save', 'transaction.contributed(jsonb)', 'transaction');

-- transaction:body:save: the save's snapshot holds the body it replaces. Its `base`,
-- the hash of the saved body the browser merged, empty for none, is
-- `replaced`, the `encode(sha256(body), 'hex')` of the body the record
-- held, which the handler read under the row's lock in the save's own
-- transaction. Refused, it names both and what would let it.
CREATE FUNCTION transaction.based(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save merged the body hashed ' || coalesce(nullif(based.payload ->> 'base', ''), 'none')
      || ', but the record held the one hashed ' || coalesce(nullif(based.payload ->> 'replaced', ''), 'none')
      || '; merging the saved body into the snapshot and saving again would allow it'
  WHERE coalesce(based.payload ->> 'base', '') <> coalesce(based.payload ->> 'replaced', '');
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('transaction:body:save', 'transaction.based(jsonb)', 'transaction');

-- transaction:body:save: the saver reads the journal entry, by the
-- terms its row-level policy reads it by, but for the whole state a
-- write's transaction sees, so that `discuss` in its circle alone saves
-- no body its holder cannot read: a mandate covering its circle, or one
-- of its lines', for a power that reads the books, or a power or graft
-- that reaches one of its lines' accounts. A write's transaction reads
-- as its actor. Refused, it names the circle and what would let them.
CREATE FUNCTION transaction.legible(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save is by someone who does not read this journal entry of ' || r.circle
      || '; a mandate there that reads it would allow it'
  FROM transaction.entry r
  WHERE r.id = (legible.payload ->> 'transaction')
    AND (r.circle = ANY (cella.circles('transaction')) OR EXISTS (SELECT FROM transaction.line l WHERE l.entry = r.id AND (l.circle = ANY (cella.circles('transaction')) OR cella.reaches('transaction', l.account)))) IS NOT TRUE;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('transaction:body:save', 'transaction.legible(jsonb)', 'transaction');

-- transaction:body:save: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION transaction.fold_body_save(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE transaction.entry SET body = decode(fold_body_save.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE id = (fold_body_save.entry -> 'payload' ->> 'transaction');
END;

SELECT cella.lets_fold('transaction:body:save', 1, 'transaction.fold_body_save(jsonb)', 'transaction');
