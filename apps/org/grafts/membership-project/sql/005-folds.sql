-- How each action of membership-project applies to the state before it
-- (architecture.md, "Folds").

-- membership-project:project:share: the share under the id the entry
-- names, of the amount it names, to its member from its project's
-- budget, granted on the day it names; the graft's trigger judges it
-- against the member and the pot again, as it did when it was granted.
CREATE FUNCTION membership_project.fold_share(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO membership_project.share (id, project, member, amount, granted)
  VALUES ((fold_share.entry -> 'payload' ->> 'share')::bigint, fold_share.entry -> 'payload' ->> 'project',
          fold_share.entry -> 'payload' ->> 'member', cella.amount((fold_share.entry -> 'payload' ->> 'amount')::bigint),
          (fold_share.entry -> 'payload' ->> 'granted')::date);
END;

SELECT cella.lets_fold('membership-project:project:share', 1, 'membership_project.fold_share(jsonb)', 'membership-project');

-- membership-project:project:crew: who leads the project, under the
-- member the entry names, or no one where it names none, and who else
-- is on it, replaced whole by the members it lists; the graft's trigger
-- refuses one not an active member on the entry's day, as it did.
CREATE FUNCTION membership_project.fold_crew(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  DELETE FROM membership_project.lead WHERE project = fold_crew.entry -> 'payload' ->> 'project';
  INSERT INTO membership_project.lead (project, member)
  SELECT fold_crew.entry -> 'payload' ->> 'project', fold_crew.entry -> 'payload' ->> 'lead'
  WHERE fold_crew.entry -> 'payload' ->> 'lead' IS NOT NULL;
  DELETE FROM membership_project.member WHERE project = fold_crew.entry -> 'payload' ->> 'project';
  INSERT INTO membership_project.member (project, member)
  SELECT fold_crew.entry -> 'payload' ->> 'project', m
  FROM jsonb_array_elements_text(coalesce(fold_crew.entry -> 'payload' -> 'members', '[]')) m;
END;

SELECT cella.lets_fold('membership-project:project:crew', 1, 'membership_project.fold_crew(jsonb)', 'membership-project');
