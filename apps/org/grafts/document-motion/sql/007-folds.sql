-- How the writes on which document-motion's state changes apply to the
-- state before them (architecture.md, "Folds"). What a motion asks to
-- adopt is its action, which the motion feat's fold writes, and this
-- graft's `adoption` reads it, so its fold writes nothing.

-- motion:motion:propose: each action to adopt the folded motion carries
-- names a version, and no two name versions of one document, as
-- `document_motion.asks` judged it when it was proposed; a fold that finds
-- otherwise refuses, saying what it found.
CREATE FUNCTION document_motion.fold_propose(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  flaw text := document_motion.asks(entry -> 'payload');
BEGIN
  IF flaw IS NOT NULL THEN
    RAISE EXCEPTION 'document-motion: entry % proposes %, where the fold finds %', entry ->> 'n', entry -> 'payload' ->> 'motion', flaw;
  END IF;
END
$$;

SELECT cella.lets_fold('motion:motion:propose', 1, 'document_motion.fold_propose(jsonb)', 'document-motion');
