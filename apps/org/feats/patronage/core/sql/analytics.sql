-- The patronage feat's analytical contract: each distribution and its
-- split, the terms adopted, and each distribution's parts summed by basis.
-- A worker's part is theirs, so no row is one worker's.
CREATE VIEW patronage.distributions AS
SELECT d.id, d.year, cella.cents(d.surplus) AS surplus, d.basis, d.approved, d.distributed
FROM patronage.distribution d;

CREATE VIEW patronage.shares AS
SELECT s.distribution, s.kind, s.percent, cella.cents(s.amount) AS amount
FROM patronage.share s;

CREATE VIEW patronage.terms_adopted AS
SELECT t.id, t."from", t.salary, t.hours, t.equal, t.capital, t.interest, t.adopted
FROM patronage.terms t;

CREATE VIEW patronage.parts AS
SELECT p.distribution, p.basis, count(*)::bigint AS workers,
       coalesce(sum(p.quantity), 0)::bigint AS quantity, coalesce(sum(cella.cents(p.amount)), 0)::bigint AS amount
FROM patronage.part p
GROUP BY p.distribution, p.basis;
