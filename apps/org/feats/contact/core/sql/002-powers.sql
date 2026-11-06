-- The power each contact write needs; the membership feat's guard checks
-- that the actor holds it. A co-op where every member edits contacts grants
-- it through a mandate like any other, so nothing is allowed by omission.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('contact:contact:add', 'edit-contact', NULL, 'contact'),
  ('contact:contact:update', 'edit-contact', NULL, 'contact'),
  ('contact:contact:archive', 'edit-contact', NULL, 'contact');
