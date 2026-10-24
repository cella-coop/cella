-- A decision passes over the stances of the active members on its roll,
-- the circle-decision graft's: those seated in its circle when it was
-- proposed. A member admitted or seated since does not vote on it.
CREATE OR REPLACE FUNCTION decision_member.passes(ref text) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE d.rule
    WHEN 'consent' THEN (
      SELECT cella.consent(v.member, v.stance, v.receipt)
      FROM decision.vote v
      JOIN circle_decision.roll r ON r.decision = v.decision AND r.member = v.member
      JOIN member.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
    WHEN 'majority' THEN (
      SELECT cella.majority(v.member, v.stance, v.receipt)
      FROM decision.vote v
      JOIN circle_decision.roll r ON r.decision = v.decision AND r.member = v.member
      JOIN member.member m ON m.address = v.member AND m.status = 'active'
      WHERE v.decision = d.id AND v.receipt < coalesce(d.cutoff, 9223372036854775807)
    )
  END
  FROM decision.decision d
  WHERE d.id = ref;
END;

GRANT USAGE ON SCHEMA decision_member TO cella_rules;
GRANT SELECT ON ALL TABLES IN SCHEMA decision_member TO cella_rules;
