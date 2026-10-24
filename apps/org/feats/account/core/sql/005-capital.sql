-- A member's capital account is opened when they subscribe and frozen when
-- they leave, until it is repaid; a frozen account never thaws. Which
-- member holds one, and when, is the account-member graft's.
CREATE FUNCTION account.stays_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.frozen AND NOT NEW.frozen THEN
    RAISE EXCEPTION '% is frozen until it is repaid', OLD.code
      USING ERRCODE = 'triggered_action_exception';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stays_frozen BEFORE UPDATE OF frozen ON account.account
  FOR EACH ROW EXECUTE FUNCTION account.stays_frozen();

GRANT INSERT ON account.account TO cella_app;
GRANT UPDATE (frozen) ON account.account TO cella_app;
