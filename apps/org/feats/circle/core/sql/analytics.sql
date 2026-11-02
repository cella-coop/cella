-- The circle feat's analytical contract: the circles, their roles and the
-- mandates each role, circle or right holds, with their limits and budgets.
CREATE VIEW circle.circles AS
SELECT c.id, c.name, c.parent, c.procedure, c.path
FROM circle.circle c;

CREATE VIEW circle.roles AS
SELECT r.id, r.circle, r.name
FROM circle.role r;

CREATE VIEW circle.mandates AS
SELECT m.id, m.role, m.circle, m."right", m.power, cella.cents(m."limit") AS "limit", cella.cents(m.budget) AS budget,
       m.per, m."from", m.until, m.revoked
FROM circle.mandate m;
