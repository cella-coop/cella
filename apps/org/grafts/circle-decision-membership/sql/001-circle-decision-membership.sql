CREATE SCHEMA circle_decision_membership;

-- Who may vote on a decision: the members seated in its circle on the day
-- it was proposed, fixed when it is proposed. The decision is named by id
-- and the member by address, with no foreign key into either feat.
CREATE TABLE circle_decision_membership.roll (
  decision text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (decision, member)
);

-- Fixes a decision's roll from the seats in its circle, the circle-membership
-- graft's, a lower order than this one. The roll is this trigger's alone to
-- write, so it runs with its owner's rights.
CREATE FUNCTION circle_decision_membership.fix_roll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO circle_decision_membership.roll (decision, member)
  SELECT NEW.id, s FROM circle_membership.seated(NEW.circle, NEW.proposed) s;
  RETURN NULL;
END
$$;

CREATE TRIGGER fix_roll AFTER INSERT ON decision.decision
  FOR EACH ROW EXECUTE FUNCTION circle_decision_membership.fix_roll();

-- Whether a decision passes by its rule, over the stances received before
-- its cutoff from the members on its roll who are active.
CREATE FUNCTION circle_decision_membership.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE d.rule
    WHEN 'consent' THEN (
      SELECT cella.consent(v.member, v.stance, v.receipt)
      FROM decision.vote v
      JOIN circle_decision_membership.roll r ON r.decision = v.decision AND r.member = v.member
      JOIN membership.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
    WHEN 'majority' THEN (
      SELECT cella.majority(v.member, v.stance, v.receipt)
      FROM decision.vote v
      JOIN circle_decision_membership.roll r ON r.decision = v.decision AND r.member = v.member
      JOIN membership.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
  END
  FROM decision.decision d
  WHERE d.id = ref;
END;

-- Every write in decision.cites — the cited decision closed, and passes on
-- its roll.
CREATE FUNCTION circle_decision_membership.carried(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN d.closed IS NULL THEN d.id || ' is not closed'
    WHEN NOT circle_decision_membership.passes(d.id) THEN d.id || ' does not pass by ' || d.rule
  END
  FROM (SELECT payload ->> 'decision' AS decision) p
  LEFT JOIN decision.decision d ON d.id = p.decision;
END;

-- The guard attaches to every op that cites a decision: those the lower
-- grafts declared before this one migrated, and any declared after.
INSERT INTO cella.guard (op, fn, owner)
SELECT c.op, 'circle_decision_membership.carried(jsonb)'::regprocedure, 'circle-decision-membership' FROM decision.cites c;

CREATE FUNCTION circle_decision_membership.attach() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO cella.guard (op, fn, owner)
  VALUES (NEW.op, 'circle_decision_membership.carried(jsonb)', 'circle-decision-membership');
  RETURN NULL;
END
$$;

CREATE TRIGGER attach AFTER INSERT ON decision.cites
  FOR EACH ROW EXECUTE FUNCTION circle_decision_membership.attach();

GRANT USAGE ON SCHEMA circle_decision_membership TO cella_app, cella_guards;
GRANT SELECT ON circle_decision_membership.roll TO cella_app, cella_guards;
