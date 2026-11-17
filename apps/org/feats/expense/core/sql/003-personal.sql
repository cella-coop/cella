-- What of an expense is personal data: what the member wrote of it and
-- the text of their receipt, of class `expense-receipt`, supporting
-- vouchers the law keeps ten years (Code de commerce, art. L123-22). Its
-- figures are the books'.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('expense', 'expense', 'label', 'expense-receipt', 'member', 'expense'),
  ('expense', 'expense', 'receipt', 'expense-receipt', 'member', 'expense');

COMMENT ON COLUMN expense.expense.net IS 'not personal: an amount of the books';
COMMENT ON COLUMN expense.expense.decider IS 'not personal: the decider''s pseudonymous address';

-- As before, but for the notary's redaction (`cella.redacting()`), the one
-- change of its figures a submitted expense takes. Its body, its
-- free-form discussion, is not its figures nor its step: an update that
-- changes no other column, its id included, passes at any step, and when
-- repeated.
CREATE OR REPLACE FUNCTION expense.moves() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF cella.redacting() OR to_jsonb(NEW) - 'body' = to_jsonb(OLD) - 'body' THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> OLD.status AND (OLD.status, NEW.status) NOT IN (
    ('draft', 'submitted'), ('submitted', 'approved'), ('submitted', 'refused'), ('approved', 'reimbursed')
  ) THEN
    RAISE EXCEPTION '% is %, and cannot become %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF OLD.status <> 'draft' AND (expense.total(NEW), cella.cents(NEW.vat), NEW.category, NEW.day, NEW.member)
    IS DISTINCT FROM (expense.total(OLD), cella.cents(OLD.vat), OLD.category, OLD.day, OLD.member) THEN
    RAISE EXCEPTION '% was submitted: its figures never change', OLD.id
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  -- Each step is taken once: a second approval, refusal or reimbursement
  -- of the same expense is refused.
  IF NEW.status = OLD.status AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION '% is % already', OLD.id, OLD.status
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;
