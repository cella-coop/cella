-- Core's circles' analytical contract: the circles, their roles, the
-- mandates each grantee, a role or a circle, holds, with their issuers,
-- their parents, their limits,
-- budgets and scopes, the rights the legal form gives, and open books'
-- disclosure values by the rule that set them.
CREATE VIEW circle.circles AS
SELECT c.id, c.name, c.assembly, c.procedure
FROM circle.circle c;
COMMENT ON VIEW circle.circles IS 'audience: shared by id';

CREATE VIEW circle.roles AS
SELECT r.id, r.circle, r.name
FROM circle.role r;
COMMENT ON VIEW circle.roles IS 'audience: shared by id';

CREATE VIEW circle.mandates AS
SELECT m.id, m.grantee, g.kind, m.issuer, m.parent, m.power, cella.cents(m."limit") AS "limit", cella.cents(m.budget) AS budget,
       m.per, m.scope, m."from", m.until, m.revoked
FROM circle.mandate m
JOIN circle.grantee g ON g.id = m.grantee;
COMMENT ON VIEW circle.mandates IS 'audience: shared by id';

CREATE VIEW circle.rights AS
SELECT r.id, r."right", r.power, cella.cents(r."limit") AS "limit", r."from", r.until, r.revoked
FROM circle.right r;
COMMENT ON VIEW circle.rights IS 'audience: shared by id';

CREATE VIEW circle.disclosures AS
SELECT d.id, d.policy, d.contributors, d.largest, d.two, d."from", d.until, d.revoked
FROM circle.disclosure d;
COMMENT ON VIEW circle.disclosures IS 'audience: shared by id';

-- Who holds which role in which circle, and when.
CREATE VIEW circle.seats AS
SELECT p.id, p.circle, p.member, p.role, p.since, p.until
FROM circle.seat p;
COMMENT ON VIEW circle.seats IS 'audience: shared by id';
