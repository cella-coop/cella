-- A member's instalment plan and what each pay run withheld read as their
-- capital account does: the member, and whoever reads capital
-- (`account`'s readers). A write's transaction sees every row.
ALTER TABLE account_membership_payslip_transaction.plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_membership_payslip_transaction.withheld ENABLE ROW LEVEL SECURITY;

CREATE POLICY reads ON account_membership_payslip_transaction.plan FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR member = cella.reader() OR cella.reaches('account', member));
CREATE POLICY reads ON account_membership_payslip_transaction.withheld FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR member = cella.reader() OR cella.reaches('account', member));

CREATE POLICY rules ON account_membership_payslip_transaction.plan FOR SELECT TO cella_rules USING (true);
CREATE POLICY rules ON account_membership_payslip_transaction.withheld FOR SELECT TO cella_rules USING (true);

CREATE POLICY writes ON account_membership_payslip_transaction.plan FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON account_membership_payslip_transaction.plan FOR UPDATE TO cella_app USING (true);
CREATE POLICY writes ON account_membership_payslip_transaction.withheld FOR INSERT TO cella_app WITH CHECK (true);
