CREATE SCHEMA transaction;

CREATE SEQUENCE transaction.entry_no;

-- An entry of the journal, permanent once posted. `receipt` orders the
-- entries posted through the notary; an entry carried over from before the
-- log has none.
CREATE TABLE transaction.entry (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  id text PRIMARY KEY DEFAULT 'je-' || lpad(nextval('transaction.entry_no')::text, 4, '0'),
  date date NOT NULL,
  label text NOT NULL,
  corrects text REFERENCES transaction.entry,
  receipt bigint UNIQUE
);

CREATE INDEX ON transaction.entry (corrects);

-- A line debits or credits one account, named by its code, by one positive
-- amount. Which accounts exist is the account-transaction graft's.
CREATE TABLE transaction.line (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  entry text NOT NULL REFERENCES transaction.entry,
  n integer NOT NULL CHECK (n > 0),
  account text NOT NULL,
  side text NOT NULL CHECK (side IN ('debit', 'credit')),
  amount cella.amount NOT NULL,
  PRIMARY KEY (entry, n)
);

CREATE INDEX ON transaction.line (account);

-- Every entry balances: its debits equal its credits, over two lines or
-- more. Deferred, so an entry's lines may arrive in several statements;
-- the db library makes deferred checks immediate before the verdict.
CREATE FUNCTION transaction.balances() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ref text;
  lines integer;
  debit bigint;
  credit bigint;
BEGIN
  IF TG_TABLE_NAME = 'entry' THEN
    ref := NEW.id;
  ELSE
    ref := NEW.entry;
  END IF;
  SELECT count(*),
         coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'debit'), 0),
         coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'credit'), 0)
  INTO lines, debit, credit
  FROM transaction.line l WHERE l.entry = ref;
  IF lines < 2 OR debit <> credit THEN
    RAISE EXCEPTION '% does not balance: % lines debit % and credit % cents', ref, lines, debit, credit
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER balances AFTER INSERT ON transaction.entry
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transaction.balances();
CREATE CONSTRAINT TRIGGER balances AFTER INSERT ON transaction.line
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transaction.balances();

-- Nothing in the journal changes: a correction is a new entry.
CREATE FUNCTION transaction.permanent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'the journal is permanent: a %''s rows never change; a correction is a new entry', TG_TABLE_NAME
    USING ERRCODE = 'triggered_action_exception';
END
$$;

CREATE TRIGGER permanent BEFORE UPDATE OR DELETE ON transaction.entry
  FOR EACH ROW EXECUTE FUNCTION transaction.permanent();
CREATE TRIGGER permanent BEFORE UPDATE OR DELETE ON transaction.line
  FOR EACH ROW EXECUTE FUNCTION transaction.permanent();

-- transaction:transaction:adjust — the entry corrects the one the payload
-- names, and that entry's latest correction before it is the base the
-- payload read: a second correction from the same base is refused.
CREATE FUNCTION transaction.corrects(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN e.id IS NULL THEN 'no entry ' || coalesce(x.entry, 'is named')
    WHEN e.corrects IS DISTINCT FROM x.corrects THEN e.id || ' does not correct ' || coalesce(x.corrects, 'an entry')
    WHEN latest.id IS DISTINCT FROM x.base
      THEN x.corrects || ' moved: its correction is ' || coalesce(latest.id, 'none') || ', not ' || coalesce(x.base, 'none')
  END
  FROM (SELECT payload ->> 'entry' AS entry, payload ->> 'corrects' AS corrects, payload ->> 'base' AS base) x
  LEFT JOIN transaction.entry e ON e.id = x.entry
  LEFT JOIN LATERAL (
    SELECT c.id FROM transaction.entry c
    WHERE c.corrects = x.corrects AND c.id <> x.entry AND c.receipt < e.receipt
    ORDER BY c.receipt DESC
    LIMIT 1
  ) latest ON true;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('transaction:transaction:adjust', 'transaction.corrects(jsonb)', 'transaction');

GRANT USAGE ON SCHEMA transaction TO cella_app, cella_guards;
GRANT SELECT ON ALL TABLES IN SCHEMA transaction TO cella_app, cella_guards;
GRANT INSERT ON transaction.entry, transaction.line TO cella_app;
GRANT USAGE ON SEQUENCE transaction.entry_no TO cella_app;
