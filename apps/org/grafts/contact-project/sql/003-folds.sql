-- How each action of contact-project applies to the state before it
-- (architecture.md, "Folds").

-- contact-project:project:link: the project, for the contact the entry
-- names; linking again moves it.
CREATE FUNCTION contact_project.fold_link(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO contact_project.commission (project, contact)
  VALUES (fold_link.entry -> 'payload' ->> 'project', fold_link.entry -> 'payload' ->> 'contact')
  ON CONFLICT (project) DO UPDATE SET contact = excluded.contact;
END;

SELECT cella.lets_fold('contact-project:project:link', 1, 'contact_project.fold_link(jsonb)', 'contact-project');
