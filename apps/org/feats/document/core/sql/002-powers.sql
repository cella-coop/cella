-- The power each document write but adoption needs; the membership
-- feat's guard checks that the actor holds it. A co-op where every member
-- edits documents grants it through a mandate like any other, so nothing is
-- allowed by omission. Adoption needs the adopting circle's motion instead.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('document:document:edit', 'edit-document', NULL, 'document'),
  ('document:document:version', 'edit-document', NULL, 'document'),
  ('document:document:comment', 'edit-document', NULL, 'document');
