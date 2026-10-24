CREATE SCHEMA circle_member;

-- A member's seat in a circle, with a role or as a plain member. The circle
-- is named by id and the member by address, with no foreign key into either
-- feat. A seat with no `since` was held before the records began; one that
-- ends keeps its row, with `until`, so who sat where on a past day can be
-- read back.
CREATE TABLE circle_member.position (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  circle text NOT NULL,
  member text NOT NULL,
  role text,
  since date,
  until date,
  CHECK (until IS NULL OR since IS NULL OR since < until)
);

CREATE INDEX ON circle_member.position (circle);
CREATE INDEX ON circle_member.position (member);

-- The members seated in a circle on a day.
CREATE FUNCTION circle_member.seated(circle text, day date) RETURNS SETOF text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT DISTINCT p.member
  FROM circle_member.position p
  WHERE p.circle = seated.circle
    AND (p.since IS NULL OR p.since <= seated.day)
    AND (p.until IS NULL OR p.until > seated.day);
END;

GRANT USAGE ON SCHEMA circle_member TO cella_app, cella_rules;
GRANT SELECT ON circle_member.position TO cella_app, cella_rules;
