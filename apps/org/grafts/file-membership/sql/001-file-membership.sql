CREATE SCHEMA file_membership;

-- A member's records on file, such as their signed subscription form or
-- the papers their admission asked for: each a file of class
-- profile about them, kept once. Both by id, with no foreign key
-- into either feat.
CREATE TABLE file_membership.record (
  member text NOT NULL,
  file text NOT NULL UNIQUE,
  PRIMARY KEY (member, file)
);

-- file-membership:member:attach — a member files a record of their own, a
-- file they uploaded by this write about themselves, while they are
-- invited or a member.
CREATE FUNCTION file_membership.files(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN m.address IS NULL THEN 'no member ' || coalesce(x.member, 'is named')
    WHEN m.address IS DISTINCT FROM cella.actor() THEN coalesce(cella.actor(), 'no one') || ' may not file a record of ' || m.address
    WHEN m.status = 'exited' THEN m.address || ' has left'
    WHEN r.file IS NULL THEN coalesce(x.file, 'no file') || ' is not on ' || m.address || '''s file'
    ELSE file.stored(x.file, 'profile', m.address)
  END
  FROM (SELECT payload ->> 'member' AS member, payload ->> 'file' AS file) x
  LEFT JOIN membership.member m ON m.address = x.member
  LEFT JOIN file_membership.record r ON r.member = x.member AND r.file = x.file;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('file-membership:member:attach', 'file_membership.files(jsonb)', 'file-membership');

GRANT USAGE ON SCHEMA file_membership TO cella_app, cella_guards;
GRANT SELECT ON file_membership.record TO cella_app, cella_guards;
GRANT INSERT ON file_membership.record TO cella_app;
