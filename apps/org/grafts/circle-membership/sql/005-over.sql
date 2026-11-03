-- Whether `actor` may use `power` over what concerns the circle `about`
-- on `day`: they hold a seat in force whose role has a mandate in force
-- for the power whose scope covers `about`. A mandate's scope is a
-- condition on its permission, never a place in a tree: one with none
-- covers the whole co-op, `about` null, what belongs to no circle, among
-- it; one on a circle that circle alone; one on `own` the circle of the
-- seat it is held by, so a lead's covers their own circle and no other.
-- `may` checks a power and its limit for every write; the grafts that
-- know what a write concerns, a project's circle or a member's seats,
-- narrow it with this.
CREATE FUNCTION circle_membership.over(actor text, power text, about text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle_membership.seat a
    JOIN circle.mandate md ON md.grantee = a.role
    WHERE a.member = over.actor
      AND md.power = over.power
      AND (md.revoked IS NULL OR md.revoked > over.day)
      AND (md."from" IS NULL OR md."from" <= over.day)
      AND (md.until IS NULL OR md.until > over.day)
      AND (a.since IS NULL OR a.since <= over.day)
      AND (a.until IS NULL OR a.until > over.day)
      AND (md.scope IS NULL OR md.scope = over.about OR (md.scope = 'own' AND a.circle = over.about))
  );
END;
