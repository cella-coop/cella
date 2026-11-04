-- Every write that runs a project or spends its budget — its creation,
-- milestones, budget and archive, and the shares of its budget — the
-- actor must hold the power by a mandate whose scope covers the
-- project's circle (`membership.over`):
-- a lead runs their own circle's projects and no other's; a project of
-- no circle is the whole co-op's, run by a mandate on it. The project is
-- the one the payload names.
CREATE FUNCTION membership_project.runs(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN pr.id IS NULL THEN NULL
    WHEN NOT membership.over(
      cella.actor(), w.power,
      pr.circle,
      cella.verdict_date()
    ) THEN cella.actor() || ' holds ' || coalesce(w.power, 'no power') || ' by no mandate covering ' || pr.id
      || coalesce(', ' || pr.circle || '''s', '')
  END
  FROM (
    SELECT payload ->> 'project' AS project, (SELECT p.power FROM cella.power p WHERE p.op = cella.action()) AS power
  ) w
  LEFT JOIN project.project pr ON pr.id = w.project;
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('project:project:create', 'membership_project.runs(jsonb)', 'membership-project'),
  ('project:milestone:add', 'membership_project.runs(jsonb)', 'membership-project'),
  ('project:milestone:complete', 'membership_project.runs(jsonb)', 'membership-project'),
  ('project:project:budget', 'membership_project.runs(jsonb)', 'membership-project'),
  ('project:project:archive', 'membership_project.runs(jsonb)', 'membership-project'),
  ('membership-project:project:share', 'membership_project.runs(jsonb)', 'membership-project');

GRANT USAGE ON SCHEMA membership_project TO cella_app, cella_guards;
