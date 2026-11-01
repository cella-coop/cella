CREATE SCHEMA circle_membership_project;

-- Every write that runs a project or spends its budget — its creation,
-- milestones, budget and archive, and the shares of its budget — the
-- actor's power must reach the project's circle (`circle_membership.over`):
-- a lead runs their own circle's projects and no other's; a project of
-- no circle is the whole co-op's, run from the assembly. The project is
-- the one the payload names.
CREATE FUNCTION circle_membership_project.runs(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN pr.id IS NULL THEN NULL
    WHEN NOT circle_membership.over(
      cella.actor(), w.power,
      coalesce(pr.circle, (SELECT c.id FROM circle.circle c WHERE c.parent IS NULL)),
      cella.verdict_date()
    ) THEN cella.actor() || ' holds ' || coalesce(w.power, 'no power') || ' over no circle that runs ' || pr.id
      || coalesce(', ' || pr.circle || '''s', '')
  END
  FROM (
    SELECT payload ->> 'project' AS project, (SELECT p.power FROM cella.power p WHERE p.op = cella.action()) AS power
  ) w
  LEFT JOIN project.project pr ON pr.id = w.project;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('project:project:create', 'circle_membership_project.runs(jsonb)', 'circle-membership-project'),
  ('project:milestone:add', 'circle_membership_project.runs(jsonb)', 'circle-membership-project'),
  ('project:milestone:complete', 'circle_membership_project.runs(jsonb)', 'circle-membership-project'),
  ('project:project:budget', 'circle_membership_project.runs(jsonb)', 'circle-membership-project'),
  ('project:project:archive', 'circle_membership_project.runs(jsonb)', 'circle-membership-project'),
  ('membership-project:project:share', 'circle_membership_project.runs(jsonb)', 'circle-membership-project');

GRANT USAGE ON SCHEMA circle_membership_project TO cella_app, cella_guards;
