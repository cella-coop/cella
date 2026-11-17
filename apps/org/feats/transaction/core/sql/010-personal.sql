-- A line that posts a person's own figure, such as a member's draw or a
-- payment in of their capital, names them as its `person`: its amount is
-- personal data of theirs, of class `books`, which a write's payload
-- commits to and the vault keeps, so no entry shows it in plain
-- (`logged`). The journal shows it as it shows every line. Once its
-- person's clock runs out the sweep redacts it to NULL, so the amount is
-- nullable; a line the log folds with its commitment holds none either.
ALTER TABLE transaction.line ALTER COLUMN amount DROP NOT NULL;

INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('transaction', 'line', 'amount', 'books', 'person', 'transaction');

COMMENT ON COLUMN transaction.line.person IS 'not personal: whose own figure the line is, an address';

-- As before, and a line holds an amount, but where the notary redacts it
-- or the fold applies its commitment: such lines are each a person's
-- figure posted on both sides, so the others balance by themselves.
CREATE OR REPLACE FUNCTION transaction.balances() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ref text;
  lines integer;
  debit bigint;
  credit bigint;
  withheld integer;
BEGIN
  IF TG_TABLE_NAME = 'entry' THEN
    ref := NEW.id;
  ELSE
    ref := NEW.entry;
  END IF;
  SELECT count(*),
         coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'debit'), 0),
         coalesce(sum(cella.cents(l.amount)) FILTER (WHERE l.side = 'credit'), 0),
         count(*) FILTER (WHERE l.amount IS NULL)
  INTO lines, debit, credit, withheld
  FROM transaction.line l WHERE l.entry = ref;
  IF withheld > 0 AND current_setting('cella.folding', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION '% posts % lines with no amount: only a fold leaves a person''s line without its figure', ref, withheld
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF lines < 2 OR debit <> credit THEN
    RAISE EXCEPTION '% does not balance: % lines debit % and credit % cents', ref, lines, debit, credit
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NULL;
END
$$;

-- As before, but for the notary's redaction (`cella.redacting()`), the one
-- change a person's line takes. An entry's body, its free-form
-- discussion, is not a posting: an update of an entry that changes no
-- other column, its id included, passes, and when repeated. A line has no
-- body, and the check is the entry's alone.
CREATE OR REPLACE FUNCTION transaction.permanent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'entry' THEN
    IF to_jsonb(NEW) - 'body' = to_jsonb(OLD) - 'body' THEN
      RETURN NEW;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'line' THEN
    IF cella.redacting() AND NEW.amount IS NULL
      AND (NEW.circle, NEW.entry, NEW.n, NEW.account, NEW.side, NEW.person) IS NOT DISTINCT FROM (OLD.circle, OLD.entry, OLD.n, OLD.account, OLD.side, OLD.person) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'the journal is permanent: a %''s rows never change; a correction is a new entry', TG_TABLE_NAME
    USING ERRCODE = 'triggered_action_exception';
END
$$;
