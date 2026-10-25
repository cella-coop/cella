-- The shares a distribution credited to a member's capital read as their
-- capital account does: the member, and whoever reads capital
-- (`account`'s readers). A write's transaction sees every credit.
ALTER TABLE account_membership_patronage_transaction.credit ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON account_membership_patronage_transaction.credit FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR member = cella.reader() OR cella.reaches('account', member));
CREATE POLICY rules ON account_membership_patronage_transaction.credit FOR SELECT TO cella_rules USING (true);
CREATE POLICY writes ON account_membership_patronage_transaction.credit FOR INSERT TO cella_app WITH CHECK (true);
