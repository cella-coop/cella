-- The client feat's analytical contract: each client, by kind and status.
-- A client may be a person, whose name erasure redacts; their contact
-- details are not shared.
CREATE VIEW client.clients AS
SELECT c.id, c.kind, c.name, c.form, c.parent, c.tags, c.status
FROM client.client c;

COMMENT ON COLUMN client.clients.name IS 'personal: a client may be a person; erasure redacts it here as in the client feat';
