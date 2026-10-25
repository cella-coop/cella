-- Starting a document is editing: it needs edit-document, which the
-- circle-membership graft's rule checks the actor holds.
INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('document:document:create', 'edit-document', NULL, 'document');

-- The app role starts documents; it never renames or removes one.
GRANT INSERT ON document.document TO cella_app;
