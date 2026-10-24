-- Whether `actor` may use `power` over what concerns the circle `about`
-- on `day`: they hold a seat in force whose role has a mandate in force
-- for the power, in a circle that `about` is or is within. Authority
-- flows down the tree: a lead's mandate reaches their own circle, the
-- gérante's, seated in the assembly, every circle. `may` checks a power
-- and its limit for every write; the grafts that know what a write
-- concerns, a project's circle or a member's seats, narrow it with this.
CREATE FUNCTION circle_member.over(actor text, power text, about text, day date) RETURNS boolean
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT EXISTS (
    SELECT FROM circle_member.position a
    JOIN circle.mandate md ON md.role = a.role
    WHERE a.member = over.actor
      AND md.power = over.power
      AND md.revoked IS NULL
      AND (md."from" IS NULL OR md."from" <= over.day)
      AND (md.until IS NULL OR md.until > over.day)
      AND (a.since IS NULL OR a.since <= over.day)
      AND (a.until IS NULL OR a.until > over.day)
      AND circle.within(over.about, a.circle)
  );
END;
