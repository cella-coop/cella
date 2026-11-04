-- What a member subscribed, was called, paid in, drew and is owed reads as
-- their capital account does: the member, and whoever reads capital
-- (`account`'s readers). A write's transaction sees every row.
ALTER TABLE account_membership_transaction.subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_membership_transaction.draw ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_membership_transaction.paid ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_membership_transaction.repayment ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_membership_transaction.withdrawal ENABLE ROW LEVEL SECURITY;

DROP POLICY circle ON account_membership_transaction.subscription;
CREATE POLICY reads ON account_membership_transaction.subscription FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR circle = ANY ((SELECT cella.circles('account'))::text[]) OR member = cella.reader() OR cella.reaches('account', member));
DROP POLICY circle ON account_membership_transaction.draw;
CREATE POLICY reads ON account_membership_transaction.draw FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR circle = ANY ((SELECT cella.circles('account'))::text[]) OR member = cella.reader() OR cella.reaches('account', member));
DROP POLICY circle ON account_membership_transaction.paid;
CREATE POLICY reads ON account_membership_transaction.paid FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR circle = ANY ((SELECT cella.circles('account'))::text[]) OR member = cella.reader() OR cella.reaches('account', member));
DROP POLICY circle ON account_membership_transaction.repayment;
CREATE POLICY reads ON account_membership_transaction.repayment FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR circle = ANY ((SELECT cella.circles('account'))::text[]) OR member = cella.reader() OR cella.reaches('account', member));
DROP POLICY circle ON account_membership_transaction.withdrawal;
CREATE POLICY reads ON account_membership_transaction.withdrawal FOR SELECT TO cella_app USING ((SELECT cella.sees('account')) OR circle = ANY ((SELECT cella.circles('account'))::text[]) OR member = cella.reader() OR cella.reaches('account', member));

CREATE POLICY guards ON account_membership_transaction.subscription FOR SELECT TO cella_guards USING (true);
CREATE POLICY guards ON account_membership_transaction.draw FOR SELECT TO cella_guards USING (true);
CREATE POLICY guards ON account_membership_transaction.paid FOR SELECT TO cella_guards USING (true);
CREATE POLICY guards ON account_membership_transaction.repayment FOR SELECT TO cella_guards USING (true);
CREATE POLICY guards ON account_membership_transaction.withdrawal FOR SELECT TO cella_guards USING (true);

CREATE POLICY writes ON account_membership_transaction.subscription FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON account_membership_transaction.subscription FOR UPDATE TO cella_app USING (true);
CREATE POLICY writes ON account_membership_transaction.draw FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY writes ON account_membership_transaction.paid FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY writes ON account_membership_transaction.repayment FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY writes ON account_membership_transaction.withdrawal FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY changes ON account_membership_transaction.repayment FOR UPDATE TO cella_app USING (true);

ALTER VIEW account_membership_transaction.drawn SET (security_invoker = true);
ALTER VIEW account_membership_transaction.called SET (security_invoker = true);
ALTER VIEW account_membership_transaction.owed SET (security_invoker = true);
