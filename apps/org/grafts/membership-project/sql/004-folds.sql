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
