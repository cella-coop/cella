-- The contact feat's analytical contract: each contact, by kind, client
-- stage and whether it is archived. A company's name is shared; a person
-- contact is named by the address core person knows them by, whose name
-- is core's, and no contact details are shared.
CREATE VIEW contact.contacts AS
SELECT c.id, c.kind, c.person, c.name, c.form, c.parent, c.tags, c.client, c.archived, c.circle
FROM contact.contact c;
COMMENT ON VIEW contact.contacts IS 'audience: scoped by circle';

COMMENT ON COLUMN contact.contacts.person IS 'not personal: the pseudonymous address core person names a person contact by';
COMMENT ON COLUMN contact.contacts.name IS 'personal: a company''s name, registered as personal as its writes are; a person contact has none';
