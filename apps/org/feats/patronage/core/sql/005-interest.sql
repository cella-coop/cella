-- The highest rate of interest the statutes pay on the capital, a percent
-- of what the members hold in shares, adopted with the terms: what the
-- interest share of a year they govern may come to. The law caps it, loi
-- n° 47-1775 du 10 septembre 1947, art. 14: at most the average of the
-- rates of return on private companies' bonds (the TMO) the minister
-- published in the three calendar years before the assembly, plus two
-- points. Terms with no rate pay no interest on capital.
ALTER TABLE patronage.terms
  ADD COLUMN interest numeric(5, 2) NOT NULL DEFAULT 0 CHECK (interest BETWEEN 0 AND 100);

COMMENT ON COLUMN patronage.terms.interest IS 'not personal: the statutes'' highest rate of interest on capital, a percent';
