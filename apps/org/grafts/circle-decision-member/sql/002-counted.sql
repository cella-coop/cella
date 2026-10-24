-- decision:decision:vote — the member is on the decision's roll.
CREATE FUNCTION circle_decision_member.on_roll(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT FROM circle_decision_member.roll r WHERE r.decision = p.decision AND r.member = p.member
    ) THEN coalesce(p.member, 'no one') || ' is not on the roll of ' || coalesce(p.decision, 'no decision')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'member' AS member) p;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('decision:decision:vote', 'circle_decision_member.on_roll(jsonb)', 'circle-decision-member');

-- Who was counted: the members of a decision's roll who were active when
-- it closed, fixed by the close, so a later suspension or exit cannot
-- change its outcome.
CREATE TABLE circle_decision_member.counted (
  decision text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (decision, member)
);

-- Fixes who was counted as the close writes the decision: in the close's
-- transaction, so a refused close leaves nothing. It runs with its owner's
-- rights, since nothing else writes the table.
CREATE FUNCTION circle_decision_member.count_roll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO circle_decision_member.counted (decision, member)
  SELECT r.decision, r.member
  FROM circle_decision_member.roll r
  JOIN member.member m ON m.address = r.member AND m.status = 'active'
  WHERE r.decision = NEW.id;
  RETURN NULL;
END
$$;

CREATE TRIGGER count_roll AFTER UPDATE OF closed ON decision.decision
  FOR EACH ROW WHEN (OLD.closed IS NULL AND NEW.closed IS NOT NULL)
  EXECUTE FUNCTION circle_decision_member.count_roll();

-- Whether a decision passes by its rule, over the stances received before
-- its cutoff: once closed, from those counted at the close; while open,
-- from the members on its roll who are active now.
CREATE OR REPLACE FUNCTION circle_decision_member.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE d.rule
    WHEN 'consent' THEN (
      SELECT cella.consent(v.member, v.stance, v.receipt)
      FROM decision.vote v
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
        AND v.member IN (
          SELECT c.member FROM circle_decision_member.counted c WHERE c.decision = d.id AND d.closed IS NOT NULL
          UNION
          SELECT r.member FROM circle_decision_member.roll r JOIN member.member m ON m.address = r.member AND m.status = 'active'
          WHERE r.decision = d.id AND d.closed IS NULL
        )
    )
    WHEN 'majority' THEN (
      SELECT cella.majority(v.member, v.stance, v.receipt)
      FROM decision.vote v
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
        AND v.member IN (
          SELECT c.member FROM circle_decision_member.counted c WHERE c.decision = d.id AND d.closed IS NOT NULL
          UNION
          SELECT r.member FROM circle_decision_member.roll r JOIN member.member m ON m.address = r.member AND m.status = 'active'
          WHERE r.decision = d.id AND d.closed IS NULL
        )
    )
  END
  FROM decision.decision d
  WHERE d.id = ref;
END;

GRANT SELECT ON circle_decision_member.counted TO cella_app, cella_rules;
