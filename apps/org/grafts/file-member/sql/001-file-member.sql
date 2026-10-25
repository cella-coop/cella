CREATE SCHEMA file_member;

-- A member's records on file, such as their signed subscription form or
-- the papers their admission asked for: each a file of class
-- member-profile about them, kept once. Both by id, with no foreign key
-- into either feat.
CREATE TABLE file_member.record (
  member text NOT NULL,
  file text NOT NULL UNIQUE,
  PRIMARY KEY (member, file)
);

-- file-member:member:attach — a member files a record of their own, a
-- file they uploaded by this write about themselves, while they are
-- invited or a member.
CREATE FUNCTION file_member.files(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || coalesce(x.member, 'is named')
    WHEN m.address IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may not file a record of ' || m.address
    WHEN m.status = 'exited' THEN m.address || ' has left'
    WHEN r.file IS NULL THEN coalesce(x.file, 'no file') || ' is not on ' || m.address || '''s file'
    ELSE file.stored(x.file, 'member-profile', m.address)
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'file' AS file) x
  LEFT JOIN member.member m ON m.address = x.member
  LEFT JOIN file_member.record r ON r.member = x.member AND r.file = x.file;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES
  ('file-member:member:attach', 'file_member.files(jsonb)', 'file-member');

GRANT USAGE ON SCHEMA file_member TO cella_app, cella_rules;
GRANT SELECT ON file_member.record TO cella_app, cella_rules;
GRANT INSERT ON file_member.record TO cella_app;
