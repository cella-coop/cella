-- A project's own icon, replacing its collection's before its title, in
-- its header, its cells and its chips, drawn in its own ink: a short
-- slug of the curated set the picker offers
-- (`core/ui/ts/src/record-icons.ts`), or none, which draws the
-- collection's icon instead, as before. Setting it needs `manage-project`,
-- the same power that archives it.
ALTER TABLE project.project ADD COLUMN icon text CHECK (icon IS NULL OR icon ~ '^[a-z0-9-]{1,40}$');

INSERT INTO cella.power (op, power, amount, owner) VALUES
  ('project:project:icon', 'manage-project', NULL, 'project');

-- project:project:icon: the icon the entry names, or none.
CREATE FUNCTION project.fold_icon(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE project.project SET icon = fold_icon.entry -> 'payload' ->> 'icon'
  WHERE id = fold_icon.entry -> 'payload' ->> 'project';
END;

SELECT cella.lets_fold('project:project:icon', 1, 'project.fold_icon(jsonb)', 'project');
