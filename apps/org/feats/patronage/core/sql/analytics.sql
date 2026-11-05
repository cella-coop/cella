-- The patronage feat's analytical contract: each distribution and its
-- split, the terms adopted, and each distribution's parts summed by basis.
-- A worker's part is theirs, so no row is one worker's.
CREATE VIEW patronage.distributions AS
SELECT d.id, d.year, cella.cents(d.surplus) AS surplus, d.basis, d.approved, d.distributed, d.circle
FROM patronage.distribution d;
COMMENT ON VIEW patronage.distributions IS 'audience: scoped by circle';

CREATE VIEW patronage.shares AS
SELECT s.distribution, s.kind, s.percent, cella.cents(s.amount) AS amount, s.circle
FROM patronage.share s;
COMMENT ON VIEW patronage.shares IS 'audience: scoped by circle';

CREATE VIEW patronage.terms_adopted AS
SELECT t.id, t."from", t.salary, t.hours, t.equal, t.capital, t.interest, t.adopted, t.circle
FROM patronage.terms t;
COMMENT ON VIEW patronage.terms_adopted IS 'audience: scoped by circle';

CREATE VIEW patronage.parts AS
SELECT p.distribution, p.basis, count(*)::bigint AS workers,
       coalesce(sum(p.quantity), 0)::bigint AS quantity, coalesce(sum(cella.cents(p.amount)), 0)::bigint AS amount
FROM patronage.part p
GROUP BY p.distribution, p.basis;
COMMENT ON VIEW patronage.parts IS 'audience: shared by distribution, basis';
