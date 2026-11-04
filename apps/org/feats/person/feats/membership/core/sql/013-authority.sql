-- The authority every read asks: whether a member holds a power on a day,
-- by their seats and the mandates on them (`may`), so a feat's rows read
-- by a power open to whoever holds it.
INSERT INTO cella.authority (fn, owner) VALUES
  ('membership.may(text, text, bigint, date)', 'membership');
