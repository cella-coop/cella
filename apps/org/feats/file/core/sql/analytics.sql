-- The file feat's analytical contract: how many files each class keeps and
-- their size. A file is personal data whole, so only these sums are shared.
CREATE VIEW file.classes AS
SELECT f.class, count(*)::bigint AS files, coalesce(sum(f.size), 0)::bigint AS bytes
FROM file.file f
GROUP BY f.class;
COMMENT ON VIEW file.classes IS 'audience: shared by class';

COMMENT ON COLUMN file.classes.class IS 'not personal: a retention class, which opens files to a power, not to a person';
