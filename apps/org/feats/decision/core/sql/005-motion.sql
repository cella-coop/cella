-- The kinds of thing a decision can decide beyond its text, each
-- registered by the graft that carries it out: admitting a member,
-- nesting a circle. `fields` names the arguments a motion of the kind
-- takes, as the New form asks for them: [{ name, label, type, optional }],
-- type `text` or `number`. This feat knows no kind; it keeps the register, as
-- it keeps `decision.cites`.
CREATE TABLE decision.kind (
  kind text PRIMARY KEY CHECK (kind ~ '^[a-z][a-z-]*$'),
  label text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(fields) = 'array'),
  owner text NOT NULL
);

-- What a decision decides, in the order proposed: a motion of a
-- registered kind and its arguments, which the kind's graft reads and its
-- guards check. Motions are fixed with the proposal.
CREATE TABLE decision.motion (
  decision text NOT NULL REFERENCES decision.decision,
  n integer NOT NULL CHECK (n > 0),
  kind text NOT NULL REFERENCES decision.kind,
  args jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(args) = 'object'),
  PRIMARY KEY (decision, n)
);

CREATE INDEX ON decision.motion (kind);

-- A motion is part of the proposal: none is added once a stance is given
-- or the decision closed, so no one consents to one thing and is counted
-- for another.
CREATE FUNCTION decision.moved_with_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM decision.decision d WHERE d.id = NEW.decision AND d.closed IS NOT NULL)
    OR EXISTS (SELECT FROM decision.vote v WHERE v.decision = NEW.decision) THEN
    RAISE EXCEPTION '% has stances or is closed: what it decides is fixed', NEW.decision
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER moved_with_proposal BEFORE INSERT ON decision.motion
  FOR EACH ROW EXECUTE FUNCTION decision.moved_with_proposal();

-- decision:decision:propose — the write proposed the decision on the
-- verdict date, open until a later deadline, with the motions its payload
-- names and no others.
CREATE FUNCTION decision.proposes(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.id, 'is named')
    WHEN d.proposed IS DISTINCT FROM cella.verdict_date() OR d.closed IS NOT NULL
      THEN d.id || ' was not proposed by this write'
    WHEN d.deadline <= d.proposed THEN d.id || '''s deadline must come after ' || to_char(d.proposed, 'YYYY-MM-DD')
    WHEN (SELECT count(*) FROM decision.motion m WHERE m.decision = d.id)
      <> jsonb_array_length(coalesce(p.motions, '[]'))
      THEN d.id || ' decides otherwise than its payload names'
  END
  FROM (SELECT payload ->> 'decision' AS id, payload -> 'motions' AS motions) p
  LEFT JOIN decision.decision d ON d.id = p.id;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('decision:decision:propose', 'decision.proposes(jsonb)', 'decision');

GRANT SELECT ON decision.kind TO cella_app, cella_guards;
GRANT SELECT, INSERT ON decision.motion TO cella_app;
GRANT SELECT ON decision.motion TO cella_guards;
