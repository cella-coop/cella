-- The report feat's analytical contract: the thresholds a project is
-- watched by, which the project margins read.
CREATE VIEW report.thresholds AS
SELECT t.since, t.burn, t.margin
FROM report.threshold t;
