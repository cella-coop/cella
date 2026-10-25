-- A capital account's label names its member: personal data of class
-- `books`, which the law keeps ten years (Code de commerce, art.
-- L123-22). Erasing a member who has left restricts it; the sweep
-- redacts it once its clock runs out. Other accounts hold no one.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('account', 'account', 'label', 'books', 'holder', 'account');

COMMENT ON COLUMN account.account.holder IS 'not personal: the holder''s pseudonymous address';
