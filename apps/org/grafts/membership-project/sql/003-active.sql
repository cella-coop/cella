-- A share goes to an active member as membership says one is, on the
-- verdict date (`membership.active`), not by a copy of its status.
CREATE OR REPLACE FUNCTION membership_project.within() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  budget bigint;
  archived date;
  shared bigint;
BEGIN
  IF NOT membership.active(NEW.member, cella.verdict_date()) THEN
    RAISE EXCEPTION '% is no active member', NEW.member USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT cella.cents(p.budget), p.archived INTO budget, archived FROM project.project p WHERE p.id = NEW.project FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no project %', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF archived IS NOT NULL THEN
    RAISE EXCEPTION '% was archived on %', NEW.project, archived USING ERRCODE = 'triggered_action_exception';
  END IF;
  IF budget IS NULL THEN
    RAISE EXCEPTION '% has no budget to share', NEW.project USING ERRCODE = 'triggered_action_exception';
  END IF;
  SELECT coalesce(sum(cella.cents(s.amount)), 0) INTO shared FROM membership_project.share s WHERE s.project = NEW.project;
  IF shared + cella.cents(NEW.amount) > budget THEN
    RAISE EXCEPTION 'a share of % cents exceeds what is left of %''s budget, % of % cents',
      cella.cents(NEW.amount), NEW.project, budget - shared, budget
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;
