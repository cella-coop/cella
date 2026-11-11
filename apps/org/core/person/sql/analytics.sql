-- Core person's analytical contract: each person by address, with
-- their name, which erasure redacts. Contact details are not shared.
CREATE VIEW person.people AS
SELECT p.address, p.name, p.circle
FROM person.person p;
COMMENT ON VIEW person.people IS 'audience: scoped by circle and address';

COMMENT ON COLUMN person.people.name IS 'personal: a person''s name, which statements and rolls show; erasure redacts it here as in core person';
