CREATE SCHEMA decision_member;

-- A member a decision asks to admit. Both sides are referenced by id and
-- address, with no foreign key into either feat; the rules resolve them.
CREATE TABLE decision_member.admission (
  decision text NOT NULL,
  member text NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  PRIMARY KEY (decision, member)
);

-- Whether a decision passes by its rule, over the stances of active members
-- received before it closed.
CREATE FUNCTION decision_member.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE d.rule
    WHEN 'consent' THEN (
      SELECT cella.consent(v.member, v.stance, v.receipt)
      FROM decision.vote v
      JOIN member.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
    WHEN 'majority' THEN (
      SELECT cella.majority(v.member, v.stance, v.receipt)
      FROM decision.vote v
      JOIN member.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
  END
  FROM decision.decision d
  WHERE d.id = ref;
END;

-- member:member:admit — the cited decision is closed, passes, and asks to
-- admit this member.
CREATE FUNCTION decision_member.admits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN d.closed IS NULL THEN d.id || ' is not closed'
    WHEN NOT decision_member.passes(d.id) THEN d.id || ' does not pass by ' || d.rule
    WHEN NOT EXISTS (
      SELECT FROM decision_member.admission a WHERE a.decision = d.id AND a.member = p.member
    ) THEN d.id || ' does not admit ' || p.member
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'member' AS member) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('member:member:admit', 'decision_member.admits(jsonb)', 'decision-member');

GRANT USAGE ON SCHEMA decision_member TO cella_app;
GRANT SELECT, INSERT ON decision_member.admission TO cella_app;
