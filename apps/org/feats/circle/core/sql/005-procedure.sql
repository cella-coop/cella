-- A circle's procedure is the default by which its decisions are taken,
-- named by the procedure's id: consent, majority, two thirds or one of
-- the co-op's own. Which procedures there are is the decision feat's, and
-- that a circle's is one of them circle-decision's.
ALTER TABLE circle.circle
  DROP CONSTRAINT circle_procedure_check,
  ADD CHECK (procedure ~ '^[a-z][a-z-]*$');
