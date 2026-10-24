CREATE SCHEMA decision_member;

-- A member a decision asks to admit. Both sides are referenced by id and
-- address, with no foreign key into either feat; the rules resolve them.
CREATE TABLE decision_member.admission (
  decision text NOT NULL,
  member text NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  PRIMARY KEY (decision, member)
);

-- member:member:admit — the cited decision asks to admit this member.
-- That it closed and passed on its roll is circle-decision-member's rule,
-- which this graft cannot read: an admission cites a decision.
CREATE FUNCTION decision_member.admits(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN NOT EXISTS (
      SELECT FROM decision_member.admission a WHERE a.decision = d.id AND a.member = p.member
    ) THEN d.id || ' does not admit ' || p.member
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'member' AS member) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('member:member:admit', 'decision_member.admits(jsonb)', 'decision-member');
INSERT INTO decision.cites (op, owner) VALUES ('member:member:admit', 'decision-member');

GRANT USAGE ON SCHEMA decision_member TO cella_app, cella_rules;
GRANT SELECT, INSERT ON decision_member.admission TO cella_app;
GRANT SELECT ON decision_member.admission TO cella_rules;
