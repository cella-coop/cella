-- The employment feat's analytical contract: each worker's job, contract
-- and days, by address; their name is the person feat's.
CREATE VIEW employment.workers AS
SELECT w.address, w.job, w.contract, w.start, w.until, w.minutes, w.hired
FROM employment.worker w;
