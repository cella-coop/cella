-- What membership bars of a seat on a day, as core's circle-person asks
-- each kind of person (`circle_person.counts`): any person may hold a
-- seat, member or not, but the assembly's are its active members', as
-- membership says one is on the day (`membership.active`), not a copy of
-- its status; and no seat counts of someone this feat has suspended or
-- let go. So a worker who is no member sits in their working circle. The
-- reason names the circle's rule and the membership's status, never the
-- person, and is null where membership bars nothing.
CREATE FUNCTION membership.standing(person text, circle text, day date) RETURNS text
LANGUAGE sql STABLE
RETURN CASE
  WHEN membership.active(standing.person, standing.day) THEN NULL
  WHEN standing.circle = circle.assembly()
    THEN 'its seats are its active members'', their membership being '
      || coalesce((SELECT m.status FROM membership.member m WHERE m.address = standing.person), 'none')
  WHEN EXISTS (
    SELECT FROM membership.member m
    WHERE m.address = standing.person AND m.status IN ('suspended', 'exited')
  ) THEN 'membership has suspended them or let them go'
END;

SELECT circle_person.register_standing('membership.standing(text, text, date)', 'membership');
