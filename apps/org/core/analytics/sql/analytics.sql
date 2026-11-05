-- The analytics port's contract: the log's head, its entry's number and
-- hash, which the shell reads on the same snapshot as a report and stamps
-- it with. No head before the first write. The log itself stays the
-- notary's: the role reads its head and nothing else of it.
CREATE VIEW analytics.head AS
SELECT h.n, encode(h.hash, 'hex') AS hash
FROM cella.head h;
COMMENT ON VIEW analytics.head IS 'audience: shared';
