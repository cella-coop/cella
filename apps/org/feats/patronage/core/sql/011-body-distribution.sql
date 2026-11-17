-- patronage.distribution's body: its free-form content, a Loro snapshot of core
-- body's blocks, set by each save an editor's browser signs, and always
-- one with a canonical form. Saving it needs `discuss` in its circle,
-- which every seat there holds, and that the saver reads the record.
ALTER TABLE patronage.distribution ADD COLUMN body bytea CHECK (body IS NULL OR cella.document_canonical(body) IS NOT NULL);

GRANT UPDATE (body) ON patronage.distribution TO cella_app;

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('patronage:body:save-distribution', 'discuss', NULL, 'patronage');

-- patronage:body:save-distribution: every person its entry names as a contributor since the last
-- save holds `discuss` in the record's circle on the verdict date, as
-- core body's session asks of each at every update. Refused, it names
-- who does not and what would let them.
CREATE FUNCTION patronage.contributed_distribution(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save names a contributor who holds no discuss in ' || (contributed_distribution.payload ->> 'circle') || ': '
      || string_agg(c, ', ' ORDER BY c) || '; a mandate granting it there, or saving without their edits, would allow it'
  FROM jsonb_array_elements_text(coalesce(contributed_distribution.payload -> 'contributors', '[]')) c
  WHERE NOT circle_person.may(c, 'discuss', NULL, contributed_distribution.payload ->> 'circle', cella.verdict_date())
  HAVING count(*) > 0;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:body:save-distribution', 'patronage.contributed_distribution(jsonb)', 'patronage');

-- patronage:body:save-distribution: the save's snapshot holds the body it replaces. Its `base`,
-- the hash of the saved body the browser merged, empty for none, is
-- `replaced`, the `encode(sha256(body), 'hex')` of the body the record
-- held, which the handler read under the row's lock in the save's own
-- transaction. Refused, it names both and what would let it.
CREATE FUNCTION patronage.based_distribution(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save merged the body hashed ' || coalesce(nullif(based_distribution.payload ->> 'base', ''), 'none')
      || ', but the record held the one hashed ' || coalesce(nullif(based_distribution.payload ->> 'replaced', ''), 'none')
      || '; merging the saved body into the snapshot and saving again would allow it'
  WHERE coalesce(based_distribution.payload ->> 'base', '') <> coalesce(based_distribution.payload ->> 'replaced', '');
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:body:save-distribution', 'patronage.based_distribution(jsonb)', 'patronage');

-- patronage:body:save-distribution: the saver reads the distribution,
-- by the terms its row-level policy reads it by, but for the whole
-- state a write's transaction sees, so that `discuss` in its circle
-- alone saves no body its holder cannot read: a mandate covering its
-- circle for `read`, or for a power that reads the feat. A write's
-- transaction reads as its actor. Refused, it names the circle and what
-- would let them.
CREATE FUNCTION patronage.legible_distribution(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT 'a body''s save is by someone who does not read this distribution of ' || r.circle
      || '; a mandate there that reads it would allow it'
  FROM patronage.distribution r
  WHERE r.id = (legible_distribution.payload ->> 'distribution')
    AND (r.circle = ANY (circle.reads('{patronage}'))) IS NOT TRUE;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:body:save-distribution', 'patronage.legible_distribution(jsonb)', 'patronage');

-- patronage:body:save-distribution: the body set to the snapshot its entry carries, in hex.
CREATE FUNCTION patronage.fold_body_save_distribution(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE patronage.distribution SET body = decode(fold_body_save_distribution.entry -> 'payload' ->> 'snapshot', 'hex')
  WHERE id = (fold_body_save_distribution.entry -> 'payload' ->> 'distribution');
END;

SELECT cella.lets_fold('patronage:body:save-distribution', 1, 'patronage.fold_body_save_distribution(jsonb)', 'patronage');
