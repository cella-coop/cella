-- Starting a document is editing: it needs edit-document, which the
-- circle-member graft's rule checks the actor holds.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('document:document:create', 'edit-document', NULL, 'document');
