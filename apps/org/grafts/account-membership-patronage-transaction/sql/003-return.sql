-- The figures of a distributed year a SCOP reports to its federation: the
-- coop's, which every member reads whole. It runs as its owner, so its
-- counts and sums take every worker's part, credit and capital, whoever
-- reads it; it names no one. No row before the year is distributed.
CREATE FUNCTION account_membership_patronage_transaction.federation(ref text)
RETURNS TABLE (
  year integer, distributed text, surplus numeric, legal numeric, development numeric, work numeric, interest numeric,
  workers numeric, associates_sharing numeric, employed numeric, shares numeric, until text, associates numeric,
  capital numeric, employee_capital numeric, reserve numeric, highest numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
BEGIN ATOMIC
  SELECT a.year, to_char(a.distributed, 'YYYY-MM-DD'), cella.cents(a.surplus)::numeric,
         patronage.share_of(a.id, 'legal')::numeric, patronage.share_of(a.id, 'development')::numeric,
         patronage.share_of(a.id, 'work')::numeric, patronage.share_of(a.id, 'interest')::numeric,
         (SELECT count(*) FROM patronage.statement s WHERE s.distribution = a.id)::numeric,
         (SELECT count(*) FROM patronage.statement s JOIN membership.member m ON m.address = s.worker
          WHERE s.distribution = a.id AND m.status = 'active')::numeric,
         (SELECT coalesce(sum(cella.cents(c.amount)), 0) FROM account_membership_patronage_transaction.credit c WHERE c.distribution = a.id)::numeric,
         (SELECT coalesce(sum(c.shares), 0) FROM account_membership_patronage_transaction.credit c WHERE c.distribution = a.id)::numeric,
         (SELECT to_char(max(c.until), 'YYYY-MM-DD') FROM account_membership_patronage_transaction.credit c WHERE c.distribution = a.id),
         (SELECT count(*) FROM membership.member m WHERE m.status = 'active')::numeric,
         (SELECT coalesce(sum(c.subscribed), 0) FROM account_membership.capital c WHERE c.status = 'active')::numeric,
         (SELECT coalesce(sum(c.subscribed), 0) FROM account_membership.capital c
          WHERE c.status = 'active' AND EXISTS (SELECT FROM patronage.statement s WHERE s.distribution = a.id AND s.worker = c.member))::numeric,
         coalesce((SELECT -b.balance FROM account_transaction.balance b WHERE b.code = '1061'), 0)::numeric,
         patronage_transaction.highest()::numeric
  FROM patronage.distribution a
  WHERE a.id = federation.ref AND a.distributed IS NOT NULL;
END;

COMMENT ON FUNCTION account_membership_patronage_transaction.federation(text) IS 'audience: shared by year: the coop''s figures of a distributed year, counts and sums that name no one';
