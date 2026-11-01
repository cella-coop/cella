-- The power each meeting write needs; the circle-membership graft's guard
-- checks that the actor holds it, and circle-meeting-membership that it
-- reaches the meeting's circle. The agenda's writes need a seat in the
-- circle instead, a check the same graft backs.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('meeting:meeting:schedule', 'schedule-meeting', NULL, 'meeting'),
  ('meeting:meeting:cancel', 'schedule-meeting', NULL, 'meeting'),
  ('meeting:meeting:hold', 'keep-minutes', NULL, 'meeting'),
  ('meeting:meeting:minute', 'keep-minutes', NULL, 'meeting');
