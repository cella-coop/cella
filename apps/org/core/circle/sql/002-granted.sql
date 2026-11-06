-- A revoked mandate stays revoked, from its day or an earlier one, and
-- its grant never changes; nor does a right's, nor open books' values.
CREATE FUNCTION circle.stays_granted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'revoked') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked')
    OR (OLD.revoked IS NOT NULL AND (NEW.revoked IS NULL OR NEW.revoked > OLD.revoked)) THEN
    RAISE EXCEPTION '% % of % keeps its grant, and stays revoked', TG_ARGV[0], OLD.id, to_jsonb(OLD) ->> TG_ARGV[1]
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_granted BEFORE UPDATE ON circle.mandate
  FOR EACH ROW EXECUTE FUNCTION circle.stays_granted('mandate', 'grantee');
CREATE TRIGGER stays_granted BEFORE UPDATE ON circle.right
  FOR EACH ROW EXECUTE FUNCTION circle.stays_granted('right', 'right');
CREATE TRIGGER stays_granted BEFORE UPDATE ON circle.disclosure
  FOR EACH ROW EXECUTE FUNCTION circle.stays_granted('disclosure', 'policy');

GRANT INSERT, UPDATE (revoked) ON circle.mandate, circle.right, circle.disclosure TO cella_app;
