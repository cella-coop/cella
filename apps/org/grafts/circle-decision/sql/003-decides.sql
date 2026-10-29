-- No write makes a circle or changes its procedure: the seed carries the
-- circles in, and the fixture check holds each one's procedure to the
-- decision feat's. So the trigger that checked it on the circle feat's
-- table goes; a write that sets a procedure will be refused by this
-- graft's rule on its op.
DROP TRIGGER decides_by ON circle.circle;
DROP FUNCTION circle_decision.decides_by();
