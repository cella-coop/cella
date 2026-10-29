-- The import feat's analytical contract: each run, its kind and day, and
-- how many of its records settled and were refused.
CREATE VIEW import.runs AS
SELECT r.id, r.kind, r.day, r.dry, r.settled, r.refused
FROM import.run r;
