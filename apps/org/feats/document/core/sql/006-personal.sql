-- A comment's text is its author's own words: personal data of class
-- `profile`, its subject its author, as a person's name is. The log
-- commits to it and the vault keeps it, and erasing its author redacts
-- it. A document's text, its updates and its versions, is the coop's, and
-- the log keeps it as it is.
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES
  ('document', 'comment', 'text', 'profile', 'author', 'document');
