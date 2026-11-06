-- The contact feat's analytical contract: each contact, by kind and status.
-- A contact may be a person, whose name erasure redacts; their contact
-- details are not shared.
CREATE VIEW contact.contacts AS
SELECT c.id, c.kind, c.name, c.form, c.parent, c.tags, c.status, c.circle
FROM contact.contact c;
COMMENT ON VIEW contact.contacts IS 'audience: scoped by circle';

COMMENT ON COLUMN contact.contacts.name IS 'personal: a contact may be a person; erasure redacts it here as in the contact feat';
