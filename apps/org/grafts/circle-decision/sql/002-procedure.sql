-- A circle decides by a procedure the decision feat holds, whatever wrote
-- it.
CREATE FUNCTION circle_decision.decides_by() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM decision.procedure p WHERE p.id = NEW.procedure) THEN
    RAISE EXCEPTION '% decides by %, which is no procedure', NEW.id, NEW.procedure
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER decides_by BEFORE INSERT OR UPDATE OF procedure ON circle.circle
  FOR EACH ROW EXECUTE FUNCTION circle_decision.decides_by();
