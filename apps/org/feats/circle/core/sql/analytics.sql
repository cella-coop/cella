-- The circle feat's analytical contract: the circles, their roles, the
-- mandates each grantee, a role or a circle, holds, with their issuers,
-- their parents, their limits,
-- budgets and scopes, and the rights the legal form gives.
CREATE VIEW circle.circles AS
SELECT c.id, c.name, c.assembly, c.procedure
FROM circle.circle c;

CREATE VIEW circle.roles AS
SELECT r.id, r.circle, r.name
FROM circle.role r;

CREATE VIEW circle.mandates AS
SELECT m.id, m.grantee, g.kind, m.issuer, m.parent, m.power, cella.cents(m."limit") AS "limit", cella.cents(m.budget) AS budget,
       m.per, m.scope, m."from", m.until, m.revoked
FROM circle.mandate m
JOIN circle.grantee g ON g.id = m.grantee;

CREATE VIEW circle.rights AS
SELECT r.id, r."right", r.power, cella.cents(r."limit") AS "limit", r."from", r.until, r.revoked
FROM circle.right r;
