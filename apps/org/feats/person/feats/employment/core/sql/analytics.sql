-- The employment feat's analytical contract: each worker's job, contract
-- and days, by address; their name is the person feat's.
CREATE VIEW employment.workers AS
SELECT w.address, w.job, w.contract, w.start, w.until, w.minutes, w.hired, w.circle
FROM employment.worker w;
COMMENT ON VIEW employment.workers IS 'audience: scoped by circle and address';
